// The sign-up route end to end, with the network and the rate limiters
// stood in for, so each test can see what would have been sent.

import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { isAllowedHostname, readJson } from "../src/index.js";

const KEY = Buffer.alloc(32, 7).toString("base64");
const ORIGIN = "https://uniquarter.co.nz";
const GOOD = { firstName: "Aroha", email: "aroha@example.co.nz", role: "student", institution: "uc", turnstileToken: "tok" };

// Counts hits per key, like Cloudflare's limiter, and remembers the keys.
function limiter(limit) {
  const counts = new Map();
  return {
    keys: () => Array.from(counts.keys()),
    limit: async ({ key }) => {
      const n = (counts.get(key) || 0) + 1;
      counts.set(key, n);
      return { success: n <= limit };
    },
  };
}

function makeEnv(extra) {
  return {
    ALLOWED_ORIGINS: "https://uniquarter.co.nz,https://www.uniquarter.co.nz",
    CONFIRM_URL: "https://uniquarter.co.nz/confirm/",
    FROM: "UniQuarter <hello@news.uniquarter.co.nz>",
    REPLY_TO: "hello@uniquarter.co.nz",
    CONSENT_VERSION: "test",
    TOKEN_KEY: KEY,
    RESEND_API_KEY: "re_test",
    RESEND_SEGMENT_ID: "seg",
    TURNSTILE_SECRET: "secret",
    SIGNUP_LIMITER: limiter(10),
    EMAIL_LIMITER: limiter(1),
    ...extra,
  };
}

// Stands in for Turnstile and Resend. Returns the list of emails handed to Resend.
function fakeNetwork(t, turnstileReply) {
  const emails = [];
  t.mock.method(console, "log", () => {});
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url).startsWith("https://challenges.cloudflare.com/")) return Response.json(turnstileReply);
    if (String(url) === "https://api.resend.com/emails") emails.push(JSON.parse(init.body));
    return Response.json({ id: "x" });
  });
  return emails;
}

function post(body, headers) {
  return new Request("https://signup.test/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function subscribe(env, body) {
  const res = await worker.fetch(post(body), env);
  return { status: res.status, body: await res.json() };
}

test("a good sign-up sends one confirmation email to the address given", async (t) => {
  const emails = fakeNetwork(t, { success: true, hostname: "uniquarter.co.nz" });
  const r = await subscribe(makeEnv(), GOOD);
  assert.equal(r.status, 202);
  assert.equal(emails.length, 1);
  assert.deepEqual(emails[0].to, ["aroha@example.co.nz"]);
  assert.match(emails[0].text, /https:\/\/uniquarter\.co\.nz\/confirm\/#[A-Za-z0-9_-]{40,}/);
});

test("a second sign-up for the same address within the minute is refused and sends nothing", async (t) => {
  const emails = fakeNetwork(t, { success: true, hostname: "uniquarter.co.nz" });
  const env = makeEnv();
  assert.equal((await subscribe(env, GOOD)).status, 202);
  const again = await subscribe(env, { ...GOOD, email: "Aroha@Example.co.nz", firstName: "Someone Else" });
  assert.equal(again.status, 429);
  assert.equal(again.body.error, "email_limited");
  assert.equal(emails.length, 1);
  // A different address is unaffected.
  assert.equal((await subscribe(env, { ...GOOD, email: "other@example.co.nz" })).status, 202);
  assert.equal(emails.length, 2);
});

test("the address limiter is given a hash, never the address", async (t) => {
  fakeNetwork(t, { success: true, hostname: "uniquarter.co.nz" });
  const env = makeEnv();
  await subscribe(env, GOOD);
  const keys = env.EMAIL_LIMITER.keys();
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^[0-9a-f]{64}$/);
  assert.ok(!keys[0].includes("aroha"));
});

test("the address limit only counts once the bot check has passed", async (t) => {
  const emails = fakeNetwork(t, { success: false });
  const env = makeEnv();
  for (let i = 0; i < 3; i++) {
    const r = await subscribe(env, GOOD);
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "challenge");
  }
  assert.deepEqual(env.EMAIL_LIMITER.keys(), []);
  assert.equal(emails.length, 0);
});

test("a bot check passed on another site is refused", async (t) => {
  const emails = fakeNetwork(t, { success: true, hostname: "uniquarter-copy.example.com" });
  const r = await subscribe(makeEnv(), GOOD);
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "challenge");
  assert.equal(emails.length, 0);
});

test("only this site's hostnames pass the bot check, and anything in development", () => {
  const env = { ALLOWED_ORIGINS: "https://uniquarter.co.nz,https://www.uniquarter.co.nz" };
  assert.equal(isAllowedHostname("uniquarter.co.nz", env), true);
  assert.equal(isAllowedHostname("www.uniquarter.co.nz", env), true);
  assert.equal(isAllowedHostname("uniquarter.co.nz.evil.com", env), false);
  assert.equal(isAllowedHostname("", env), false);
  assert.equal(isAllowedHostname(undefined, env), false);
  assert.equal(isAllowedHostname("localhost", env), false);
  assert.equal(isAllowedHostname("localhost", { ...env, DEV: "true" }), true);
});

test("an oversized request is refused from its declared size, without being read", async () => {
  const request = {
    headers: new Headers({ "Content-Type": "application/json", "Content-Length": "5000" }),
    arrayBuffer: async () => { throw new Error("the body was read"); },
  };
  assert.equal(await readJson(request), null);
});

test("the size limit counts bytes, not characters", async (t) => {
  const emails = fakeNetwork(t, { success: true, hostname: "uniquarter.co.nz" });
  // 3,000 characters, which would have passed a character count, but 6,000 bytes.
  const r = await subscribe(makeEnv(), { ...GOOD, firstName: "é".repeat(3000) });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "bad_request");
  assert.equal(emails.length, 0);
  // Just under the limit still works.
  assert.equal(await readJson(post({ pad: "a".repeat(4000) })) !== null, true);
});
