"use client";

import { useEffect, useState } from "react";
import {
  TENANT_ACCESS_EVENT,
  getCachedTenantWriteAccess,
  requestTenantWriteAccess,
  type TenantAccessSummary,
} from "@/lib/tenant-write-access-cache";

/**
 * Trial / lockout summary from /api/billing/access (30s client cache,
 * shared with useTenantWriteAccess). Pass a changing `refreshKey` (e.g. the
 * pathname) to re-check on navigation.
 */
export function useTenantAccessSummary(refreshKey?: string) {
  const [summary, setSummary] = useState<TenantAccessSummary | null>(
    () => getCachedTenantWriteAccess()?.access ?? null,
  );

  useEffect(() => {
    let cancelled = false;

    void requestTenantWriteAccess().then((payload) => {
      if (!cancelled) setSummary(payload?.access ?? null);
    });

    function handleAccessChange() {
      if (cancelled) return;
      setSummary(getCachedTenantWriteAccess()?.access ?? null);
    }

    window.addEventListener(TENANT_ACCESS_EVENT, handleAccessChange);

    return () => {
      cancelled = true;
      window.removeEventListener(TENANT_ACCESS_EVENT, handleAccessChange);
    };
  }, [refreshKey]);

  return summary;
}
