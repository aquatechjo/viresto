import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";

const allowedRoles = ["ADMIN", "LAWYER", "STAFF"] as const;

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

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
        isSystemAdmin: true,
      },
    });

    if (!targetUser) {
      return err("المستخدم غير موجود", 404);
    }

    if (targetUser.isSystemAdmin) {
      return err("لا يمكن تعديل حساب مدير النظام", 403);
    }

    const role =
      typeof body.role === "string"
        ? body.role.trim().toUpperCase()
        : undefined;

    const hasRoleUpdate = role !== undefined;
    const hasActiveUpdate = typeof body.isActive === "boolean";

    if (!hasRoleUpdate && !hasActiveUpdate) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    if (hasRoleUpdate && !allowedRoles.includes(role as any)) {
      return err("صلاحية غير صحيحة", 400);
    }

    if (targetUser.id === auth.user.userId && body.isActive === false) {
      return err("لا يمكنك تعطيل حسابك الحالي", 400);
    }

    if (
      targetUser.id === auth.user.userId &&
      hasRoleUpdate &&
      role !== targetUser.role
    ) {
      return err("لا يمكنك تغيير صلاحية حسابك الحالي", 400);
    }

    const willLoseAdminRole =
      targetUser.role === "ADMIN" &&
      hasRoleUpdate &&
      role !== "ADMIN";

    const willBeDisabled =
      targetUser.role === "ADMIN" &&
      hasActiveUpdate &&
      body.isActive === false;

    if (willLoseAdminRole || willBeDisabled) {
      const otherActiveAdmins = await prisma.user.count({
        where: {
          tenantId: auth.user.tenantId,
          id: {
            not: targetUser.id,
          },
          role: "ADMIN",
          isActive: true,
        },
      });

      if (otherActiveAdmins === 0) {
        return err("لا يمكن إزالة آخر مدير نشط داخل المكتب", 400);
      }
    }

    const updated = await prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        ...(hasRoleUpdate ? { role: role as any } : {}),
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

    if (hasActiveUpdate && body.isActive === false) {
      await prisma.session.updateMany({
        where: {
          userId: targetUser.id,
          tenantId: auth.user.tenantId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    }

    return ok(updated);
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

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const { id } = await params;

    if (id === auth.user.userId) {
      return err("لا يمكنك تعطيل حسابك الحالي", 400);
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
        isSystemAdmin: true,
      },
    });

    if (!targetUser) {
      return err("المستخدم غير موجود", 404);
    }

    if (targetUser.isSystemAdmin) {
      return err("لا يمكن تعطيل حساب مدير النظام", 403);
    }

    if (targetUser.role === "ADMIN" && targetUser.isActive) {
      const otherActiveAdmins = await prisma.user.count({
        where: {
          tenantId: auth.user.tenantId,
          id: {
            not: targetUser.id,
          },
          role: "ADMIN",
          isActive: true,
        },
      });

      if (otherActiveAdmins === 0) {
        return err("لا يمكن تعطيل آخر مدير نشط داخل المكتب", 400);
      }
    }

    await prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        isActive: false,
      },
    });

    await prisma.session.updateMany({
      where: {
        userId: targetUser.id,
        tenantId: auth.user.tenantId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return ok({
      disabled: true,
      message: "تم تعطيل المستخدم بنجاح",
    });
  });
}