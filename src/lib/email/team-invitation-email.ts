// دعوة عضو لفريق مكتب: زر bulletproof لقبول الدعوة، وتحته الرابط كنص.
// يُرسل من sendTeamInvitationEmail في src/lib/email.ts.

import { TEAM_INVITATION_TTL_HOURS } from "@/lib/team-invitations";
import {
  C,
  DEFAULT_APP_URL,
  baseUrl,
  button,
  escapeHtml,
  heading,
  lead,
  note,
  renderEmailLayout,
  type RenderedEmail,
} from "@/lib/email/layout";

export function renderTeamInvitationEmail({
  inviteeName,
  tenantName,
  inviterName,
  token,
  hours = TEAM_INVITATION_TTL_HOURS,
  appName = "Viresto",
  appUrl = DEFAULT_APP_URL,
}: {
  inviteeName: string;
  tenantName: string;
  inviterName: string;
  token: string;
  hours?: number;
  appName?: string;
  appUrl?: string;
}): RenderedEmail {
  const invitationUrl = `${baseUrl(appUrl)}/join-team?token=${encodeURIComponent(token)}`;
  const subject = `دعوة للانضمام إلى ${tenantName} - ${appName}`;

  const html = renderEmailLayout({
    title: subject,
    preheader: `${inviterName} دعاك للانضمام إلى ${tenantName} في Viresto.`,
    appUrl,
    content: [
      heading("دعوة للانضمام إلى فريق المكتب"),
      lead(
        `مرحبًا ${escapeHtml(inviteeName)}، دعاك ${escapeHtml(inviterName)} للانضمام إلى <strong style="color:${C.text};">${escapeHtml(tenantName)}</strong> في Viresto. اضغط الزر واختر كلمة مرورك بنفسك.`,
      ),
      button(invitationUrl, "قبول الدعوة"),
      note(`تنتهي صلاحية الدعوة خلال ${hours} ساعة.`, true),
      note("إذا لم تكن تتوقع هذه الدعوة، تجاهل الرسالة."),
    ].join(""),
  });

  const text = [
    "دعوة للانضمام إلى فريق المكتب — Viresto",
    "",
    `مرحبًا ${inviteeName}، دعاك ${inviterName} للانضمام إلى ${tenantName} في Viresto.`,
    "افتح الرابط واختر كلمة مرورك بنفسك:",
    invitationUrl,
    "",
    `تنتهي صلاحية الدعوة خلال ${hours} ساعة.`,
    "إذا لم تكن تتوقع هذه الدعوة، تجاهل الرسالة.",
  ].join("\n");

  return { subject, html, text };
}
