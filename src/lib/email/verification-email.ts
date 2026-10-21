// إيميل تأكيد البريد (رمز OTP). يُرسل من sendVerificationEmail في
// src/lib/email.ts، والشكل كله من القالب المشترك (./layout).

import { EMAIL_VERIFICATION_TTL_MINUTES } from "@/lib/verification-policy";
import {
  DEFAULT_APP_URL,
  codeBox,
  heading,
  lead,
  note,
  otpDigits,
  renderEmailLayout,
  type RenderedEmail,
} from "@/lib/email/layout";

export { EMAIL_LOGO } from "@/lib/email/layout";

type VerificationEmailInput = {
  code: string;          // "642332"
  minutes?: number;      // مدة الصلاحية (افتراضيًا نفس قيمة الباك إند)
  appUrl?: string;
};

export function renderVerificationEmail({
  code,
  minutes = EMAIL_VERIFICATION_TTL_MINUTES,
  appUrl = DEFAULT_APP_URL,
}: VerificationEmailInput): RenderedEmail {
  const digits = otpDigits(code);
  const subject = `${digits} رمز تأكيد بريدك في Viresto`;

  const html = renderEmailLayout({
    title: subject,
    preheader: `رمزك: ${digits} — صالح لمدة ${minutes} دقائق.`,
    appUrl,
    content: [
      heading("تأكيد البريد الإلكتروني"),
      lead("أدخل هذا الرمز في Viresto لتأكيد بريدك."),
      codeBox(digits),
      note(`ينتهي الرمز خلال ${minutes} دقائق. لا تشاركه مع أي شخص، فريق Viresto لن يطلبه منك.`, true),
      note("إذا لم تطلب هذا الرمز، تجاهل الرسالة."),
    ].join(""),
  });

  const text = [
    "تأكيد البريد الإلكتروني — Viresto",
    "",
    `رمز التأكيد: ${digits}`,
    `ينتهي خلال ${minutes} دقائق. لا تشاركه مع أي شخص.`,
    "إذا لم تطلب هذا الرمز، تجاهل الرسالة.",
  ].join("\n");

  return { subject, html, text };
}
