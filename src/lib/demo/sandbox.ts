import { randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  encryptText,
  hashSearchValue,
  normalizeEmail,
  normalizePhone,
} from "@/lib/encryption";
import {
  sessionAbsoluteExpired,
  sessionExpired,
  userCanUseSession,
} from "@/lib/session-policy";
import { getTenantAccess } from "@/lib/tenant-access-server";
import { DEMO_TEAM, buildDemoSampleData, demoEmail } from "@/lib/demo/sample-data";

// Demo mode ("try with sample data"). A user whose office is on its in-app
// trial gets a sandbox office of their own (Tenant.isDemo) with a stand-in
// user in it, and a demo session that points back at their real session
// (Session.parentSessionId). Every existing tenant-scoped query then works
// unchanged inside the sandbox, so its data can never mix with the real
// office's. The rules (only during the trial, nothing billed or emailed)
// are enforced in api-auth.ts and request-path-policy.ts.

type Db = Prisma.TransactionClient | typeof prisma;

// Unguessable and unusable: never a bcrypt hash, so no password matches it.
const UNUSABLE_PASSWORD_HASH = "!demo-sandbox-user-cannot-log-in";

export type DemoOwner = {
  userId: string;
  tenantId: string;
  name: string;
};

/**
 * The owner's real office may use demo mode only while on its trial. Read
 * from the DB, never the per-instance access cache: a purchase synced on
 * another instance must end every demo session at once.
 */
export async function isOfficeOnTrial(tenantId: string) {
  const access = await getTenantAccess(tenantId);
  return access.state === "TRIAL";
}

export async function findDemoSandbox(ownerUserId: string, db: Db = prisma) {
  return db.tenant.findUnique({
    where: { demoOwnerUserId: ownerUserId },
    select: {
      id: true,
      demoOwnerTenantId: true,
      users: {
        where: { role: "ADMIN" },
        select: { id: true, email: true, name: true, role: true },
        take: 1,
      },
    },
  });
}

/**
 * Builds the sandbox office and its sample data in one transaction, so a
 * failure leaves nothing behind. Two concurrent first entries race on the
 * unique Tenant.demoOwnerUserId; the loser reuses the winner's sandbox.
 */
export async function createDemoSandbox(owner: DemoOwner) {
  const tenantId = randomUUID();
  const users = { admin: randomUUID(), lawyer: randomUUID(), staff: randomUUID() };
  const now = new Date();
  const ownerKey = owner.userId.slice(-12).toLowerCase();

  const sample = buildDemoSampleData({
    tenantId,
    users,
    now,
    newId: randomUUID,
    encrypt: (value) => encryptText(value)!,
    hash: (value) => hashSearchValue(value)!,
    normalizePhone,
    normalizeEmail,
  });

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.tenant.create({
          data: {
            id: tenantId,
            name: "مكتب تجريبي (بيانات وهمية)",
            slug: `demo-${randomBytes(8).toString("hex")}`,
            plan: "PRO",
            status: "ACTIVE",
            isDemo: true,
            demoOwnerTenantId: owner.tenantId,
            demoOwnerUserId: owner.userId,
            phone: "0700000000",
            email: demoEmail(`office-${ownerKey}`),
            address: "عمّان - الشميساني",
          },
        });

        const base = {
          tenantId,
          passwordHash: UNUSABLE_PASSWORD_HASH,
          emailVerifiedAt: now,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
          isActive: true,
        };

        await tx.user.createMany({
          data: [
            { ...base, id: users.admin, name: owner.name, role: "ADMIN", email: demoEmail(`owner-${ownerKey}`) },
            { ...base, id: users.lawyer, name: DEMO_TEAM.lawyer.name, role: DEMO_TEAM.lawyer.role, email: demoEmail(`lawyer-${ownerKey}`) },
            { ...base, id: users.staff, name: DEMO_TEAM.staff.name, role: DEMO_TEAM.staff.role, email: demoEmail(`staff-${ownerKey}`) },
          ],
        });

        await tx.client.createMany({ data: sample.clients });
        await tx.case.createMany({ data: sample.cases });
        await tx.caseMember.createMany({ data: sample.caseMembers });
        await tx.appointment.createMany({ data: sample.appointments });
        await tx.task.createMany({ data: sample.tasks });
        await tx.document.createMany({ data: sample.documents });
        await tx.invoice.createMany({ data: sample.invoices });
        await tx.invoiceItem.createMany({ data: sample.invoiceItems });
        await tx.payment.createMany({ data: sample.payments });
        await tx.invoiceSequence.create({ data: sample.invoiceSequence });
        await tx.activity.createMany({ data: sample.activities });
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2002") {
      const existing = await findDemoSandbox(owner.userId);
      if (existing) return existing;
    }
    throw error;
  }

  return findDemoSandbox(owner.userId);
}

