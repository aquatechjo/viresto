// Local preview of every Viresto email with sample data (development only: a
// script, not a route, so nothing here is part of the Next.js build or the
// deployment).
//
//   npm run email:preview                       -> all emails, OTP 642332
//   npm run email:preview -- 123456             -> another OTP
//   npm run email:preview -- 642332 --no-images -> logo blocked (alt text)
//
// Writes .email-preview/<name>.html (+ .txt) and .email-preview/index.html
// linking them; open them in a browser and check 375px and 1280px wide.
// Links point at the real site; only the logo image is swapped for the
// local copy in public/ (it may not be deployed yet).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EMAIL_LOGO, type RenderedEmail } from "../src/lib/email/layout";
import { renderVerificationEmail } from "../src/lib/email/verification-email";
import { renderPasswordResetEmail } from "../src/lib/email/password-reset-email";
import { renderEmailChangeCodeEmail } from "../src/lib/email/email-change-code-email";
import { renderEmailChangeCompletedEmail } from "../src/lib/email/email-change-completed-email";
import { renderTeamInvitationEmail } from "../src/lib/email/team-invitation-email";
import { renderOfficeDeletionRequestEmail } from "../src/lib/email/office-deletion-request-email";

const args = process.argv.slice(2);
const code = args.find((arg) => !arg.startsWith("--")) ?? "642332";
const noImages = args.includes("--no-images");

const appUrl = "https://www.virestojo.com";
const siteLogo = `${appUrl}${EMAIL_LOGO.path}`;
// The local copy, or a URL that cannot load to see blocked images.
const previewLogo = noImages
  ? "https://images-blocked.invalid/logo.png"
  : pathToFileURL(path.resolve("public", EMAIL_LOGO.path.slice(1))).href;

const changedAt = new Date("2026-10-20T09:15:00Z");

const emails: Record<string, RenderedEmail> = {
  "verification": renderVerificationEmail({ code, appUrl }),
  "password-reset": renderPasswordResetEmail({ code, appUrl }),
  "email-change-code-old": renderEmailChangeCodeEmail({ code, stage: "OLD", appUrl }),
  "email-change-code-new": renderEmailChangeCodeEmail({ code, stage: "NEW", appUrl }),
  "email-change-completed-old": renderEmailChangeCompletedEmail({
    accountEmail: "new.address@example.com",
    previousEmail: "lawyer@example.com",
    isOldEmail: true,
    changedAt,
    supportEmail: "support@aquatechagency.com",
    appUrl,
  }),
  "email-change-completed-new": renderEmailChangeCompletedEmail({
    accountEmail: "new.address@example.com",
    previousEmail: "lawyer@example.com",
    isOldEmail: false,
    changedAt,
    supportEmail: "support@aquatechagency.com",
    appUrl,
  }),
  "team-invitation": renderTeamInvitationEmail({
    inviteeName: "سارة الخطيب",
    tenantName: "مكتب العبادي للمحاماة",
    inviterName: "محمد العبادي",
    token: "tok_9f2c7d1e4b8a6035c1e9d7f24a6b8c0d",
    appUrl,
  }),
  "office-deletion-request": renderOfficeDeletionRequestEmail({
    officeName: "مكتب العبادي للمحاماة",
    officeSlug: "alabbadi-law",
    tenantId: "cmvf8k2qw0001bf72ab12cd34",
    requestedByName: "محمد العبادي",
    requestedByEmail: "lawyer@example.com",
    reason: "أغلقنا المكتب وننقل الملفات لنظام آخر.",
    requestedAt: changedAt,
    appUrl,
  }),
};

const dir = path.resolve(".email-preview");
mkdirSync(dir, { recursive: true });

const links: string[] = [];
for (const [name, { subject, html, text }] of Object.entries(emails)) {
  writeFileSync(path.join(dir, `${name}.html`), html.replaceAll(siteLogo, previewLogo), "utf8");
  writeFileSync(path.join(dir, `${name}.txt`), `Subject: ${subject}\n\n${text}\n`, "utf8");
  links.push(`<li><a href="${name}.html">${name}</a> — ${subject} (<a href="${name}.txt">text</a>)</li>`);
  console.log(`${name.padEnd(28)} ${subject}`);
}

writeFileSync(
  path.join(dir, "index.html"),
  `<!DOCTYPE html><meta charset="utf-8"><title>Viresto emails</title><ul dir="rtl" style="font:16px/2 sans-serif">${links.join("")}</ul>`,
  "utf8",
);
console.log(`\nOpen: ${pathToFileURL(path.join(dir, "index.html")).href}`);
