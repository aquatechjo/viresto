"use client";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import SessionGuard from "@/components/security/SessionGuard";
import DeferredAIAssistant from "@/components/dashboard/DeferredAIAssistant";
import NavigationPerformance from "@/components/navigation/NavigationPerformance";
import { useLocale } from "@/lib/useLocale";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isRtl } = useLocale();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("viresto_sidebar_collapsed");
    setSidebarCollapsed(stored === "true");
  }, []);

  function handleSidebarCollapsedChange(collapsed: boolean) {
    setSidebarCollapsed(collapsed);
    window.localStorage.setItem(
      "viresto_sidebar_collapsed",
      String(collapsed),
    );
    window.dispatchEvent(
      new CustomEvent("viresto-sidebar-change", { detail: collapsed }),
    );
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="dashboard-root min-h-dvh w-full overflow-x-clip"
      style={{ background: "var(--bg)" }}
    >
      <SessionGuard />
      <NavigationPerformance />
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleSidebarCollapsedChange}
      />

      <div
        className={`min-h-dvh min-w-0 w-full max-w-full overflow-x-clip transition-[padding] duration-300 ${
          isRtl
            ? sidebarCollapsed
              ? "xl:pr-20"
              : "xl:pr-64"
            : sidebarCollapsed
              ? "xl:pl-20"
              : "xl:pl-64"
        }`}
      >
        <TopBar sidebarCollapsed={sidebarCollapsed} />

        <main className="dashboard-page-shell min-w-0 w-full max-w-full overflow-x-clip px-3 pb-28 pt-[124px] sm:px-4 sm:pb-28 sm:pt-[128px] md:px-5 xl:px-6 xl:pb-10 xl:pt-[96px]">
          {children}
        </main>
      </div>

      <DeferredAIAssistant />
    </div>
  );
}
