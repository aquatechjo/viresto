"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/system-admin";
import {
  assertTenantCanCreate,
  getEffectiveSubscriptionStatus,
} from "@/lib/billing-limits";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

export async function suspendTenant(id: string) {
  const admin = await requireSystemAdmin();

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      users: {
        select: {
          isSystemAdmin: true,
        },
      },
    },
  });

  if (!tenant) {
    throw new Error("المكتب غير موجود");
  }

  const hasSystemAdmin = tenant.users.some((user) => user.isSystemAdmin);

  if (hasSystemAdmin) {
    throw new Error("لا يمكن تعليق مكتب النظام الرئيسي");
  }

  await prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, id);

    await tx.tenant.update({
      where: { id },
      data: {
        isSuspended: true,
        status: "SUSPENDED",
      },
    });

    await tx.session.updateMany({
      where: {
        tenantId: id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    await tx.activity.create({
      data: {
        tenantId: id,
        actorId: admin.id,
        type: "SYSTEM_ADMIN_TENANT_SUSPENDED",
        title: "تم تعليق المكتب من إدارة النظام",
        message: tenant.name,
        entityType: "Tenant",
        entityId: id,
      },
    });
  });

  revalidatePath("/admin");
}

export async function activateTenant(id: string) {
  const admin = await requireSystemAdmin();

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subscriptions: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        select: {
          status: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!tenant) {
    throw new Error("المكتب غير موجود");
  }

  await prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, id);

    const subscriptions = await tx.subscription.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        status: true,
        currentPeriodEnd: true,
      },
    });
    const activeSubscription = subscriptions.find((subscription) =>
      ["ACTIVE", "TRIALING"].includes(
        getEffectiveSubscriptionStatus(
          subscription.status,
          subscription.currentPeriodEnd,
        ),
      ),
    );
    const nextTenantStatus =
      activeSubscription?.status === "TRIALING"
        ? "TRIAL"
        : activeSubscription
          ? "ACTIVE"
          : "EXPIRED";

    await tx.tenant.update({
      where: { id },
      data: {
        isSuspended: false,
        status: nextTenantStatus,
      },
    });

    await tx.activity.create({
      data: {
        tenantId: id,
        actorId: admin.id,
        type: "SYSTEM_ADMIN_TENANT_RESTORED",
        title: "تم رفع تعليق المكتب من إدارة النظام",
        message: tenant.name,
        entityType: "Tenant",
        entityId: id,
      },
    });
  });

  revalidatePath("/admin");
}

export async function deactivateUser(id: string) {
  const admin = await requireSystemAdmin();

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      email: true,
      isSystemAdmin: true,
    },
  });

  if (!user) {
    throw new Error("المستخدم غير موجود");
  }

  if (user.isSystemAdmin) {
    throw new Error("لا يمكن تعطيل حساب مدير النظام");
  }

  await prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, user.tenantId);

    await tx.user.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    await tx.session.updateMany({
      where: {
        userId: id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    await tx.activity.create({
      data: {
        tenantId: user.tenantId,
        actorId: admin.id,
        type: "SYSTEM_ADMIN_USER_DEACTIVATED",
        title: "تم تعطيل مستخدم من إدارة النظام",
        message: `${user.name} - ${user.email}`,
        entityType: "User",
        entityId: id,
      },
    });
  });

  revalidatePath("/admin");
}

export async function activateUser(id: string) {
  const admin = await requireSystemAdmin();

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      email: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new Error("المستخدم غير موجود");
  }

  await prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, user.tenantId);

    const lockedUser = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        isActive: true,
      },
    });

    if (!lockedUser || lockedUser.tenantId !== user.tenantId) {
      throw new Error("المستخدم غير موجود");
    }

    if (lockedUser.isActive) return;

    const limitCheck = await assertTenantCanCreate(
      user.tenantId,
      "users",
      tx,
    );

    if (!limitCheck.ok) {
      throw new Error(limitCheck.message);
    }

    await tx.user.update({
      where: { id },
      data: {
        isActive: true,
      },
    });

    await tx.activity.create({
      data: {
        tenantId: user.tenantId,
        actorId: admin.id,
        type: "SYSTEM_ADMIN_USER_ACTIVATED",
        title: "تم تفعيل مستخدم من إدارة النظام",
        message: `${user.name} - ${user.email}`,
        entityType: "User",
        entityId: id,
      },
    });
  });

  revalidatePath("/admin");
}
