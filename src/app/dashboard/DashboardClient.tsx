"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/useLocale";
import { getCurrentUser } from "@/lib/client-session";
import type { DashboardData } from "@/lib/dashboard/types";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import DashboardView from "@/components/dashboard/DashboardView";
import { TEXT } from "@/components/dashboard/dashboard-text";

const TENANT_TIME_ZONE = "Asia/Amman";

export default function DashboardPage() {
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const t = TEXT[locale];

  const [data, setData] = useState<DashboardData | null>(null);
  const [userName, setUserName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "success" | "error">("idle");
  const loadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        const result = await getCurrentUser();

        if (!result.ok || !result.user) {
          if (!cancelled) {
            router.replace("/login");
            router.refresh();
          }
          return;
        }

        if (!cancelled) {
          setUserName(result.user.name ?? "");
          setOfficeName(result.user.tenant?.name ?? "");
        }
      } catch {
        if (!cancelled) {
          router.replace("/login");
          router.refresh();
        }
      }
    }

    verifySession();

    const handlePageShow = () => {
      verifySession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verifySession();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  const loadDashboard = useCallback(async (manualRefresh = false) => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    if (manualRefresh) {
      setIsRefreshing(true);
      setRefreshStatus("idle");
    }

    try {
      const response = await fetch(
        `/api/dashboard-stats?tz=${encodeURIComponent(TENANT_TIME_ZONE)}`,
        { cache: "no-store", credentials: "include", signal: controller.signal },
      );

      const body = await response.json().catch(() => null);
      const next =
        response.ok && body?.data && !Array.isArray(body.data) ? (body.data as DashboardData) : null;

      if (!next) {
        throw new Error(`Dashboard API failed with status ${response.status}`);
      }

      if (controller.signal.aborted) return;

      setData(next);
      setHasLoadError(false);
      if (manualRefresh) setRefreshStatus("success");
    } catch (error) {
      if (controller.signal.aborted) return;

      console.error("Dashboard load failed:", error);
      setHasLoadError(true);
      if (manualRefresh) setRefreshStatus("error");
    } finally {
      if (loadAbortRef.current === controller) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard();

    return () => {
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (refreshStatus === "idle") return;
    const timeout = window.setTimeout(() => setRefreshStatus("idle"), 2800);
    return () => window.clearTimeout(timeout);
  }, [refreshStatus]);

  if (!data) {
    if (!loading && hasLoadError) {
      return (
        <main dir={isRtl ? "rtl" : "ltr"} className="w-full min-w-0">
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-200"
            role="status"
          >
            {t.loadingFailed}
            <button type="button" onClick={() => void loadDashboard(true)} className="shrink-0 underline">
              {t.retry}
            </button>
          </div>
        </main>
      );
    }
    return <DashboardSkeleton isRtl={isRtl} />;
  }

  return (
    <DashboardView
      data={data}
      locale={locale}
      isRtl={isRtl}
      name={officeName.trim() || userName.trim().split(/\s+/)[0] || ""}
      hasLoadError={hasLoadError}
      isRefreshing={isRefreshing}
      refreshStatus={refreshStatus}
      onRefresh={() => void loadDashboard(true)}
    />
  );
}
