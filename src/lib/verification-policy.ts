// How long each one-time code stays valid. The single source for the expiry
// the backend stores and checks, and for the email that tells the user.

// Email verification (createVerificationCode, src/lib/verification.ts).
export const EMAIL_VERIFICATION_TTL_MINUTES = 10;

// Changing the account email (src/app/api/auth/change-email/route.ts).
export const EMAIL_CHANGE_CODE_TTL_MINUTES = 10;

// Password reset (src/lib/password-reset.ts).
export const PASSWORD_RESET_CODE_TTL_MINUTES = 10;
