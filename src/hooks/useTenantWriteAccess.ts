"use client";

import { useCallback, useEffect, useState } from "react";

type LocaleKey = "ar" | "en";

interface TenantWriteAccessState {
  loading: boolean;
  canWrite: boolean;
  message: string | null;
  subscriptionStatus: string | null;
  refresh: () => Promise<void>;
}

const FALLBACK_MESSAGE: Record<LocaleKey, string> = {
  ar: "انتهى الاشتراك. يمكنك عرض البيانات فقط إلى حين تجديد الاشتراك.",
  en: "The subscription has ended. You can view data only until the subscription is renewed.",
};

function pickLocale(locale?: string): LocaleKey {
  return locale === "en" ? "en" : "ar";
}

export function useTenantWriteAccess(locale?: string): TenantWriteAccessState {
  const localeKey = pickLocale(locale);

  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/billing/access", {
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        // لا نغلق الواجهة إذا فشل فحص الحالة؛ الـ backend هو مصدر الحماية النهائي.
        setCanWrite(true);
        setMessage(null);
        setSubscriptionStatus(null);
        return;
      }

      const payload = data.data ?? {};
      const allowed = payload.canWrite !== false;

      setCanWrite(allowed);
      setMessage(
        allowed
          ? null
          : payload.message ||
              payload.billing?.blockReason ||
              FALLBACK_MESSAGE[localeKey],
      );
      setSubscriptionStatus(payload.billing?.subscriptionStatus ?? null);
    } catch {
      // لا نمنع المستخدم بسبب خطأ شبكة مؤقت؛ الحماية الفعلية موجودة في API.
      setCanWrite(true);
      setMessage(null);
      setSubscriptionStatus(null);
    } finally {
      setLoading(false);
    }
  }, [localeKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    canWrite,
    message,
    subscriptionStatus,
    refresh,
  };
}
