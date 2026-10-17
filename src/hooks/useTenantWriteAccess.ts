"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCachedTenantWriteAccess,
  requestTenantWriteAccess,
  type TenantAccessEntitlements,
  type TenantAccessPayload,
} from "@/lib/tenant-write-access-cache";

type LocaleKey = "ar" | "en";

interface TenantWriteAccessState {
  loading: boolean;
  canWrite: boolean;
  message: string | null;
  subscriptionStatus: string | null;
  entitlements: TenantAccessEntitlements | null;
  // The office has more active users than its plan allows and this user is
  // beyond the limit (tenant-seats.ts): read-only until an admin fixes it.
  seatReadOnly: boolean;
  refresh: () => Promise<void>;
}

const SEAT_READ_ONLY_MESSAGE: Record<LocaleKey, string> = {
  ar: "حسابك للقراءة فقط: عدد المستخدمين الفعّالين في المكتب أكبر من حد خطته. اطلب من مدير المكتب تعطيل بعض المستخدمين أو ترقية الخطة.",
  en: "Your account is read-only: the office has more active users than its plan allows. Ask your office admin to deactivate some users or upgrade the plan.",
};

const FALLBACK_MESSAGE: Record<LocaleKey, string> = {
  ar: "انتهى الاشتراك. يمكنك عرض البيانات فقط إلى حين تجديد الاشتراك.",
  en: "The subscription has ended. You can view data only until the subscription is renewed.",
};

const STATUS_MESSAGES: Record<LocaleKey, Record<string, string>> = {
  ar: {
    CANCELLED: "تم إلغاء الاشتراك. يرجى تجديد الاشتراك للمتابعة.",
    EXPIRED: "انتهى الاشتراك. يرجى تجديد الاشتراك للمتابعة.",
    UNPAID: "الاشتراك غير مدفوع. يرجى إتمام الدفع للمتابعة.",
    PAST_DUE: "يوجد تأخير في الدفع. يرجى تجديد الاشتراك للمتابعة.",
    MISSING: "لا يوجد اشتراك مفعّل لهذا المكتب.",
  },
  en: {
    CANCELLED:
      "Your subscription has been cancelled. Please renew it to continue.",
    EXPIRED:
      "Your subscription has expired. Please renew it to continue.",
    UNPAID:
      "Your subscription is unpaid. Please complete the payment to continue.",
    PAST_DUE:
      "Your payment is overdue. Please renew your subscription to continue.",
    MISSING:
      "No active subscription was found for this office.",
  },
};

function pickLocale(locale?: string): LocaleKey {
  return locale === "en" ? "en" : "ar";
}

function resolveState(payload: TenantAccessPayload | null, locale: LocaleKey) {
  if (!payload) {
    return {
      canWrite: true,
      message: null,
      subscriptionStatus: null,
      entitlements: null,
      seatReadOnly: false,
    };
  }

  const canWrite = payload.canWrite !== false;
  const seatReadOnly = payload.writeBlockCode === "SEAT_LIMIT_READ_ONLY";

  if (seatReadOnly) {
    return {
      canWrite,
      message: SEAT_READ_ONLY_MESSAGE[locale],
      subscriptionStatus: payload.billing?.subscriptionStatus ?? null,
      entitlements: payload.entitlements ?? null,
      seatReadOnly,
    };
  }
  const subscriptionStatus = payload.billing?.subscriptionStatus ?? null;
  const translatedStatusMessage = subscriptionStatus
    ? STATUS_MESSAGES[locale][subscriptionStatus]
    : null;

  return {
    canWrite,
    message: canWrite
      ? null
      : translatedStatusMessage ||
        (locale === "ar"
          ? payload.message || payload.billing?.blockReason
          : null) ||
        FALLBACK_MESSAGE[locale],
    subscriptionStatus,
    entitlements: payload.entitlements ?? null,
    seatReadOnly: false,
  };
}

export function useTenantWriteAccess(locale?: string): TenantWriteAccessState {
  const localeKey = pickLocale(locale);
  const initialPayload = getCachedTenantWriteAccess();
  const initialState = resolveState(initialPayload, localeKey);

  const [loading, setLoading] = useState(() => !initialPayload);
  const [canWrite, setCanWrite] = useState(initialState.canWrite);
  const [message, setMessage] = useState<string | null>(initialState.message);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(
    initialState.subscriptionStatus,
  );
  const [entitlements, setEntitlements] =
    useState<TenantAccessEntitlements | null>(initialState.entitlements);
  const [seatReadOnly, setSeatReadOnly] = useState(initialState.seatReadOnly);

  const applyPayload = useCallback(
    (payload: TenantAccessPayload | null) => {
      const next = resolveState(payload, localeKey);

      setCanWrite(next.canWrite);
      setMessage(next.message);
      setSubscriptionStatus(next.subscriptionStatus);
      setEntitlements(next.entitlements);
      setSeatReadOnly(next.seatReadOnly);
    },
    [localeKey],
  );

  const load = useCallback(
    async (force = false) => {
      const cached = !force ? getCachedTenantWriteAccess() : null;

      if (cached) {
        applyPayload(cached);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const payload = await requestTenantWriteAccess(force);
        applyPayload(payload);
      } finally {
        setLoading(false);
      }
    },
    [applyPayload],
  );

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    loading,
    canWrite,
    message,
    subscriptionStatus,
    entitlements,
    seatReadOnly,
    refresh,
  };
}
