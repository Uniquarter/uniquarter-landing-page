import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSignup, ROLES, INSTITUTIONS } from "../src/validate.js";
import { isAllowedOrigin } from "../src/index.js";

const GOOD = { firstName: "Aroha", email: "Aroha@Example.co.nz", role: "student", institution: "uc" };

test("a good sign-up passes and the email is lower-cased", () => {
  const r = validateSignup(GOOD);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { firstName: "Aroha", email: "aroha@example.co.nz", role: "student", institution: "uc" });
});

test("the name is trimmed and its spaces tidied", () => {
  assert.equal(validateSignup({ ...GOOD, firstName: "  Mary   Jane " }).value.firstName, "Mary Jane");
  assert.equal(validateSignup({ ...GOOD, firstName: "Mary\nJane" }).value.firstName, "Mary Jane");
});

test("names with hyphens, apostrophes and macrons pass", () => {
  for (const firstName of ["Anne-Marie", "O'Neill", "Tāne", "Zoë", "李"]) {
    assert.equal(validateSignup({ ...GOOD, firstName }).ok, true, firstName);
  }
});

test("names that look like links or markup are refused", () => {
  for (const firstName of ["", " ", "x".repeat(51), "<b>hi</b>", "visit www.spam", "spam.com", "http://x", "a@b", "bell\u0007"]) {
    assert.deepEqual(validateSignup({ ...GOOD, firstName }).errors, ["firstName"], JSON.stringify(firstName));
  }
});

test("bad email addresses are refused", () => {
  for (const email of ["", "aroha", "aroha@", "@example.co.nz", "aroha@example", "a b@example.co.nz", "a<b>@example.co.nz", "a".repeat(250) + "@x.nz"]) {
    assert.deepEqual(validateSignup({ ...GOOD, email }).errors, ["email"], email);
  }
});

test("only the listed roles pass", () => {
  for (const role of ROLES) assert.equal(validateSignup({ ...GOOD, role }).ok, true, role);
  assert.deepEqual(validateSignup({ ...GOOD, role: "admin" }).errors, ["role"]);
  assert.deepEqual(validateSignup({ ...GOOD, role: undefined }).errors, ["role"]);
});

test("institution is optional and only from the list", () => {
  for (const institution of INSTITUTIONS) assert.equal(validateSignup({ ...GOOD, institution }).ok, true);
  assert.equal(validateSignup({ ...GOOD, institution: "" }).value.institution, "");
  assert.deepEqual(validateSignup({ ...GOOD, institution: "harvard" }).errors, ["institution"]);
});

test("institution is dropped for roles that don't need it", () => {
  assert.equal(validateSignup({ ...GOOD, role: "institution" }).value.institution, "uc");
  for (const role of ["landlord", "investor", "other"]) {
    assert.equal(validateSignup({ ...GOOD, role }).value.institution, "", role);
  }
});

test("every problem is reported at once", () => {
  assert.deepEqual(validateSignup({}).errors, ["firstName", "email", "role"]);
  assert.deepEqual(validateSignup(null).errors, ["firstName", "email", "role"]);
});

test("only the live site's addresses are allowed, and localhost only in development", () => {
  const env = { ALLOWED_ORIGINS: "https://uniquarter.co.nz,https://www.uniquarter.co.nz" };
  assert.equal(isAllowedOrigin("https://uniquarter.co.nz", env), true);
  assert.equal(isAllowedOrigin("https://www.uniquarter.co.nz", env), true);
  assert.equal(isAllowedOrigin("https://uniquarter.co.nz.evil.com", env), false);
  assert.equal(isAllowedOrigin("", env), false);
  assert.equal(isAllowedOrigin("http://localhost:8000", env), false);
  assert.equal(isAllowedOrigin("http://localhost:8000", { ...env, DEV: "true" }), true);
  assert.equal(isAllowedOrigin("http://localhost.evil.com", { ...env, DEV: "true" }), false);
});
