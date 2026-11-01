// Checks a sign-up before anything is sent. The lists here must match the
// radio buttons and the institution select in index.html.

export const ROLES = ["student", "landlord", "institution", "investor", "other"];
export const INSTITUTIONS = ["uc", "ara", "lincoln", "other"];

// Institution is kept only for these roles, so nobody else's record carries it.
const ROLES_WITH_INSTITUTION = ["student", "institution"];

const EMAIL = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]{2,}$/;

// The first name is the only free text, so it is kept short and plain. Anything
// that looks like a link or markup is refused, so the form can't be used to
// carry spam.
const NAME_REFUSED = /[<>@\\{}[\]]|:\/\/|www\.|\.(com|net|org|nz|io|co|ru|xyz)\b/i;

export function validateSignup(input) {
  var errors = [];
  var body = input && typeof input === "object" ? input : {};

  var firstName = typeof body.firstName === "string" ? body.firstName.replace(/\s+/g, " ").trim() : "";
  if (!firstName || firstName.length > 50 || NAME_REFUSED.test(firstName) || /[\u0000-\u001f\u007f]/.test(firstName)) {
    errors.push("firstName");
  }

  var email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) errors.push("email");

  var role = typeof body.role === "string" ? body.role : "";
  if (ROLES.indexOf(role) === -1) errors.push("role");

  var institution = typeof body.institution === "string" ? body.institution : "";
  if (institution && INSTITUTIONS.indexOf(institution) === -1) errors.push("institution");
  if (ROLES_WITH_INSTITUTION.indexOf(role) === -1) institution = "";

  if (errors.length) return { ok: false, errors: errors };
  return { ok: true, value: { firstName: firstName, email: email, role: role, institution: institution } };
}
