import { COMPANY_CONTACT } from "@/config/contact";
import { isDemoEmail } from "@/lib/demo/constants";

// Sender settings shared by every email we send through Resend
// (src/lib/email.ts and src/lib/welcome-email.ts). Kept out of email.ts so
// a module can use them while tests mock @/lib/email as a whole.

// Demo-mode sandbox users (src/lib/demo) have undeliverable addresses, and
// their routes that send email are blocked in api-auth.ts. This is the
// last line: nothing addressed to them ever reaches Resend.
export function isDemoRecipient(to: string | string[]) {
  return (Array.isArray(to) ? to : [to]).some(isDemoEmail);
}

export function getAppName() {
  return process.env.APP_NAME || "Viresto";
}

export function getEmailFrom() {
  return process.env.EMAIL_FROM || "Viresto <onboarding@resend.dev>";
}

export function getEmailReplyTo() {
  return process.env.EMAIL_REPLY_TO?.trim() || COMPANY_CONTACT.supportEmail;
}

export function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.virestojo.com"
  ).replace(/\/$/, "");
}
