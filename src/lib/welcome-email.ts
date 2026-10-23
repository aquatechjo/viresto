import { prisma } from "@/lib/prisma";
import { externalFetch } from "@/lib/external-fetch";
import { reportError } from "@/lib/monitoring";
import { EmailDeliveryError, EmailNotConfiguredError } from "@/lib/email/errors";
import { getEmailFrom, getEmailReplyTo, isDemoRecipient } from "@/lib/email/config";
import { DEFAULT_APP_URL } from "@/lib/email/layout";
import { renderWelcomeEmail } from "@/lib/email/welcome-email";
import { describeError, describeSendResult, logEmailOutcome } from "@/lib/email-send-log";

// The welcome email for a new office (rendered in src/lib/email/welcome-email.ts),
// sent once per office, to its founder, on the founder's first successful
// email verification (POST /api/auth/verify-email). Not at registration:
// until then the address is unconfirmed and could belong to someone else.

// The dashboard link is built from the public app URL.
function getDashboardAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;
}

/** One Resend call. */
export async function sendWelcomeEmail({
  to,
  tenantId,
  userName,
  officeName,
  trialEndsAt,
}: {
  to: string;
  tenantId: string;
  userName: string | null;
  officeName: string | null;
  trialEndsAt: Date;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV WELCOME EMAIL] to=${to} office=${officeName ?? ""}`);
      return { skipped: true };
    }

    throw new EmailNotConfiguredError();
  }

  if (isDemoRecipient(to)) return { skipped: true };

  const email = renderWelcomeEmail({
    userName,
    officeName,
    trialEndsAt,
    appUrl: getDashboardAppUrl(),
  });

  const response = await externalFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Second guard inside Resend (keys live 24 hours); the first is the
      // welcomeEmailSentAt claim below.
      "Idempotency-Key": `welcome/${tenantId}`,
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
      `Failed to send welcome email: ${response.status} ${errorText}`,
      response.status,
    );
  }

  return response.json().catch(() => ({ ok: true }));
}

/**
 * Called after a user's email is verified for the first time. Sends only
 * when that user founded the office (its first user, created with it at
 * registration; team members join later) and the office has not had its
 * welcome email yet. Never throws: a failed send is logged and reported to
 * Sentry, and the claim is released.
 */
export async function sendWelcomeEmailAfterVerification({
  userId,
  tenantId,
}: {
  userId: string;
  tenantId: string;
}) {
  let claimedAt: Date | null = null;

  try {
    const founder = await prisma.user.findFirst({
      where: { tenantId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, email: true },
    });

    if (!founder || founder.id !== userId) return;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, isDemo: true, trialEndsAt: true, welcomeEmailSentAt: true },
    });

    if (!tenant || tenant.isDemo || tenant.welcomeEmailSentAt) return;

    // The email is about the trial; without an end date there is nothing
    // true to put in it. Every registered office has one.
    if (!tenant.trialEndsAt) {
      logEmailOutcome("welcome", "skipped", { reason: "no_trial_end" });
      return;
    }

    // Claim: of two concurrent verifications only one changes the row.
    const now = new Date();
    const claim = await prisma.tenant.updateMany({
      where: { id: tenantId, welcomeEmailSentAt: null },
      data: { welcomeEmailSentAt: now },
    });

    if (claim.count !== 1) return;
    claimedAt = now;

    const result = await sendWelcomeEmail({
      to: founder.email,
      tenantId,
      userName: founder.name,
      officeName: tenant.name,
      trialEndsAt: tenant.trialEndsAt,
    });

    const { outcome, fields } = describeSendResult(result);
    logEmailOutcome("welcome", outcome, fields);

    // Nothing went out (no API key outside production, or a demo
    // address): leave the office unclaimed.
    if (outcome === "skipped") await releaseClaim(tenantId, claimedAt);
  } catch (error) {
    logEmailOutcome("welcome", "error", describeError(error));
    reportError(error, { area: "email", flow: "welcome" });

    if (claimedAt) {
      await releaseClaim(tenantId, claimedAt).catch((releaseError) => {
        reportError(releaseError, { area: "email", flow: "welcome-release" });
      });
    }
  }
}

function releaseClaim(tenantId: string, claimedAt: Date) {
  return prisma.tenant.updateMany({
    where: { id: tenantId, welcomeEmailSentAt: claimedAt },
    data: { welcomeEmailSentAt: null },
  });
}
