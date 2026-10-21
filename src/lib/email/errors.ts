// Errors thrown by the send helpers in src/lib/email.ts. Typed so callers can
// log what failed without logging the message, which carries Resend's
// response body (src/lib/email-send-log.ts). Kept apart from email.ts so
// tests that mock "@/lib/email" still get the real classes here.

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Missing RESEND_API_KEY");
    this.name = "EmailNotConfiguredError";
  }
}
