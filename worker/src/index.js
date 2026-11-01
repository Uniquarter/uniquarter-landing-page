// The sign-up Worker. It sits between the landing page and Resend, because a
// public web page can't hold the Resend key.
//
//   POST /subscribe  checks the form, then emails a confirmation link. Stores nothing.
//   POST /confirm    takes the token from that link, saves the contact in Resend
//                    and emails the team a heads-up.
//
// Logs carry the route and the outcome only, never a name or an email address.

import { validateSignup } from "./validate.js";
import { importKey, sealToken, openToken, TokenError } from "./token.js";
import { notificationEmail } from "./notify.js";

const RESEND_API = "https://api.resend.com";
const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY_BYTES = 4096;

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);
    var origin = request.headers.get("Origin") || "";
    var allowed = isAllowedOrigin(origin, env);

    if (request.method === "OPTIONS") {
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    var route = url.pathname;
    if (request.method !== "POST" || (route !== "/subscribe" && route !== "/confirm")) {
      return new Response("Not found", { status: 404 });
    }

    // CORS only stops browsers reading the reply, so the origin is also
    // refused here, before any work is done.
    if (!allowed) return json({ error: "forbidden" }, 403, "");

    var outcome;
    try {
      outcome = route === "/subscribe" ? await subscribe(request, env) : await confirm(request, env, ctx);
    } catch (e) {
      console.log(JSON.stringify({ route: route, outcome: "exception", message: String(e && e.message) }));
      outcome = { status: 502, body: { error: "unavailable" } };
    }
    console.log(JSON.stringify({ route: route, outcome: outcome.body.error || "ok", status: outcome.status }));
    return json(outcome.body, outcome.status, origin);
  },
};

async function subscribe(request, env) {
  if (!(await underRateLimit(request, env))) return { status: 429, body: { error: "rate_limited" } };

  var body = await readJson(request);
  if (!body) return { status: 400, body: { error: "bad_request" } };

  // A filled honeypot means a bot. It gets the normal reply so it learns nothing.
  if (body.website) return { status: 202, body: { ok: true } };

  var checked = validateSignup(body);
  if (!checked.ok) return { status: 400, body: { error: "invalid", fields: checked.errors } };

  if (!(await passedTurnstile(body.turnstileToken, request, env))) {
    return { status: 400, body: { error: "challenge" } };
  }

  var key = await importKey(env.TOKEN_KEY);
  var token = await sealToken(
    Object.assign({}, checked.value, { consentVersion: env.CONSENT_VERSION, submittedAt: Date.now() }),
    key
  );

  var sent = await resend(env, "POST", "/emails", confirmationEmail(env, checked.value.email, env.CONFIRM_URL + "#" + token));
  if (!sent.ok) return { status: 502, body: { error: "unavailable" } };

  // The same reply whether or not the address is already on the list.
  return { status: 202, body: { ok: true } };
}

async function confirm(request, env, ctx) {
  if (!(await underRateLimit(request, env))) return { status: 429, body: { error: "rate_limited" } };

  var body = await readJson(request);
  if (!body || typeof body.token !== "string" || body.token.length > 2048) {
    return { status: 400, body: { error: "invalid" } };
  }

  var signup;
  try {
    signup = await openToken(body.token, await importKey(env.TOKEN_KEY));
  } catch (e) {
    if (e instanceof TokenError) return { status: e.reason === "expired" ? 410 : 400, body: { error: e.reason } };
    throw e;
  }

  var path = "/contacts/" + encodeURIComponent(signup.email);
  var existing = await resend(env, "GET", path);
  if (!existing.ok && existing.status !== 404) return { status: 502, body: { error: "unavailable" } };

  // consented_at makes each link single use. A link older than the last
  // confirmation is refused, so an old email can't re-subscribe someone who
  // has since unsubscribed.
  if (existing.ok) {
    var last = existing.data.properties && existing.data.properties.consented_at;
    var lastAt = last ? Date.parse(last.value) : NaN;
    if (!isNaN(lastAt) && signup.submittedAt <= lastAt) return { status: 409, body: { error: "used" } };
  }

  var properties = {
    role: signup.role,
    institution: signup.institution || null,
    consented_at: new Date().toISOString(),
    consent_version: signup.consentVersion,
    source: "landing-page",
  };

  if (existing.ok) {
    var updated = await resend(env, "PATCH", path, {
      first_name: signup.firstName,
      unsubscribed: false,
      properties: properties,
    });
    if (!updated.ok) return { status: 502, body: { error: "unavailable" } };
    var added = await resend(env, "POST", path + "/segments/" + encodeURIComponent(env.RESEND_SEGMENT_ID));
    // Already in the segment is fine.
    if (!added.ok && added.status !== 409 && added.status !== 422) return { status: 502, body: { error: "unavailable" } };
  } else {
    if (!properties.institution) delete properties.institution;
    var created = await resend(env, "POST", "/contacts", {
      email: signup.email,
      first_name: signup.firstName,
      unsubscribed: false,
      properties: properties,
      segments: [{ id: env.RESEND_SEGMENT_ID }],
    });
    if (!created.ok) return { status: 502, body: { error: "unavailable" } };
  }

  // The person is on the list by now, so a failed heads-up is only logged. It
  // is sent after the reply, so it never slows the confirm page down.
  if (env.NOTIFY_TO && ctx) ctx.waitUntil(resend(env, "POST", "/emails", notificationEmail(env, signup, existing.ok)));

  return { status: 200, body: { ok: true } };
}