/** Deletes one user's sandbox and all its data (every relation cascades). */
export async function deleteDemoSandboxForUser(ownerUserId: string, db: Db = prisma) {
  const result = await db.tenant.deleteMany({
    where: { demoOwnerUserId: ownerUserId, isDemo: true },
  });
  return result.count;
}

/** Deletes every sandbox of an office's users: on subscribe or trial end. */
export async function deleteDemoSandboxesForOffice(ownerTenantId: string, db: Db = prisma) {
  const result = await db.tenant.deleteMany({
    where: { demoOwnerTenantId: ownerTenantId, isDemo: true },
  });
  return result.count;
}

/**
 * Nightly cleanup: sandboxes whose owner's office is no longer on its trial
 * (subscribed, expired, suspended). Sandboxes of a deleted office or user
 * are already gone through the cascade. Their uploads become orphans that
 * cleanupOrphanUploads removes in the same cron.
 */
export async function cleanupDemoSandboxes() {
  const sandboxes = await prisma.tenant.findMany({
    where: { isDemo: true },
    select: { id: true, demoOwnerTenantId: true },
  });

  const ownerTenantIds = [...new Set(sandboxes.map((item) => item.demoOwnerTenantId))];
  const ended: string[] = [];

  for (const ownerTenantId of ownerTenantIds) {
    if (!ownerTenantId || !(await isOfficeOnTrial(ownerTenantId))) {
      ended.push(...sandboxes.filter((item) => item.demoOwnerTenantId === ownerTenantId).map((item) => item.id));
    }
  }

  if (ended.length === 0) return { checked: sandboxes.length, deleted: 0 };

  const result = await prisma.tenant.deleteMany({
    where: { id: { in: ended }, isDemo: true },
  });

  return { checked: sandboxes.length, deleted: result.count };
}

/** Opens a demo session for the sandbox user, under the real session. */
export async function openDemoSession(input: {
  sandboxTenantId: string;
  sandboxUser: { id: string; email: string; name: string; role: string };
  parentSessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const session = await prisma.session.create({
    data: {
      userId: input.sandboxUser.id,
      tenantId: input.sandboxTenantId,
      tokenHash: randomUUID(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      parentSessionId: input.parentSessionId,
      lastActivityAt: new Date(),
    },
    select: { id: true },
  });

  return signToken({
    userId: input.sandboxUser.id,
    tenantId: input.sandboxTenantId,
    email: input.sandboxUser.email,
    name: input.sandboxUser.name,
    role: input.sandboxUser.role,
    sessionId: session.id,
    isSystemAdmin: false,
    parentSessionId: input.parentSessionId,
  });
}

/**
 * The user's real session under a demo session, if it is still usable:
 * active, not idle or past its absolute limit, in a real (non-demo) office,
 * for a user who may still sign in. Null means they must log in again.
 */
export async function findUsableRealSession(parentSessionId: string | undefined | null) {
  if (!parentSessionId?.trim()) return null;

  const session = await prisma.session.findUnique({
    where: { id: parentSessionId },
    select: {
      id: true,
      userId: true,
      tenantId: true,
      isActive: true,
      lastActivityAt: true,
      createdAt: true,
      parentSessionId: true,
      user: {
        select: {
          id: true,
          tenantId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isSystemAdmin: true,
          emailVerifiedAt: true,
          tenant: { select: { isSuspended: true, status: true, isDemo: true } },
        },
      },
    },
  });

  if (
    !session ||
    !session.isActive ||
    session.parentSessionId ||
    session.user.tenant.isDemo ||
    sessionExpired(session.lastActivityAt) ||
    sessionAbsoluteExpired(session.createdAt) ||
    !userCanUseSession(session.user, session.tenantId)
  ) {
    return null;
  }

  return session;
}

/** A fresh token for the user's real session, or null (log in again). */
export async function restoreRealSession(parentSessionId: string | undefined | null) {
  const session = await findUsableRealSession(parentSessionId);
  if (!session) return null;

  return signToken({
    userId: session.user.id,
    tenantId: session.tenantId,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    sessionId: session.id,
    isSystemAdmin: session.user.isSystemAdmin,
  });
}

/** Ends a demo session (exit, reset, logout). */
export async function closeDemoSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, parentSessionId: { not: null } },
    data: { isActive: false },
  });
}
