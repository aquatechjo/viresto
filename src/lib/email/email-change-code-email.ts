// رمز تغيير البريد (OTP): مرة للبريد الحالي (OLD) لتأكيد الطلب، ومرة للبريد
// الجديد (NEW) لإثبات ملكيته. يُرسل من sendEmailChangeCode في src/lib/email.ts.

import { EMAIL_CHANGE_CODE_TTL_MINUTES } from "@/lib/verification-policy";
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

const COPY = {
  OLD: {
    title: "تأكيد طلب تغيير البريد الإلكتروني",
    description: "وصلنا طلب لتغيير البريد الإلكتروني المرتبط بحسابك. استخدم هذا الرمز للمتابعة.",
    ignore: "إذا لم تطلب تغيير بريدك، لا تشارك الرمز مع أحد وغيّر كلمة مرورك؛ بريدك لن يتغير بدون هذا الرمز.",
  },
  NEW: {
    title: "تأكيد البريد الإلكتروني الجديد",
    description: "استخدم هذا الرمز لتأكيد أن هذا البريد الإلكتروني الجديد يعود إليك.",
    ignore: "إذا لم تطلب ربط هذا البريد بحساب في Viresto، تجاهل الرسالة.",
  },
} as const;

export function renderEmailChangeCodeEmail({
  code,
  stage,
  appName = "Viresto",
  minutes = EMAIL_CHANGE_CODE_TTL_MINUTES,
  appUrl = DEFAULT_APP_URL,
}: {
  code: string;
  stage: "OLD" | "NEW";
  appName?: string;
  minutes?: number;
  appUrl?: string;
}): RenderedEmail {
  const digits = otpDigits(code);
  const copy = COPY[stage];
  // الرمز بأول العنوان عشان يبين بالإشعار؛ باقي العنوان كما كان.
  const subject = `${digits} ${copy.title} - ${appName}`;

  const html = renderEmailLayout({
    title: subject,
    preheader: `رمز التحقق: ${digits} — صالح لمدة ${minutes} دقائق.`,
    appUrl,
    content: [
      heading(copy.title),
      lead(copy.description),
      codeBox(digits),
      note(`ينتهي الرمز خلال ${minutes} دقائق. لا تشاركه مع أي شخص، فريق Viresto لن يطلبه منك.`, true),
      note(copy.ignore),
    ].join(""),
  });

  const text = [
    `${copy.title} — Viresto`,
    "",
    copy.description,
    `رمز التحقق: ${digits}`,
    `ينتهي خلال ${minutes} دقائق. لا تشاركه مع أي شخص.`,
    copy.ignore,
  ].join("\n");

  return { subject, html, text };
}
