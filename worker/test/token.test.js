import { test } from "node:test";
import assert from "node:assert/strict";
import { importKey, sealToken, openToken, TokenError, TOKEN_LIFETIME_MS } from "../src/token.js";

const KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 9).toString("base64");
const NOW = Date.UTC(2026, 10, 1, 9, 0, 0);
const SIGNUP = { firstName: "Aroha", email: "aroha@example.co.nz", role: "student", institution: "uc", consentVersion: "2026-11-01", submittedAt: NOW };

async function rejectsWith(promise, reason) {
  await assert.rejects(promise, (e) => e instanceof TokenError && e.reason === reason);
}

test("a sealed token opens to the same sign-up", async () => {
  const key = await importKey(KEY);
  const token = await sealToken(SIGNUP, key);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(await openToken(token, key, NOW + 1000), SIGNUP);
});

test("the token does not show the email address", async () => {
  const token = await sealToken(SIGNUP, await importKey(KEY));
  assert.equal(token.includes("aroha"), false);
  assert.equal(Buffer.from(token, "base64url").toString("latin1").includes("aroha"), false);
});

test("two tokens for the same sign-up differ", async () => {
  const key = await importKey(KEY);
  assert.notEqual(await sealToken(SIGNUP, key), await sealToken(SIGNUP, key));
});

test("a token older than 24 hours is expired", async () => {
  const key = await importKey(KEY);
  const token = await sealToken(SIGNUP, key);
  await openToken(token, key, NOW + TOKEN_LIFETIME_MS);
  await rejectsWith(openToken(token, key, NOW + TOKEN_LIFETIME_MS + 1), "expired");
});

test("a token dated in the future is refused", async () => {
  const key = await importKey(KEY);
  const token = await sealToken({ ...SIGNUP, submittedAt: NOW + 60 * 60 * 1000 }, key);
  await rejectsWith(openToken(token, key, NOW), "invalid");
});

test("a changed character is refused", async () => {
  const key = await importKey(KEY);
  const token = await sealToken(SIGNUP, key);
  const i = Math.floor(token.length / 2);
  const tampered = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
  await rejectsWith(openToken(tampered, key, NOW), "invalid");
});

test("a token sealed with another key is refused", async () => {
  const token = await sealToken(SIGNUP, await importKey(OTHER_KEY));
  await rejectsWith(openToken(token, await importKey(KEY), NOW), "invalid");
});

test("a different key version is refused", async () => {
  const key = await importKey(KEY);
  const bytes = Buffer.from(await sealToken(SIGNUP, key), "base64url");
  bytes[0] = 2;
  await rejectsWith(openToken(bytes.toString("base64url"), key, NOW), "invalid");
});

test("rubbish is refused", async () => {
  const key = await importKey(KEY);
  for (const junk of ["", "abc", "not a token!", "A".repeat(80)]) {
    await rejectsWith(openToken(junk, key, NOW), "invalid");
  }
});

test("a key of the wrong length is refused", async () => {
  await assert.rejects(importKey(Buffer.alloc(16).toString("base64")));
});
