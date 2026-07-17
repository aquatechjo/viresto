import { NextRequest } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanCreate } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import { sendTeamInvitationEmail } from "@/lib/email";
import {
  createTeamInvitationToken,
  isTeamInvitationActive,
  teamInvitationExpiresAt,
} from "@/lib/team-invitations";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

const allowedRoles = [UserRole.ADMIN, UserRole.LAWYER, UserRole.STAFF] as const;

function normalizeRole(value: unknown): UserRole | null {
  const role = String(value ?? "").trim().toUpperCase() as UserRole;
  return allowedRoles.includes(role) ? role : null;
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const mode = new URL(req.url).searchParams.get("mode");
    const auth = await requireRole(
      req,
      mode === "assignees"
        ? ["ADMIN", "LAWYER", "STAFF"]
        : ["ADMIN"],
    );
    if (auth.error || !auth.user) return auth.error;

    if (mode === "assignees") {
      const members = await prisma.user.findMany({
        where: {
          tenantId: auth.user.tenantId,
          isActive: true,
        },
        orderBy: [
          { isSystemAdmin: "desc" },
          { role: "asc" },
          { name: "asc" },
        ],
        select: {
          id: true,
          name: true,
          role: true,
          isSystemAdmin: true,
        },
      });

      return ok({
        currentUserId: auth.user.userId,
        currentRole: auth.user.role,
        members,
      });
    }

    const now = new Date();
    const [tenant, users, pendingInvitations] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: auth.user.tenantId },
        select: { maxUsers: true },
      }),
      prisma.user.findMany({
        where: { tenantId: auth.user.tenantId },
        orderBy: [{ isSystemAdmin: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isSystemAdmin: true,
          createdAt: true,
        },
      }),
      prisma.teamInvitation.findMany({
        where: {
          tenantId: auth.user.tenantId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
    ]);

    return ok({
      currentRole: auth.user.role,
      users,
      pendingInvitations,
      seats: {
        used: users.filter((user) => user.isActive).length,
        pending: pendingInvitations.length,
        limit: tenant?.maxUsers ?? null,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = normalizeRole(body.role);

    if (!name || !email || !role) {
      return err("الاسم والبريد والصلاحية مطلوبة", 400);
    }

    if (name.length < 2 || name.length > 100) {
      return err("اسم المستخدم غير صالح", 400);
    }

    if (
      email.length > 160 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return err("البريد الإلكتروني غير صالح", 400);
    }

    const { token, tokenHash } = createTeamInvitationToken();
    const expiresAt = teamInvitationExpiresAt();

    const createInvitation = () => prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, auth.user.tenantId);

      const lockedLimitCheck = await assertTenantCanCreate(
        auth.user.tenantId,
        "users",
        tx,
      );

      if (!lockedLimitCheck.ok) {
        return {
          error: "LIMIT" as const,
          limitCheck: lockedLimitCheck,
        };
      }

      const [tenant, existingUser, existingInvitationRecord] = await Promise.all([
        tx.tenant.findUnique({
          where: { id: auth.user.tenantId },
          select: { id: true, name: true, maxUsers: true },
        }),
        tx.user.findUnique({
          where: { email },
          select: { id: true },
        }),
        tx.teamInvitation.findUnique({
          where: { email },
          select: {
            id: true,
            tenantId: true,
            acceptedAt: true,
            revokedAt: true,
            expiresAt: true,
          },
        }),
      ]);

      if (!tenant) return { error: "TENANT_NOT_FOUND" as const };
      if (existingUser) return { error: "EMAIL_IN_USE" as const };

      let existingInvitation = existingInvitationRecord;

      if (
        existingInvitation &&
        existingInvitation.tenantId !== auth.user.tenantId
      ) {
        if (isTeamInvitationActive(existingInvitation)) {
          return { error: "EMAIL_INVITED_ELSEWHERE" as const };
        }

        /*
         * الدعوة المنتهية/المقبولة/الملغاة لا يجب أن تحجز البريد عالميًا.
         * نحذف السجل القديم داخل نفس المعاملة قبل إنشاء الدعوة الجديدة.
         */
        await tx.teamInvitation.delete({
          where: { id: existingInvitation.id },
        });
        existingInvitation = null;
      }

      const [activeUsers, otherPendingInvitations] = await Promise.all([
        tx.user.count({
          where: { tenantId: auth.user.tenantId, isActive: true },
        }),
        tx.teamInvitation.count({
          where: {
            tenantId: auth.user.tenantId,
            email: { not: email },
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ]);

      const seatLimit = lockedLimitCheck.limit;

      if (
        seatLimit !== null &&
        seatLimit > 0 &&
        activeUsers + otherPendingInvitations >= seatLimit
      ) {
        return { error: "SEAT_LIMIT" as const, limit: seatLimit };
      }

      const invitation = existingInvitation
        ? await tx.teamInvitation.update({
            where: { id: existingInvitation.id },
            data: {
              name,
              role,
              tokenHash,
              invitedById: auth.user.userId,
              expiresAt,
              acceptedAt: null,
              revokedAt: null,
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              expiresAt: true,
              createdAt: true,
            },
          })
        : await tx.teamInvitation.create({
            data: {
              tenantId: auth.user.tenantId,
              name,
              email,
              role,
              tokenHash,
              invitedById: auth.user.userId,
              expiresAt,
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              expiresAt: true,
              createdAt: true,
            },
          });

      await tx.activity.create({
        data: {
          tenantId: auth.user.tenantId,
          actorId: auth.user.userId,
          type: "TEAM_INVITATION_SENT",
          title: "تم إرسال دعوة للانضمام إلى الفريق",
          message: `${email} (${role})`,
          entityType: "TeamInvitation",
          entityId: invitation.id,
        },
      });

      return { invitation, tenantName: tenant.name };
    });

    let result: Awaited<ReturnType<typeof createInvitation>>;

    try {
      result = await createInvitation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2025")
      ) {
        return err(
          "تم إنشاء دعوة لهذا البريد بالتزامن. حدّث الصفحة ثم أعد المحاولة.",
          409,
        );
      }

      throw error;
    }

    if ("error" in result) {
      if (result.error === "TENANT_NOT_FOUND") {
        return err("المكتب غير موجود", 404);
      }
      if (result.error === "EMAIL_IN_USE") {
        return err("البريد الإلكتروني مستخدم مسبقًا", 409);
      }
      if (result.error === "EMAIL_INVITED_ELSEWHERE") {
        return err("توجد دعوة فعالة لهذا البريد في مكتب آخر", 409);
      }
      if (result.error === "LIMIT") {
        const lockedLimitCheck = result.limitCheck;
        const isPlanLimit = lockedLimitCheck.billing?.canCreate === true;

        return err(lockedLimitCheck.message, isPlanLimit ? 400 : 402, {
          code: isPlanLimit
            ? "PLAN_LIMIT_REACHED"
            : "SUBSCRIPTION_INACTIVE",
          resource: "users",
          billing: lockedLimitCheck.billing ?? null,
        });
      }

      return err(
        `وصلت إلى حد المستخدمين في خطتك الحالية (${result.limit}).`,
        400,
        { code: "PLAN_LIMIT_REACHED", resource: "users" },
      );
    }

    await sendTeamInvitationEmail({
      to: email,
      inviteeName: name,
      tenantName: result.tenantName,
      inviterName: auth.user.name,
      token,
    });

    return ok(
      {
        invitation: result.invitation,
        message: "تم إرسال الدعوة. سيختار العضو كلمة مروره بنفسه.",
      },
      201,
    );
  });
}
