// إشعار أمني بعد تغيير بريد الدخول: شو تغيّر ومتى، وشو يعمل المستخدم إذا
// ما كان هو. يوصل للبريد القديم (OLD) والجديد. يُرسل من
// sendEmailChangeCompletedEmail في src/lib/email.ts.

import {
  C,
  DEFAULT_APP_URL,
  details,
  escapeHtml,
  formatAmmanTime,
  heading,
  lead,
  ltr,
  note,
  paragraph,
  renderEmailLayout,
  type RenderedEmail,
} from "@/lib/email/layout";

export function renderEmailChangeCompletedEmail({
  accountEmail,
  previousEmail,
  isOldEmail,
  changedAt = new Date(),
  supportEmail,
  appName = "Viresto",
  appUrl = DEFAULT_APP_URL,
}: {
  accountEmail: string;   // بريد الدخول الجديد
  previousEmail?: string; // البريد القديم إن كان معروفًا
  isOldEmail: boolean;    // هل الرسالة ذاهبة للبريد القديم
  changedAt?: Date;
  supportEmail: string;
  appName?: string;
  appUrl?: string;
}): RenderedEmail {
  const subject = `تم تغيير البريد الإلكتروني - ${appName}`;
  const when = formatAmmanTime(changedAt);
  const newEmail = escapeHtml(accountEmail);
  const support = escapeHtml(supportEmail);
  const supportLink = `<a href="mailto:${support}" style="color:${C.text};text-decoration:underline;">${ltr(support)}</a>`;

  const summary = isOldEmail
    ? "تم تغيير بريد الدخول لحسابك في Viresto. من الآن لن تستطيع الدخول بهذا البريد."
    : "تم اعتماد هذا البريد كبريد الدخول الجديد لحسابك في Viresto.";

  const rows: Array<[string, string]> = [];
  if (previousEmail) rows.push(["البريد السابق", ltr(escapeHtml(previousEmail))]);
  rows.push(["بريد الدخول الجديد", ltr(newEmail)], ["وقت التغيير", escapeHtml(when)]);

  const notYou = isOldEmail
    ? `إذا لم تكن أنت من غيّر البريد، فقد يكون أحد آخر دخل إلى حسابك. راسل الدعم فورًا على ${supportLink} أو بالرد على هذه الرسالة، وسنساعدك في استعادة الحساب.`
    : `إذا لم تكن أنت من طلب ذلك، راسل الدعم فورًا على ${supportLink} أو بالرد على هذه الرسالة.`;

  const html = renderEmailLayout({
    title: subject,
    preheader: isOldEmail
      ? `تم تغيير بريد الدخول لحسابك إلى ${accountEmail}.`
      : "تم اعتماد هذا البريد كبريد الدخول الجديد لحسابك.",
    appUrl,
    content: [
      heading("تم تغيير البريد الإلكتروني"),
      lead(summary),
      details(rows),
      paragraph(`<strong style="color:${C.text};">ما كان أنت؟</strong> ${notYou}`),
      note("لم يعد بإمكانك الدخول بالبريد القديم، وكلمة مرورك لم تتغير.", true),
    ].join(""),
  });

  const text = [
    "تم تغيير البريد الإلكتروني — Viresto",
    "",
    summary,
    ...(previousEmail ? [`البريد السابق: ${previousEmail}`] : []),
    `بريد الدخول الجديد: ${accountEmail}`,
    `وقت التغيير: ${when}`,
    "",
    isOldEmail
      ? `ما كان أنت؟ قد يكون أحد آخر دخل إلى حسابك. راسل الدعم فورًا على ${supportEmail} أو بالرد على هذه الرسالة.`
      : `ما كان أنت؟ راسل الدعم فورًا على ${supportEmail} أو بالرد على هذه الرسالة.`,
  ].join("\n");

  return { subject, html, text };
}
