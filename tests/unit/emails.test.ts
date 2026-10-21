import assert from "node:assert/strict";
import test from "node:test";
import type { RenderedEmail } from "../../src/lib/email/layout";
import { renderPasswordResetEmail } from "../../src/lib/email/password-reset-email";
import { renderEmailChangeCodeEmail } from "../../src/lib/email/email-change-code-email";
import { renderEmailChangeCompletedEmail } from "../../src/lib/email/email-change-completed-email";
import { renderTeamInvitationEmail } from "../../src/lib/email/team-invitation-email";
import { renderOfficeDeletionRequestEmail } from "../../src/lib/email/office-deletion-request-email";
import { renderVerificationEmail } from "../../src/lib/email/verification-email";
import {
  EMAIL_CHANGE_CODE_TTL_MINUTES,
  PASSWORD_RESET_CODE_TTL_MINUTES,
} from "../../src/lib/verification-policy";
import { TEAM_INVITATION_TTL_HOURS } from "../../src/lib/team-invitations";

const APP = "https://www.virestojo.com";
const WHEN = new Date("2026-10-20T09:15:00Z");

/** The OTP cell: dir=ltr + nowrap so the code never wraps. */
function codeCell(html: string, digits: string) {
  const at = html.indexOf('class="code"');
  assert.ok(at > 0, "has a code box");
  return html.slice(html.lastIndexOf("<td", at), html.indexOf(digits, at) + digits.length);
}

const all: Array<[string, RenderedEmail]> = [
  ["verification", renderVerificationEmail({ code: "642332", appUrl: APP })],
  ["password reset", renderPasswordResetEmail({ code: "642332", appUrl: APP })],
  ["email change code (old)", renderEmailChangeCodeEmail({ code: "642332", stage: "OLD", appUrl: APP })],
  ["email change code (new)", renderEmailChangeCodeEmail({ code: "642332", stage: "NEW", appUrl: APP })],
  ["email change completed", renderEmailChangeCompletedEmail({
    accountEmail: "new@example.com", previousEmail: "old@example.com", isOldEmail: true,
    changedAt: WHEN, supportEmail: "support@example.com", appUrl: APP,
  })],
  ["team invitation", renderTeamInvitationEmail({
    inviteeName: "سارة", tenantName: "مكتب العبادي", inviterName: "محمد", token: "tok_1", appUrl: APP,
  })],
  ["office deletion request", renderOfficeDeletionRequestEmail({
    officeName: "مكتب العبادي", officeSlug: "alabbadi", tenantId: "t1",
    requestedByName: "محمد", requestedByEmail: "m@example.com", reason: "إغلاق", requestedAt: WHEN, appUrl: APP,
  })],
];

