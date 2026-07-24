console.error(
  [
    "scripts/onboard-customer.js is intentionally disabled.",
    "Create the first office through the public /register flow so email",
    "verification, Turnstile, password validation, and legal consent are",
    "recorded consistently. Keep public registration disabled in production",
    "until the payment gateway and launch checks are complete.",
  ].join(" "),
);

process.exitCode = 1;
