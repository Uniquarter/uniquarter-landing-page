// The confirmation token. Nothing is stored until someone confirms, so the
// sign-up details travel inside the link in the confirmation email, encrypted
// with AES-GCM so they can be neither read nor altered. The first byte is a key
// version, so the key can be replaced later without breaking links in flight.

export const KEY_VERSION = 1;
export const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export class TokenError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason; // "expired" or "invalid"
  }
}

export async function importKey(base64Key) {
  var raw = base64ToBytes(base64Key);
  if (raw.length !== 32) throw new Error("TOKEN_KEY must be 32 bytes, base64 encoded");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealToken(payload, key) {
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var version = new Uint8Array([KEY_VERSION]);
  var plain = new TextEncoder().encode(JSON.stringify(payload));
  var cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: version }, key, plain)
  );
  var out = new Uint8Array(1 + iv.length + cipher.length);
  out.set(version, 0);
  out.set(iv, 1);
  out.set(cipher, 1 + iv.length);
  return bytesToBase64Url(out);
}

export async function openToken(token, key, now) {
  if (now === undefined) now = Date.now();
  var bytes;
  try {
    bytes = base64UrlToBytes(token);
  } catch (e) {
    throw new TokenError("invalid");
  }
  if (bytes.length < 1 + 12 + 16 || bytes[0] !== KEY_VERSION) throw new TokenError("invalid");

  var payload;
  try {
    var plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(1, 13), additionalData: bytes.slice(0, 1) },
      key,
      bytes.slice(13)
    );
    payload = JSON.parse(new TextDecoder().decode(plain));
  } catch (e) {
    throw new TokenError("invalid");
  }

  if (typeof payload.submittedAt !== "number" || payload.submittedAt > now + CLOCK_SKEW_MS) {
    throw new TokenError("invalid");
  }
  if (now - payload.submittedAt > TOKEN_LIFETIME_MS) throw new TokenError("expired");
  return payload;
}

function bytesToBase64Url(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(text) {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("bad token");
  var b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return base64ToBytes(b64);
}

function base64ToBytes(b64) {
  var s = atob(b64);
  var out = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
