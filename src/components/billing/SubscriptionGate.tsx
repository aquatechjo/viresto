"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTenantAccessSummary } from "@/hooks/useTenantAccessSummary";

// Pages a locked office can still open. The API enforces the lockout
// server-side (requireAuth → 402); this redirect only keeps people from
// landing on pages that would just show errors.
const ALLOWED_WHEN_LOCKED = ["/dashboard/billing", "/dashboard/settings"];

function isAllowedWhenLocked(pathname: string) {
  return ALLOWED_WHEN_LOCKED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default function SubscriptionGate() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const access = useTenantAccessSummary(pathname);

  useEffect(() => {
    if (access?.state === "LOCKED" && !isAllowedWhenLocked(pathname)) {
      router.replace("/dashboard/billing?locked=1");
    }
  }, [access?.state, pathname, router]);

  return null;
}