for (const [name, email] of all) {
  test(`${name}: the shared dark layout, logo and a text part`, () => {
    assert.match(email.html, /<html lang="ar" dir="rtl"/);
    assert.match(email.html, /<meta name="color-scheme" content="dark">/);
    assert.match(email.html, /border-top:3px solid #b87333/);
    assert.match(email.html, /<img src="https:\/\/www\.virestojo\.com\/email\/viresto-logo\.png"[^>]*alt="Viresto"/);
    assert.match(email.html, /mso-hide:all/, "preheader");
    assert.doesNotMatch(email.html, /#f3f7f6|#ffffff|background:#fff\b/i, "no old light style");
    assert.ok(email.text.trim().length > 20, "text part");
  });
}

test("password reset: an OTP, code first in the subject, expiry from its constant", () => {
  const { subject, html, text } = renderPasswordResetEmail({ code: "642332" });
  assert.equal(subject, "642332 رمز إعادة تعيين كلمة المرور - Viresto");
  const cell = codeCell(html, "642332");
  assert.match(cell, /dir="ltr"/);
  assert.match(cell, /white-space:nowrap/);
  assert.ok(html.includes(`ينتهي الرمز خلال ${PASSWORD_RESET_CODE_TTL_MINUTES} دقائق`));
  assert.match(text, /رمز إعادة التعيين: 642332/);
});

test("email change code: both stages, code first, the old subject after it", () => {
  for (const [stage, title] of [
    ["OLD", "تأكيد طلب تغيير البريد الإلكتروني"],
    ["NEW", "تأكيد البريد الإلكتروني الجديد"],
  ] as const) {
    const { subject, html, text } = renderEmailChangeCodeEmail({ code: "642332", stage });
    assert.equal(subject, `642332 ${title} - Viresto`);
    assert.match(codeCell(html, "642332"), /white-space:nowrap/);
    assert.ok(html.includes(`ينتهي الرمز خلال ${EMAIL_CHANGE_CODE_TTL_MINUTES} دقائق`));
    assert.match(text, /رمز التحقق: 642332/);
  }
});

test("email change completed: what changed, when, and what to do if it was not you", () => {
  const { subject, html, text } = renderEmailChangeCompletedEmail({
    accountEmail: "new@example.com",
    previousEmail: "old@example.com",
    isOldEmail: true,
    changedAt: WHEN,
    supportEmail: "support@example.com",
  });

  assert.equal(subject, "تم تغيير البريد الإلكتروني - Viresto");
  assert.ok(html.includes("old@example.com") && html.includes("new@example.com"));
  assert.ok(html.includes("12:15") && html.includes("بتوقيت عمّان"), "the time, in Amman");
  assert.match(html, /ما كان أنت؟/);
  assert.match(html, /href="mailto:support@example\.com"/);
  assert.match(text, /وقت التغيير: .*12:15/);
  assert.match(text, /support@example\.com/);
});

test("team invitation: a bulletproof button, the link as text, expiry from its constant", () => {
  const { subject, html, text } = renderTeamInvitationEmail({
    inviteeName: "سارة",
    tenantName: "مكتب العبادي",
    inviterName: "محمد",
    token: "tok/1 2",
    appUrl: `${APP}/`,
  });
  const url = "https://www.virestojo.com/join-team?token=tok%2F1%202";

  assert.equal(subject, "دعوة للانضمام إلى مكتب العبادي - Viresto");
  // Table-based button: a coloured cell (bgcolor + background) around the link.
  assert.match(html, /<td align="center" bgcolor="#b87333" style="background:#b87333;[^"]*">\s*<a href="https:\/\/www\.virestojo\.com\/join-team\?token=tok%2F1%202"/);
  assert.ok(html.includes(`>${url}</a>`), "the link as text to copy");
  assert.ok(html.includes(`خلال ${TEAM_INVITATION_TTL_HOURS} ساعة`));
  assert.ok(text.includes(url));
});

test("office deletion request: the request's details laid out, and the admin link", () => {
  const { subject, html, text } = renderOfficeDeletionRequestEmail({
    officeName: "مكتب العبادي",
    officeSlug: "alabbadi",
    tenantId: "t1",
    requestedByName: "محمد",
    requestedByEmail: "m@example.com",
    reason: "إغلاق المكتب",
    requestedAt: WHEN,
  });

  assert.equal(subject, "طلب حذف مكتب: مكتب العبادي - Viresto");
  for (const label of ["المكتب", "المعرّف", "مقدّم الطلب", "وقت الطلب", "السبب"]) {
    assert.ok(html.includes(`>${label}</div>`), label);
  }
  assert.ok(html.includes("alabbadi · t1") && html.includes("إغلاق المكتب"));
  assert.match(html, /href="https:\/\/www\.virestojo\.com\/admin\?q=alabbadi"/);
  assert.match(text, /لوحة الإدارة: https:\/\/www\.virestojo\.com\/admin\?q=alabbadi/);
  assert.match(text, /لم يُحذف شيء بعد/);
});

test("values from users are escaped in every email", () => {
  const evil = `<img src=x onerror=alert(1)>"`;
  const htmls = [
    renderEmailChangeCompletedEmail({
      accountEmail: evil, previousEmail: evil, isOldEmail: true, supportEmail: "s@example.com",
    }).html,
    renderTeamInvitationEmail({ inviteeName: evil, tenantName: evil, inviterName: evil, token: evil }).html,
    renderOfficeDeletionRequestEmail({
      officeName: evil, officeSlug: evil, tenantId: evil, requestedByName: evil, requestedByEmail: evil, reason: evil,
    }).html,
  ];

  for (const html of htmls) {
    assert.ok(!html.includes("<img src=x"), "no injected tag");
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "shown as text");
  }
});
