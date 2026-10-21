// لمدراء النظام: مدير مكتب طلب حذف مكتبه (POST /api/data-requests/deletion).
// بيانات الطلب بجدول مرتب، وزر للوحة الإدارة. الإجراء: docs/data-requests.md.
// يُرسل من sendOfficeDeletionRequestEmail في src/lib/email.ts.

import {
  DEFAULT_APP_URL,
  baseUrl,
  button,
  details,
  escapeHtml,
  formatAmmanTime,
  heading,
  lead,
  ltr,
  note,
  renderEmailLayout,
  type RenderedEmail,
} from "@/lib/email/layout";

export function renderOfficeDeletionRequestEmail({
  officeName,
  officeSlug,
  tenantId,
  requestedByName,
  requestedByEmail,
  reason,
  requestedAt = new Date(),
  appName = "Viresto",
  appUrl = DEFAULT_APP_URL,
}: {
  officeName: string;
  officeSlug: string;
  tenantId: string;
  requestedByName: string;
  requestedByEmail: string;
  reason?: string | null;
  requestedAt?: Date;
  appName?: string;
  appUrl?: string;
}): RenderedEmail {
  const adminUrl = `${baseUrl(appUrl)}/admin?q=${encodeURIComponent(officeSlug)}`;
  const subject = `طلب حذف مكتب: ${officeName} - ${appName}`;
  const when = formatAmmanTime(requestedAt);
  const reasonText = reason?.trim() || "لم يُذكر سبب.";

  const html = renderEmailLayout({
    title: subject,
    preheader: `${requestedByName} طلب حذف المكتب ${officeName}. لم يُحذف شيء بعد.`,
    appUrl,
    content: [
      heading("طلب حذف مكتب"),
      lead("طلب مدير مكتب حذف مكتبه وكل بياناته. راجع الطلب قبل أي إجراء."),
      details([
        ["المكتب", escapeHtml(officeName)],
        ["المعرّف", ltr(`${escapeHtml(officeSlug)} · ${escapeHtml(tenantId)}`)],
        ["مقدّم الطلب", `${escapeHtml(requestedByName)}<br>${ltr(escapeHtml(requestedByEmail))}`],
        ["وقت الطلب", escapeHtml(when)],
        ["السبب", escapeHtml(reasonText)],
      ]),
      button(adminUrl, "فتح لوحة الإدارة"),
      note("لم يُحذف شيء بعد. اتبع الإجراء في docs/data-requests.md، والرد على هذه الرسالة يصل لمقدّم الطلب.", true),
    ].join(""),
  });

  const text = [
    "طلب حذف مكتب — Viresto",
    "",
    `المكتب: ${officeName}`,
    `المعرّف: ${officeSlug} · ${tenantId}`,
    `مقدّم الطلب: ${requestedByName} (${requestedByEmail})`,
    `وقت الطلب: ${when}`,
    `السبب: ${reasonText}`,
    "",
    `لوحة الإدارة: ${adminUrl}`,
    "لم يُحذف شيء بعد. الإجراء: docs/data-requests.md",
  ].join("\n");

  return { subject, html, text };
}
