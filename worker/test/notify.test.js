import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationEmail } from "../src/notify.js";

const ENV = { FROM: "UniQuarter <hello@news.uniquarter.co.nz>", NOTIFY_TO: "hello@uniquarter.co.nz" };
const STUDENT = { firstName: "Aroha", email: "aroha@example.co.nz", role: "student", institution: "uc" };

test("a new student's heads-up names them, their role and institution", () => {
  const m = notificationEmail(ENV, STUDENT, false);
  assert.deepEqual(m.to, ["hello@uniquarter.co.nz"]);
  assert.equal(m.from, ENV.FROM);
  assert.equal(m.subject, "New registration: Aroha (student)");
  assert.match(m.text, /^Someone new has registered/);
  assert.match(m.text, /Email: aroha@example\.co\.nz/);
  assert.match(m.text, /I am: A student/);
  assert.match(m.text, /Institution: University of Canterbury/);
});

test("a returning person is marked as registering again", () => {
  const m = notificationEmail(ENV, STUDENT, true);
  assert.equal(m.subject, "Registered again: Aroha (student)");
  assert.match(m.text, /already on the list/);
});

test("subjects read naturally for every role, and no institution line without one", () => {
  const subjects = {
    landlord: "landlord or property manager",
    institution: "tertiary institution",
    investor: "potential investor",
    other: "something else",
  };
  for (const [role, label] of Object.entries(subjects)) {
    const m = notificationEmail(ENV, { ...STUDENT, role, institution: "" }, false);
    assert.equal(m.subject, "New registration: Aroha (" + label + ")");
    assert.equal(m.text.includes("Institution:"), false, role);
  }
});
