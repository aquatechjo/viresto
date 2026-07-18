import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { getEffectiveSubscriptionStatus } from "@/lib/billing-limits";
import cloudinary from "@/lib/cloudinary";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CloudinaryResourceType = "image" | "raw" | "video";

const OPEN_MANUAL_PAYMENT_STATUSES = ["UPLOADING", "PENDING", "PROCESSING"];

function documentResourceType(fileType: string): CloudinaryResourceType {
  if (fileType.startsWith("image/")) return "image";
  if (fileType.startsWith("video/")) return "video";
  return "raw";
}

function receiptResourceType(raw: unknown): CloudinaryResourceType {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "image";

  const resourceType = (raw as Record<string, unknown>).resourceType;

  if (resourceType === "raw" || resourceType === "video") {
    return resourceType;
  }

  return "image";
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    if (!auth.user.isSystemAdmin) {
      return err("لا تملك صلاحية حذف المكاتب", 403);
    }

    const { id: tenantId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const confirmation = String(body.confirmation || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 500);
    const meta = getRequestMeta(req);

    if (reason.length < 5) {
      return err("سبب الحذف مطلوب ويجب أن يكون واضحًا", 400);
    }

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isSuspended: true,
        users: {
          select: {
            isSystemAdmin: true,
          },
        },
        subscriptions: {
          where: {
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
            },
          },
          select: {
            status: true,
            currentPeriodEnd: true,
          },
        },
        subscriptionPayments: {
          select: {
            status: true,
            receiptPublicId: true,
            raw: true,
          },
        },
        documents: {
          select: {
            publicId: true,
            fileType: true,
          },
        },
        _count: {
          select: {
            users: true,
            clients: true,
            cases: true,
            documents: true,
            invoices: true,
            payments: true,
          },
        },
      },
    });

    if (!tenant) {
      return err("المكتب غير موجود", 404);
    }

    const isProtectedTenant =
      tenant.id === auth.user.tenantId ||
      tenant.users.some((user) => user.isSystemAdmin);

    if (isProtectedTenant) {
      return err("لا يمكن حذف مكتب النظام الرئيسي", 403);
    }

    if (confirmation !== tenant.name) {
      return err("اكتب اسم المكتب مطابقًا تمامًا لتأكيد الحذف", 400);
    }

    if (!tenant.isSuspended && tenant.status !== "SUSPENDED") {
      return err("يجب تعليق المكتب قبل حذفه نهائيًا", 409);
    }

    const hasActiveSubscription = tenant.subscriptions.some((subscription) =>
      ["ACTIVE", "TRIALING"].includes(
        getEffectiveSubscriptionStatus(
          subscription.status,
          subscription.currentPeriodEnd,
        ),
      ),
    );

    if (hasActiveSubscription) {
      return err("يجب إنهاء الاشتراك الفعّال قبل حذف المكتب", 409);
    }

    const openPaymentCount = tenant.subscriptionPayments.filter(
      (payment) =>
        OPEN_MANUAL_PAYMENT_STATUSES.includes(payment.status.toUpperCase()),
    ).length;

    if (openPaymentCount > 0) {
      return err("يجب إكمال أو مراجعة طلبات الدفع المفتوحة قبل حذف المكتب", 409);
    }

    const cloudResources = new Map<
      string,
      { publicId: string; resourceType: CloudinaryResourceType }
    >();

    for (const document of tenant.documents) {
      if (!document.publicId) continue;

      const resourceType = documentResourceType(document.fileType);
      cloudResources.set(`${resourceType}:${document.publicId}`, {
        publicId: document.publicId,
        resourceType,
      });
    }

    for (const payment of tenant.subscriptionPayments) {
      if (!payment.receiptPublicId) continue;

      const resourceType = receiptResourceType(payment.raw);
      cloudResources.set(`${resourceType}:${payment.receiptPublicId}`, {
        publicId: payment.receiptPublicId,
        resourceType,
      });
    }

    const auditMessage = [
      `المكتب: ${tenant.name}`,
      `الرابط: ${tenant.slug}`,
      `السبب: ${reason}`,
      `المستخدمون: ${tenant._count.users}`,
      `الموكلون: ${tenant._count.clients}`,
      `القضايا: ${tenant._count.cases}`,
      `المستندات: ${tenant._count.documents}`,
      `الفواتير: ${tenant._count.invoices}`,
      `المدفوعات: ${tenant._count.payments}`,
    ].join(" | ");

    const deleteResult = await prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, tenantId);

      const lockedTenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: {
          status: true,
          isSuspended: true,
          subscriptions: {
            where: {
              status: {
                in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
              },
            },
            select: {
              status: true,
              currentPeriodEnd: true,
            },
          },
          subscriptionPayments: {
            select: {
              receiptPublicId: true,
              raw: true,
            },
          },
          documents: {
            select: {
              publicId: true,
              fileType: true,
            },
          },
        },
      });

      if (!lockedTenant) return { error: "NOT_FOUND" as const };

      if (!lockedTenant.isSuspended && lockedTenant.status !== "SUSPENDED") {
        return { error: "NOT_SUSPENDED" as const };
      }

      const lockedHasActiveSubscription = lockedTenant.subscriptions.some(
        (subscription) =>
          ["ACTIVE", "TRIALING"].includes(
            getEffectiveSubscriptionStatus(
              subscription.status,
              subscription.currentPeriodEnd,
            ),
          ),
      );

      if (lockedHasActiveSubscription) {
        return { error: "ACTIVE_SUBSCRIPTION" as const };
      }

      const lockedOpenPaymentCount = await tx.subscriptionPayment.count({
        where: {
          tenantId,
          status: { in: OPEN_MANUAL_PAYMENT_STATUSES },
        },
      });

      if (lockedOpenPaymentCount > 0) {
        return { error: "OPEN_PAYMENT" as const };
      }

      for (const document of lockedTenant.documents) {
        if (!document.publicId) continue;

        const resourceType = documentResourceType(document.fileType);
        cloudResources.set(`${resourceType}:${document.publicId}`, {
          publicId: document.publicId,
          resourceType,
        });
      }

      for (const payment of lockedTenant.subscriptionPayments) {
        if (!payment.receiptPublicId) continue;

        const resourceType = receiptResourceType(payment.raw);
        cloudResources.set(`${resourceType}:${payment.receiptPublicId}`, {
          publicId: payment.receiptPublicId,
          resourceType,
        });
      }

      // Delete restrictive relations first, then remove the tenant itself.
      await tx.subscriptionPayment.deleteMany({ where: { tenantId } });
      await tx.subscription.deleteMany({ where: { tenantId } });
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.document.deleteMany({ where: { tenantId } });
      await tx.invoice.deleteMany({ where: { tenantId } });
      await tx.appointment.deleteMany({ where: { tenantId } });
      await tx.task.deleteMany({ where: { tenantId } });
      await tx.caseMember.deleteMany({ where: { tenantId } });
      await tx.case.deleteMany({ where: { tenantId } });
      await tx.client.deleteMany({ where: { tenantId } });
      await tx.session.deleteMany({ where: { tenantId } });
      await tx.notification.deleteMany({ where: { tenantId } });
      await tx.activity.deleteMany({ where: { tenantId } });
      await tx.teamInvitation.deleteMany({ where: { tenantId } });
      await tx.user.deleteMany({ where: { tenantId } });
      await tx.tenant.delete({ where: { id: tenantId } });

      await tx.activity.create({
        data: {
          tenantId: auth.user.tenantId,
          actorId: auth.user.userId,
          type: "SYSTEM_ADMIN_TENANT_DELETED",
          title: "تم حذف مكتب نهائيًا من إدارة النظام",
          message: auditMessage,
          entityType: "DeletedTenant",
          entityId: tenantId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      return { error: null };
    });

    if (deleteResult.error === "NOT_FOUND") {
      return err("المكتب غير موجود", 404);
    }
    if (deleteResult.error === "NOT_SUSPENDED") {
      return err("يجب تعليق المكتب قبل حذفه نهائيًا", 409);
    }
    if (deleteResult.error === "ACTIVE_SUBSCRIPTION") {
      return err("يجب إنهاء الاشتراك الفعّال قبل حذف المكتب", 409);
    }
    if (deleteResult.error === "OPEN_PAYMENT") {
      return err("يجب إكمال أو مراجعة طلبات الدفع المفتوحة قبل حذف المكتب", 409);
    }

    const cleanupResults = await Promise.allSettled(
      Array.from(cloudResources.values()).map((resource) =>
        cloudinary.uploader.destroy(resource.publicId, {
          resource_type: resource.resourceType,
          type: "authenticated",
          invalidate: true,
        }),
      ),
    );

    const failedCloudDeletes = cleanupResults.filter(
      (result) => result.status === "rejected",
    ).length;

    if (failedCloudDeletes > 0) {
      console.error(
        `[TENANT_DELETE_CLOUD_CLEANUP] ${tenantId}: ${failedCloudDeletes} resources failed`,
      );
    }

    revalidatePath("/admin");

    return ok({
      message: `تم حذف مكتب ${tenant.name} نهائيًا`,
      deletedTenantId: tenantId,
      cloudCleanup: {
        attempted: cloudResources.size,
        failed: failedCloudDeletes,
      },
    });
  });
}
