import { externalFetch } from "@/lib/external-fetch";
import { COMPANY_CONTACT } from "@/config/contact";
import {
  getAppName,
  getAppUrl,
  getEmailFrom,
  getEmailReplyTo,
  isDemoRecipient,
} from "@/lib/email/config";
import { renderVerificationEmail } from "@/lib/email/verification-email";
import { renderPasswordResetEmail } from "@/lib/email/password-reset-email";
import { renderEmailChangeCodeEmail } from "@/lib/email/email-change-code-email";
import { renderEmailChangeCompletedEmail } from "@/lib/email/email-change-completed-email";
import { renderTeamInvitationEmail } from "@/lib/email/team-invitation-email";
import { renderOfficeDeletionRequestEmail } from "@/lib/email/office-deletion-request-email";

import { EmailDeliveryError, EmailNotConfiguredError } from "@/lib/email/errors";

export { EmailDeliveryError, EmailNotConfiguredError };

type SendVerificationEmailInput = {
  to: string;
  code: string;
};

export async function sendVerificationEmail({
  to,
  code,
}: SendVerificationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL VERIFICATION] to=${to} code=${code}`);
      return { skipped: true };
    }

    throw new EmailNotConfiguredError();
  }

  if (isDemoRecipient(to)) return { skipped: true };

  // Expiry text from the same constant the backend stores (see
  // src/lib/verification-policy.ts); the subject starts with the code so it
  // shows in the notification.
  const email = renderVerificationEmail({ code, appUrl: getAppUrl() });

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      reply_to: getEmailReplyTo(),
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new EmailDeliveryError(
      `Failed to send verification email: ${response.status} ${errorText}`,
      response.status,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

type SendPasswordResetEmailInput = {
  to: string;
  code: string;
};

export async function sendPasswordResetEmail({
  to,
  code,
}: SendPasswordResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Password reset code for ${to}: ${code}`);
      return { skipped: true };
    }

    throw new EmailNotConfiguredError();
  }

  if (isDemoRecipient(to)) return { skipped: true };

  const email = renderPasswordResetEmail({ code, appUrl: getAppUrl() });

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      reply_to: getEmailReplyTo(),
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new EmailDeliveryError(
      `Failed to send password reset email: ${response.status} ${errorText}`,
      response.status,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

type SendEmailChangeCodeInput = {
  to: string;
  code: string;
  stage: "OLD" | "NEW";
};

export async function sendEmailChangeCode({
  to,
  code,
  stage,
}: SendEmailChangeCodeInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL CHANGE ${stage}] to=${to} code=${code}`);
      return { skipped: true };
    }

    throw new EmailNotConfiguredError();
  }

  if (isDemoRecipient(to)) return { skipped: true };

  const email = renderEmailChangeCodeEmail({
    code,
    stage,
    appName: getAppName(),
    appUrl: getAppUrl(),
  });

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      reply_to: getEmailReplyTo(),
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new EmailDeliveryError(
      `Failed to send email change code: ${response.status} ${errorText}`,
      response.status,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

type SendEmailChangeCompletedInput = {
  to: string;
  accountEmail: string;
  previousEmail?: string;
  isOldEmail: boolean;
  changedAt?: Date;
};

export async function sendEmailChangeCompletedEmail({
  to,
  accountEmail,
  previousEmail,
  isOldEmail,
  changedAt = new Date(),
}: SendEmailChangeCompletedInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const message = isOldEmail
    ? `تم تغيير البريد الإلكتروني لحسابك إلى ${accountEmail}. إذا لم تنفذ هذه العملية، تواصل مع الدعم فورًا.`
    : `تم اعتماد ${accountEmail} كبريد الدخول الجديد لحسابك.`;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL CHANGE COMPLETED] to=${to} ${message}`);
      return { skipped: true };
    }

    throw new EmailNotConfiguredError();
  }

  if (isDemoRecipient(to)) return { skipped: true };

  const email = renderEmailChangeCompletedEmail({
    accountEmail,
    previousEmail,
    isOldEmail,
    changedAt,
    supportEmail: COMPANY_CONTACT.supportEmail,
    appName: getAppName(),
    appUrl: getAppUrl(),
  });

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      reply_to: getEmailReplyTo(),
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new EmailDeliveryError(
      `Failed to send email change completion notice: ${response.status} ${errorText}`,
      response.status,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

type SendTeamInvitationEmailInput = {
  to: string;
  inviteeName: string;
  tenantName: string;
  inviterName: string;
  token: string;
};

export async function sendTeamInvitationEmail({
  to,
  inviteeName,
  tenantName,
  inviterName,
  token,
}: SendTeamInvitationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const invitationUrl = `${getAppUrl()}/join-team?token=${encodeURIComponent(token)}`;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV TEAM INVITATION] to=${to} url=${invitationUrl}`);
      return { skipped: true };
    }

    throw new EmailNotConfiguredError();
  }

  if (isDemoRecipient(to)) return { skipped: true };

  const email = renderTeamInvitationEmail({
    inviteeName,
    tenantName,
    inviterName,
    token,
    appName: getAppName(),
    appUrl: getAppUrl(),
  });

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      reply_to: getEmailReplyTo(),
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new EmailDeliveryError(
      `Failed to send team invitation: ${response.status} ${errorText}`,
      response.status,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

type SendOfficeDeletionRequestEmailInput = {
  to: string[];
  officeName: string;
  officeSlug: string;
  tenantId: string;
  requestedByName: string;
  requestedByEmail: string;
  reason?: string | null;
};

// To the system admins when an office ADMIN asks for the office to be
// deleted (POST /api/data-requests/deletion). Procedure: docs/data-requests.md.
export async function sendOfficeDeletionRequestEmail({
  to,
  officeName,
  officeSlug,
  tenantId,
  requestedByName,
  requestedByEmail,
  reason,
}: SendOfficeDeletionRequestEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV OFFICE DELETION REQUEST] to=${to.join(",")} tenant=${tenantId}`);
      return { skipped: true };
    }

    throw new EmailNotConfiguredError();
  }

  if (isDemoRecipient(to)) return { skipped: true };

  const email = renderOfficeDeletionRequestEmail({
    officeName,
    officeSlug,
    tenantId,
    requestedByName,
    requestedByEmail,
    reason,
    appName: getAppName(),
    appUrl: getAppUrl(),
  });

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      reply_to: requestedByEmail,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new EmailDeliveryError(
      `Failed to send office deletion request email: ${response.status} ${errorText}`,
      response.status,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}
