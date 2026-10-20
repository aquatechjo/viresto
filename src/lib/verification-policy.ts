// How long an email verification code (OTP) stays valid. The single source
// for createVerificationCode() (src/lib/verification.ts), which stores the
// expiry the backend checks, and for the email that tells the user.
export const EMAIL_VERIFICATION_TTL_MINUTES = 10;
