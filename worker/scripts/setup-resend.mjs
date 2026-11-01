// One-off Resend setup: creates the contact properties the Worker writes and
// the "Register interest" segment, then prints the segment ID for the
// RESEND_SEGMENT_ID secret. Safe to run again; anything that exists is skipped.
//
//   RESEND_API_KEY=re_xxx node scripts/setup-resend.mjs

const API = "https://api.resend.com";
const KEY = process.env.RESEND_API_KEY;
const SEGMENT = "Register interest";
const PROPERTIES = ["role", "institution", "consented_at", "consent_version", "source"];

if (!KEY) {
  console.error("Set RESEND_API_KEY first.");
  process.exit(1);
}

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
      "User-Agent": "uniquarter-signup-setup/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

const existing = await call("GET", "/contact-properties");
const have = new Set((existing.data?.data || []).map((p) => p.key));
for (const key of PROPERTIES) {
  if (have.has(key)) {
    console.log("Property " + key + " already exists");
    continue;
  }
  const r = await call("POST", "/contact-properties", { key, type: "string" });
  console.log(r.ok ? "Created property " + key : "Could not create " + key + ": " + JSON.stringify(r.data));
}

const segments = await call("GET", "/segments");
let segment = (segments.data?.data || []).find((s) => s.name === SEGMENT);
if (segment) {
  console.log('Segment "' + SEGMENT + '" already exists');
} else {
  const r = await call("POST", "/segments", { name: SEGMENT });
  if (!r.ok) {
    console.error("Could not create the segment: " + JSON.stringify(r.data));
    process.exit(1);
  }
  segment = r.data;
  console.log('Created segment "' + SEGMENT + '"');
}
console.log("\nRESEND_SEGMENT_ID = " + segment.id);
