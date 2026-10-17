// Login rate limits (AUDIT_REPORT.md H4). A law office usually sits behind
// one public IP, so the per-IP budget must cover a whole office signing in
// at the start of the day; the per-account budget stays the real guard
// against password guessing.
//
// A 2FA login is two requests: email + password (answered with
// requiresTwoFactor), then the same with the 6-digit code. The code step
// draws from its own buckets, so the office's login budget counts a 2FA
// login once, and code guessing is held to a few tries per account.

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Step 1: email + password.
export const LOGIN_IP_LIMIT = {
  keyPrefix: "login",
  max: 30,
  windowMs: FIFTEEN_MINUTES,
} as const;

export const LOGIN_ACCOUNT_LIMIT = {
  keyPrefix: "login-account",
  max: 15,
  windowMs: FIFTEEN_MINUTES,
} as const;

// Step 2: the same credentials plus the authenticator code.
export const LOGIN_2FA_IP_LIMIT = {
  keyPrefix: "login-2fa",
  max: 30,
  windowMs: FIFTEEN_MINUTES,
} as const;

export const LOGIN_2FA_ACCOUNT_LIMIT = {
  keyPrefix: "login-2fa-account",
  max: 5,
  windowMs: FIFTEEN_MINUTES,
} as const;
