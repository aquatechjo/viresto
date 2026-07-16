import { NextRequest } from "next/server";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { getEffectiveSubscriptionStatus } from "@/lib/billing-limits";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";
import {
  addBillingPeriod,
  getBillingPlanConfig,
  syncTenantSubscriptionMirror,
} from "@/lib/subscription-consistency";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const ADMIN_ACTIONS = [
  "ACTIVATE",
  "RENEW",
  "CHANGE_PLAN",
  "CANCEL_AT_PERIOD_END",
  "UNDO_CANCEL",
  "END_NOW",
] as const;

type AdminSubscriptionAction = (typeof ADMIN_ACTIONS)[number];

function normalizeAction(value: unknown): AdminSubscriptionAction | null {
  const action = String(value || "").trim().toUpperCase();

  return ADMIN_ACTIONS.includes(action as AdminSubscriptionAction)
    ? (action as AdminSubscriptionAction)
    : null;
}

function normalizeInterval(value: unknown): BillingInterval | null {
  if (value === BillingInterval.MONTHLY) return BillingInterval.MONTHLY;
  if (value === BillingInterval.YEARLY) return BillingInterval.YEARLY;

  return null;
}

const actionLabels: Record<AdminSubscriptionAction, string> = {
  ACTIVATE: "تفعيل الاشتراك إداريًا",
  RENEW: "تجديد الاشتراك إداريًا",
  CHANGE_PLAN: "تغيير خطة الاشتراك إداريًا",
  CANCEL_AT_PERIOD_END: "جدولة إنهاء الاشتراك عند نهاية المدة",
  UNDO_CANCEL: "إلغاء إنهاء الاشتراك المجدول",
  END_NOW: "إنهاء الاشتراك فورًا",
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    if (!auth.user.isSystemAdmin) {
      return err("لا تملك صلاحية إدارة اشتراكات النظام", 403);
    }

    const { id: tenantId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body.action);
    const interval = normalizeInterval(body.interval);
    const planId = String(body.planId || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 500);

    if (!action) {
      return err("إجراء الاشتراك غير صالح", 400);
    }

    if (reason.length < 3) {
      return err("سبب الإجراء مطلوب ويجب أن يكون واضحًا", 400);
    }

    if (["ACTIVATE", "CHANGE_PLAN"].includes(action)) {
      if (!planId || !interval) {
        return err("الخطة ومدة الاشتراك مطلوبتان", 400);
      }
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, tenantId);

      const tenant = await tx.tenant.findUnique({
        where: {
          id: tenantId,
        },
        select: {
          id: true,
          name: true,
          users: {
            select: {
              isSystemAdmin: true,
            },
          },
          subscriptions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 20,
            include: {
              plan: true,
            },
          },
        },
      });

      if (!tenant) {
        return { error: "TENANT_NOT_FOUND" as const };
      }

      const isProtectedTenant = tenant.users.some(
        (user) => user.isSystemAdmin,
      );

      if (
        isProtectedTenant &&
        ["CANCEL_AT_PERIOD_END", "END_NOW"].includes(action)
      ) {
        return { error: "PROTECTED_TENANT" as const };
      }

      const currentSubscription =
        tenant.subscriptions.find((subscription) =>
          ["ACTIVE", "TRIALING"].includes(
            getEffectiveSubscriptionStatus(
              subscription.status,
              subscription.currentPeriodEnd,
            ),
          ),
        ) ??
        tenant.subscriptions.find((subscription) =>
          ["ACTIVE", "TRIALING"].includes(subscription.status),
        ) ??
        tenant.subscriptions[0] ??
        null;

      let updatedSubscription;

      if (action === "ACTIVATE" || action === "CHANGE_PLAN") {
        const requestedPlan = await tx.billingPlan.findFirst({
          where: {
            id: planId,
            isActive: true,
          },
        });

        if (!requestedPlan || !interval) {
          return { error: "PLAN_NOT_FOUND" as const };
        }

        const configuredPlan = getBillingPlanConfig(
          requestedPlan.code,
          interval,
        );

        if (!configuredPlan) {
          return { error: "UNSUPPORTED_PLAN" as const };
        }

        await tx.subscription.updateMany({
          where: {
            tenantId,
            status: {
              in: [
                SubscriptionStatus.TRIALING,
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.UNPAID,
              ],
            },
          },
          data: {
            status: SubscriptionStatus.CANCELLED,
            cancelAtPeriodEnd: false,
            cancelledAt: now,
          },
        });

        updatedSubscription = await tx.subscription.create({
          data: {
            tenantId,
            planId: requestedPlan.id,
            status: SubscriptionStatus.ACTIVE,
            interval,
            currency: configuredPlan.currency,
            amount: configuredPlan.amount,
            trialEndsAt: null,
            currentPeriodStart: now,
            currentPeriodEnd: addBillingPeriod(now, interval),
            cancelAtPeriodEnd: false,
            cancelledAt: null,
          },
          include: {
            plan: true,
          },
        });

        await syncTenantSubscriptionMirror(tx, {
          tenantId,
          planCode: requestedPlan.code,
        });
      } else if (action === "RENEW") {
        if (!currentSubscription) {
          return { error: "SUBSCRIPTION_NOT_FOUND" as const };
        }

        const periodBase =
          currentSubscription.currentPeriodEnd &&
          currentSubscription.currentPeriodEnd > now
            ? currentSubscription.currentPeriodEnd
            : now;

        const configuredPlan = getBillingPlanConfig(
          currentSubscription.plan.code,
          currentSubscription.interval,
        );

        if (!configuredPlan) {
          return { error: "UNSUPPORTED_PLAN" as const };
        }

        updatedSubscription = await tx.subscription.update({
          where: {
            id: currentSubscription.id,
          },
          data: {
            status: SubscriptionStatus.ACTIVE,
            amount: configuredPlan.amount,
            currency: configuredPlan.currency,
            trialEndsAt: null,
            currentPeriodStart: currentSubscription.currentPeriodStart ?? now,
            currentPeriodEnd: addBillingPeriod(
              periodBase,
              currentSubscription.interval,
            ),
            cancelAtPeriodEnd: false,
            cancelledAt: null,
          },
          include: {
            plan: true,
          },
        });

        await syncTenantSubscriptionMirror(tx, {
          tenantId,
          planCode: currentSubscription.plan.code,
        });
      } else {
        if (!currentSubscription) {
          return { error: "SUBSCRIPTION_NOT_FOUND" as const };
        }

        if (action === "CANCEL_AT_PERIOD_END") {
          if (
            !currentSubscription.currentPeriodEnd ||
            currentSubscription.currentPeriodEnd <= now
          ) {
            return { error: "PERIOD_ALREADY_ENDED" as const };
          }

          updatedSubscription = await tx.subscription.update({
            where: {
              id: currentSubscription.id,
            },
            data: {
              cancelAtPeriodEnd: true,
              cancelledAt: null,
            },
            include: {
              plan: true,
            },
          });
        } else if (action === "UNDO_CANCEL") {
          updatedSubscription = await tx.subscription.update({
            where: {
              id: currentSubscription.id,
            },
            data: {
              cancelAtPeriodEnd: false,
              cancelledAt: null,
            },
            include: {
              plan: true,
            },
          });
        } else {
          updatedSubscription = await tx.subscription.update({
            where: {
              id: currentSubscription.id,
            },
            data: {
              status: SubscriptionStatus.CANCELLED,
              currentPeriodEnd: now,
              cancelAtPeriodEnd: false,
              cancelledAt: now,
            },
            include: {
              plan: true,
            },
          });

          await tx.tenant.update({
            where: {
              id: tenantId,
            },
            data: {
              status: "EXPIRED",
              isSuspended: false,
              trialEndsAt: null,
              aiEnabled: false,
              aiConsentAt: null,
              aiConsentBy: null,
              aiConsentPolicyVersion: null,
            },
          });
        }
      }

      await tx.activity.create({
        data: {
          tenantId,
          actorId: auth.user.userId,
          type: `SYSTEM_ADMIN_SUBSCRIPTION_${action}`,
          title: actionLabels[action],
          message: `السبب: ${reason}`,
          entityType: "Subscription",
          entityId: updatedSubscription.id,
        },
      });

      return {
        subscription: updatedSubscription,
        action,
      };
    });

    if ("error" in result) {
      switch (result.error) {
        case "TENANT_NOT_FOUND":
          return err("المكتب غير موجود", 404);
        case "PROTECTED_TENANT":
          return err("لا يمكن إنهاء اشتراك مكتب النظام الرئيسي", 403);
        case "PLAN_NOT_FOUND":
          return err("الخطة غير موجودة أو غير فعالة", 404);
        case "UNSUPPORTED_PLAN":
          return err("رمز الخطة غير مدعوم", 409);
        case "SUBSCRIPTION_NOT_FOUND":
          return err("لا يوجد اشتراك لهذا المكتب", 404);
        case "PERIOD_ALREADY_ENDED":
          return err("انتهت مدة الاشتراك بالفعل", 409);
      }
    }

    return ok({
      message: `تم تنفيذ: ${actionLabels[action]}`,
      result,
    });
  });
}
