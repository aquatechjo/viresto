import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import {
  assertTenantCanCreate,
  assertTenantCanWrite,
} from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

const allowedRoles = [UserRole.ADMIN, UserRole.LAWYER, UserRole.STAFF] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل مستخدم",
    );
    if (!writeCheck.ok) return err(writeCheck.message, writeCheck.status);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const role =
      typeof body.role === "string"
        ? (body.role.trim().toUpperCase() as UserRole)
        : undefined;
    const hasRoleUpdate = role !== undefined;
    const hasActiveUpdate = typeof body.isActive === "boolean";

    if (!hasRoleUpdate && !hasActiveUpdate) {
      return err("لا توجد بيانات للتعديل", 400);
    }
    if (hasRoleUpdate && !allowedRoles.includes(role)) {
      return err("صلاحية غير صحيحة", 400);
    }
    if (id === auth.user.userId && body.isActive === false) {
      return err("لا يمكنك تعطيل حسابك الحالي", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, auth.user.tenantId);

      const targetUser = await tx.user.findFirst({
        where: { id, tenantId: auth.user.tenantId },
        select: {
          id: true,
          role: true,
          isActive: true,
          isSystemAdmin: true,
        },
      });

      if (!targetUser) return { error: "NOT_FOUND" as const };
      if (targetUser.isSystemAdmin) {
        return { error: "SYSTEM_ADMIN" as const };
      }
      if (
        targetUser.id === auth.user.userId &&
        hasRoleUpdate &&
        role !== targetUser.role
      ) {
        return { error: "SELF_ROLE" as const };
      }

      const willLoseAdmin =
        targetUser.role === UserRole.ADMIN &&
        targetUser.isActive &&
        ((hasRoleUpdate && role !== UserRole.ADMIN) ||
          (hasActiveUpdate && body.isActive === false));

      if (willLoseAdmin) {
        const otherActiveAdmins = await tx.user.count({
          where: {
            tenantId: auth.user.tenantId,
            id: { not: targetUser.id },
            role: UserRole.ADMIN,
            isActive: true,
          },
        });

        if (otherActiveAdmins === 0) {
          return { error: "LAST_ADMIN" as const };
        }
      }

      const willReactivate =
        !targetUser.isActive && hasActiveUpdate && body.isActive === true;

      if (willReactivate) {
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
      }

      const updated = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          ...(hasRoleUpdate ? { role } : {}),
          ...(hasActiveUpdate ? { isActive: body.isActive } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isSystemAdmin: true,
          createdAt: true,
        },
      });

      const securityContextChanged =
        (hasRoleUpdate && role !== targetUser.role) ||
        (hasActiveUpdate && body.isActive === false);

      if (securityContextChanged) {
        await tx.session.updateMany({
          where: {
            userId: targetUser.id,
            tenantId: auth.user.tenantId,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      await tx.activity.create({
        data: {
          tenantId: auth.user.tenantId,
          actorId: auth.user.userId,
          type: "TEAM_MEMBER_UPDATED",
          title: "تم تحديث عضو في الفريق",
          message: `${updated.email} (${updated.role}, ${updated.isActive ? "ACTIVE" : "DISABLED"})`,
          entityType: "User",
          entityId: updated.id,
        },
      });

      return { updated };
    });

    if ("error" in result) {
      if (result.error === "NOT_FOUND") return err("المستخدم غير موجود", 404);
      if (result.error === "SYSTEM_ADMIN") {
        return err("لا يمكن تعديل حساب مدير النظام", 403);
      }
      if (result.error === "SELF_ROLE") {
        return err("لا يمكنك تغيير صلاحية حسابك الحالي", 400);
      }
      if (result.error === "LAST_ADMIN") {
        return err("لا يمكن إزالة آخر مدير نشط داخل المكتب", 400);
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
    }

    return ok(result.updated);
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعطيل مستخدم",
    );
    if (!writeCheck.ok) return err(writeCheck.message, writeCheck.status);

    const { id } = await params;
    if (id === auth.user.userId) {
      return err("لا يمكنك تعطيل حسابك الحالي", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, auth.user.tenantId);

      const targetUser = await tx.user.findFirst({
        where: { id, tenantId: auth.user.tenantId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isSystemAdmin: true,
        },
      });

      if (!targetUser) return { error: "NOT_FOUND" as const };
      if (targetUser.isSystemAdmin) {
        return { error: "SYSTEM_ADMIN" as const };
      }

      if (targetUser.role === UserRole.ADMIN && targetUser.isActive) {
        const otherActiveAdmins = await tx.user.count({
          where: {
            tenantId: auth.user.tenantId,
            id: { not: targetUser.id },
            role: UserRole.ADMIN,
            isActive: true,
          },
        });

        if (otherActiveAdmins === 0) {
          return { error: "LAST_ADMIN" as const };
        }
      }

      await tx.user.update({
        where: { id: targetUser.id },
        data: { isActive: false },
      });
      await tx.session.updateMany({
        where: {
          userId: targetUser.id,
          tenantId: auth.user.tenantId,
          isActive: true,
        },
        data: { isActive: false },
      });
      await tx.activity.create({
        data: {
          tenantId: auth.user.tenantId,
          actorId: auth.user.userId,
          type: "TEAM_MEMBER_DISABLED",
          title: "تم تعطيل عضو في الفريق",
          message: targetUser.email,
          entityType: "User",
          entityId: targetUser.id,
        },
      });

      return { disabled: true };
    });

    if ("error" in result) {
      if (result.error === "NOT_FOUND") return err("المستخدم غير موجود", 404);
      if (result.error === "SYSTEM_ADMIN") {
        return err("لا يمكن تعطيل حساب مدير النظام", 403);
      }
      return err("لا يمكن تعطيل آخر مدير نشط داخل المكتب", 400);
    }

    return ok({ disabled: true, message: "تم تعطيل المستخدم بنجاح" });
  });
}