// The confirmation email holds no marketing and doesn't repeat the name typed
// into the form, so it can't be used to deliver someone else's message.
function confirmationEmail(env, to, link) {
  var text = [
    "Someone, hopefully you, registered interest in UniQuarter with this email address, to get updates as we progress towards launching the platform.",
    "",
    "To confirm, open this link and press the button on the page:",
    link,
    "",
    "The link works for 24 hours. If you didn't ask for this, ignore this email and nothing happens. We won't email you again.",
    "",
    "UniQuarter Limited, Christchurch, New Zealand",
    "https://uniquarter.co.nz",
  ].join("\n");

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1F2933;max-width:560px">' +
    "<p>Someone, hopefully you, registered interest in UniQuarter with this email address, to get updates as we progress towards launching the platform.</p>" +
    '<p><a href="' + link + '" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#175B68;color:#FFFFFF;font-weight:bold;text-decoration:none">Confirm my interest</a></p>' +
    "<p>The link works for 24 hours. If you didn't ask for this, ignore this email and nothing happens. We won't email you again.</p>" +
    '<p style="font-size:14px;color:#52606D">UniQuarter Limited, Christchurch, New Zealand<br><a href="https://uniquarter.co.nz" style="color:#175B68">uniquarter.co.nz</a></p>' +
    "</div>";

  return {
    from: env.FROM,
    to: [to],
    reply_to: env.REPLY_TO,
    subject: "Confirm your interest in UniQuarter",
    text: text,
    html: html,
  };
}

async function resend(env, method, path, payload) {
  var init = {
    method: method,
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "User-Agent": "uniquarter-signup/1.0",
    },
  };
  if (payload !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(payload);
  }
  var res = await fetch(RESEND_API + path, init);
  var data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    // Resend's error names are safe to log; the request body is not.
    console.log(JSON.stringify({ resend: method + " " + path.split("/")[1], status: res.status, name: data && data.name }));
  }
  return { ok: res.ok, status: res.status, data: data };
}

async function passedTurnstile(token, request, env) {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  var form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  var ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);
  var res = await fetch(TURNSTILE_VERIFY, { method: "POST", body: form });
  if (!res.ok) return false;
  var outcome = await res.json();
  return outcome.success === true;
}

// A burst limit only. Turnstile does the real work of keeping bots out.
async function underRateLimit(request, env) {
  if (!env.SIGNUP_LIMITER) return true;
  var ip = request.headers.get("CF-Connecting-IP") || "unknown";
  var outcome = await env.SIGNUP_LIMITER.limit({ key: ip });
  return outcome.success;
}

async function readJson(request) {
  var type = request.headers.get("Content-Type") || "";
  if (type.indexOf("application/json") !== 0) return null;
  var text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    var body = JSON.parse(text);
    return body && typeof body === "object" ? body : null;
  } catch (e) {
    return null;
  }
}

export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  var list = String(env.ALLOWED_ORIGINS || "").split(",").map(function (s) { return s.trim(); });
  if (list.indexOf(origin) !== -1) return true;
  return env.DEV === "true" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, origin) {
  var headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}
