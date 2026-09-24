"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "./NotificationBell";
import DashboardSearch from "./DashboardSearch";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { translations } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";

const TITLE_KEYS: Record<string, keyof typeof translations.ar.dashboard> = {
  "/dashboard": "title",
  "/dashboard/appointments": "appointments",
  "/dashboard/cases": "cases",
  "/dashboard/clients": "clients",
  "/dashboard/documents": "documents",
  "/dashboard/invoices": "invoices",
  "/dashboard/payments": "payments",
  "/dashboard/reports": "reports",
  "/dashboard/finance/invoices": "invoices",
  "/dashboard/finance/payments": "payments",
  "/dashboard/finance/reports": "reports",
  "/dashboard/settings": "settings",
  "/dashboard/tasks": "tasks",
  "/dashboard/activity": "activity",
  "/dashboard/billing": "billing",
  "/dashboard/team": "team",
};

const COMPACT_CONTROL =
  "[&_button]:!flex [&_button]:!h-10 [&_button]:!w-10 [&_button]:!min-w-10 " +
  "[&_button]:!items-center [&_button]:!justify-center " +
  "[&_button]:!rounded-2xl [&_button]:!border [&_button]:!border-[var(--landing-border-strong)] " +
  "[&_button]:!bg-[#103334]/90 [&_button]:!px-0 [&_button]:!text-emerald-100 " +
  "[&_button]:!shadow-none " +
  "[&_button]:!transition-all [&_button:hover]:!-translate-y-px " +
  "[&_button:hover]:!border-copper-400/60 [&_button:hover]:!bg-[var(--landing-surface-hover)] " +
  "sm:[&_button]:!h-11 sm:[&_button]:!w-11 sm:[&_button]:!min-w-11";

interface TopBarProps {
  sidebarCollapsed: boolean;
}

export default function TopBar({ sidebarCollapsed }: TopBarProps) {
  const pathname = usePathname();
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  const titleKey =
    Object.entries(TITLE_KEYS)
      .filter(([path]) => pathname === path || pathname.startsWith(`${path}/`))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "title";

  const title = t.dashboard[titleKey] ?? t.dashboard.title;

  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const formatter =
      locale === "ar"
        ? new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });

    setDateStr(formatter.format(new Date()));
  }, [locale]);

  return (
    <header
      dir={isRtl ? "rtl" : "ltr"}
      className={`
        fixed top-0 z-40 min-w-0 overflow-visible border-b border-[var(--landing-border)]
        bg-[linear-gradient(180deg,rgba(11,41,42,0.98)_0%,rgba(8,44,45,0.97)_100%)]
        shadow-[0_8px_28px_rgba(0,0,0,0.24)] backdrop-blur-[18px] transition-[left,right] duration-300
        ${
          isRtl
            ? `right-0 left-0 pr-[62px] pl-2.5 sm:pr-[68px] sm:pl-4 xl:px-6 ${
                sidebarCollapsed ? "xl:right-20" : "xl:right-64"
              }`
            : `left-0 right-0 pl-[62px] pr-2.5 sm:pl-[68px] sm:pr-4 xl:px-6 ${
                sidebarCollapsed ? "xl:left-20" : "xl:left-64"
              }`
        }
      `}
    >
      <div
        className="
          grid min-h-[64px] w-full min-w-0
          grid-cols-[minmax(0,1fr)_auto_auto_auto]
          items-center gap-x-1.5 gap-y-2 py-2.5
          sm:min-h-[68px] sm:gap-x-2
          xl:min-h-[76px]
          xl:grid-cols-[minmax(280px,1fr)_auto_auto_auto_auto_auto]
          xl:gap-3 xl:py-3
        "
      >
        {/* Page title — first cell on mobile, last cell on desktop */}
        <div
          className={`
            col-start-1 row-start-1 min-w-0
            xl:col-start-6 xl:row-start-1 xl:max-w-[220px]
            ${isRtl ? "text-right xl:text-left" : "text-left xl:text-right"}
          `}
        >
          <h1 className="truncate text-sm font-black text-emerald-50 sm:text-base">
            {title}
          </h1>
        </div>

        {/* Language */}
        <div
          className={`col-start-2 row-start-1 shrink-0 xl:col-start-3 ${COMPACT_CONTROL}`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        {/* Notifications */}
        <div
          className="relative z-50 col-start-3 row-start-1 shrink-0 overflow-visible xl:col-start-4"
        >
          <NotificationBell />
        </div>

        {/* Profile — avatar only on mobile/tablet, full control on desktop */}
        <div className="relative z-50 col-start-4 row-start-1 min-w-0 shrink-0 overflow-visible xl:col-start-5">
          <ProfileMenu />
        </div>

        {/* Date — desktop only */}
        <span
          className="
            hidden h-10 shrink-0 items-center gap-1.5 rounded-2xl
            border border-[var(--landing-border-strong)] bg-[#103334]/90 px-3 text-xs font-bold
            text-emerald-50 shadow-none
            transition-all hover:-translate-y-px hover:border-copper-400/60
            hover:bg-[var(--landing-surface-hover)] xl:col-start-2 xl:row-start-1 xl:flex
          "
        >
          📅 {dateStr || "—"}
        </span>

        {/* Search — desktop only; below xl it lives in the Sidebar drawer */}
        <DashboardSearch
          variant="topbar"
          className="hidden xl:col-span-1 xl:col-start-1 xl:row-start-1 xl:block xl:min-w-[280px] xl:max-w-[860px]"
        />
      </div>
    </header>
  );
}
