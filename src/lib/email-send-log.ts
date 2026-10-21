import { EmailDeliveryError } from "@/lib/email/errors";

// One log line per outcome for email flows that answer the client the same
// way whatever happened (forgot-password hides whether an account exists;
// the email-change notices run after the change is committed). Without
// these lines a missing email cannot be told apart from "no account".
//
// No personal data: no address, code, IP or user id. The Resend message id
// is enough to find the email in the Resend dashboard.
//
//   [EMAIL_SEND] flow=forgot-password outcome=sent message_id=4ef9…
//   [EMAIL_SEND] flow=forgot-password outcome=error error=EmailDeliveryError status=422

export type EmailFlow = "forgot-password" | "email-change-completed";

export type EmailOutcome =
  | "sent"
  | "skipped"
  | "no_active_user"
  | "rate_limited"
  | "error";

type LogFields = Record<string, string | number | undefined>;

export function logEmailOutcome(
  flow: EmailFlow,
  outcome: EmailOutcome,
  fields: LogFields = {},
) {
  const parts = [`[EMAIL_SEND] flow=${flow} outcome=${outcome}`];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) parts.push(`${key}=${value}`);
  }

  const line = parts.join(" ");

  if (outcome === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}

// What a send helper in src/lib/email.ts resolved with: { id } from Resend,
// or { skipped: true } (no API key outside production, or a demo address).
export function describeSendResult(result: unknown): {
  outcome: "sent" | "skipped";
  fields: LogFields;
} {
  if (result && typeof result === "object") {
    if ((result as { skipped?: unknown }).skipped === true) {
      return { outcome: "skipped", fields: {} };
    }

    const id = (result as { id?: unknown }).id;
    if (typeof id === "string" && id) {
      return { outcome: "sent", fields: { message_id: id } };
    }
  }

  return { outcome: "sent", fields: { message_id: "unknown" } };
}

// The error's type only. Messages are left out: Resend's error bodies and
// Prisma's messages can echo the recipient or query values.
export function describeError(error: unknown): LogFields {
  if (error instanceof EmailDeliveryError) {
    return { error: error.name, status: error.status };
  }

  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      error: error.name,
      code: typeof code === "string" && /^[A-Z0-9_]{1,32}$/.test(code) ? code : undefined,
    };
  }

  return { error: typeof error };
}
