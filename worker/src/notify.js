// The heads-up email to the team when someone confirms. Plain text, so it
// reads the same in any mail app. The labels match the form's wording.

const ROLE_LABELS = {
  student: "A student",
  landlord: "A landlord or property manager",
  institution: "From a tertiary institution",
  investor: "A potential investor",
  other: "Something else",
};

const INSTITUTION_LABELS = {
  uc: "University of Canterbury",
  ara: "Ara Institute of Canterbury",
  lincoln: "Lincoln University",
  other: "Another institution",
};

export function notificationEmail(env, signup, returning) {
  var role = ROLE_LABELS[signup.role] || signup.role;
  var lines = [
    returning
      ? "Someone already on the list has registered their interest again."
      : "Someone new has registered their interest in UniQuarter.",
    "",
    "Name: " + signup.firstName,
    "Email: " + signup.email,
    "I am: " + role,
  ];
  if (signup.institution) lines.push("Institution: " + (INSTITUTION_LABELS[signup.institution] || signup.institution));
  lines.push("", "Everyone on the list is in Resend, under Contacts.");

  return {
    from: env.FROM,
    to: [env.NOTIFY_TO],
    subject: (returning ? "Registered again: " : "New registration: ") + signup.firstName + " (" + role.replace(/^(A|From a) /, "").toLowerCase() + ")",
    text: lines.join("\n"),
  };
}
