// إيميل إعادة تعيين كلمة المرور: رمز OTP (مش رابط) يدخله المستخدم بصفحة
// إعادة التعيين. يُرسل من sendPasswordResetEmail في src/lib/email.ts.

import { PASSWORD_RESET_CODE_TTL_MINUTES } from "@/lib/verification-policy";
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

export function renderPasswordResetEmail({
  code,
  minutes = PASSWORD_RESET_CODE_TTL_MINUTES,
  appUrl = DEFAULT_APP_URL,
}: {
  code: string;
  minutes?: number;
  appUrl?: string;
}): RenderedEmail {
  const digits = otpDigits(code);
  // الرمز بأول العنوان عشان يبين بالإشعار؛ باقي العنوان كما كان.
  const subject = `${digits} رمز إعادة تعيين كلمة المرور - Viresto`;

  const html = renderEmailLayout({
    title: subject,
    preheader: `رمز إعادة التعيين: ${digits} — صالح لمدة ${minutes} دقائق.`,
    appUrl,
    content: [
      heading("إعادة تعيين كلمة المرور"),
      lead("أدخل هذا الرمز في صفحة إعادة تعيين كلمة المرور في Viresto."),
      codeBox(digits),
      note(`ينتهي الرمز خلال ${minutes} دقائق. لا تشاركه مع أي شخص، فريق Viresto لن يطلبه منك.`, true),
      note("إذا لم تطلب تغيير كلمة المرور، تجاهل الرسالة؛ كلمة مرورك الحالية لم تتغير."),
    ].join(""),
  });

  const text = [
    "إعادة تعيين كلمة المرور — Viresto",
    "",
    `رمز إعادة التعيين: ${digits}`,
    `ينتهي خلال ${minutes} دقائق. لا تشاركه مع أي شخص.`,
    "إذا لم تطلب تغيير كلمة المرور، تجاهل الرسالة؛ كلمة مرورك الحالية لم تتغير.",
  ].join("\n");

  return { subject, html, text };
}
