"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTenantAccessSummary } from "@/hooks/useTenantAccessSummary";
import {
  LOCKED_REDIRECT_PATH,
  installSubscriptionLockRedirect,
  isAllowedWhenLocked,
} from "@/lib/subscription-lock-redirect";

// The API enforces the lockout server-side (requireAuth → 402); these
// redirects only keep a locked office off pages that would just show errors.
export default function SubscriptionGate() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const access = useTenantAccessSummary(pathname);

  // Layout effect: installed before any page's mount-time fetch (those run
  // in passive effects), so their 402s redirect instead of toasting.
  useLayoutEffect(() => {
    installSubscriptionLockRedirect(() => router.replace(LOCKED_REDIRECT_PATH));
  }, [router]);

  useEffect(() => {
    if (access?.state === "LOCKED" && !isAllowedWhenLocked(pathname)) {
      router.replace(LOCKED_REDIRECT_PATH);
    }
  }, [access?.state, pathname, router]);

  return null;
}
