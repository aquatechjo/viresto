"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";

import { useLocale } from "@/lib/useLocale";
import {
  getCurrentUser,
  invalidateCurrentUser,
  type CurrentUser,
} from "@/lib/client-session";

const COPY = {
  ar: {
    settings: "الإعدادات",
    billing: "الاشتراك والفواتير",
    logout: "تسجيل الخروج",
    closeMenu: "إغلاق قائمة الحساب",
    openMenu: "فتح قائمة الحساب",
  },
  en: {
    settings: "Settings",
    billing: "Subscription & Billing",
    logout: "Log out",
    closeMenu: "Close account menu",
    openMenu: "Open account menu",
  },
};

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const { locale, isRtl } = useLocale();
  const text = COPY[locale === "ar" ? "ar" : "en"];

  useEffect(() => {
    let cancelled = false;

    void getCurrentUser()
      .then((result) => {
        if (!cancelled && result.ok && result.user) {
          setUser(result.user);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  async function logout() {
    localStorage.removeItem("viresto_last_activity");
    invalidateCurrentUser();

    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => null);

    window.location.href = "/login";
  }

  return (
    <div className="relative" ref={ref} dir={isRtl ? "rtl" : "ltr"}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? text.closeMenu : text.openMenu}
        aria-expanded={open}
        className="
          flex h-9 w-9 min-w-9 items-center justify-center rounded-xl
          border border-slate-200 bg-white p-0 text-slate-800 shadow-sm
          transition-all hover:border-emerald-300 hover:bg-slate-50
          sm:h-10 sm:w-10 sm:min-w-10 sm:rounded-2xl
          xl:h-12 xl:w-auto xl:min-w-[235px] xl:justify-start xl:gap-3
          xl:px-3
          dark:border-emerald-700/60 dark:bg-[#082c2d]
          dark:text-emerald-50 dark:hover:border-emerald-500/80
          dark:hover:bg-[#185354]
        "
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0a3435] text-xs font-black text-white sm:h-8 sm:w-8 sm:rounded-xl sm:text-sm xl:h-9 xl:w-9 dark:bg-emerald-900">
          {user?.name?.[0] ?? "L"}
        </div>

        <div
          className={`hidden min-w-0 flex-1 leading-tight xl:block ${
            isRtl ? "text-right" : "text-left"
          }`}
        >
          <p className="truncate text-sm font-black text-slate-900 dark:text-white">
            {user?.name ?? "..."}
          </p>

          <p className="truncate text-xs font-semibold text-slate-500 dark:text-emerald-200">
            {user?.email ?? ""}
          </p>
        </div>

        <ChevronDown
          className={`hidden h-4 w-4 shrink-0 text-slate-500 transition-transform xl:block dark:text-emerald-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={`
            absolute top-full z-[90] mt-2
            w-[min(18rem,calc(100vw-1.25rem))]
            overflow-hidden rounded-3xl border border-slate-200
            bg-white/95 shadow-2xl backdrop-blur-2xl
            xl:mt-3 xl:w-72
            dark:border-[#0f3d3e] dark:bg-[#0b292a]/95
            ${isRtl ? "left-0 xl:right-0 xl:left-auto" : "right-0 xl:left-0 xl:right-auto"}
          `}
        >
          <div
            className={`border-b border-slate-200 p-4 dark:border-[#0f3d3e] ${
              isRtl ? "text-right" : "text-left"
            }`}
          >
            <p className="font-bold text-slate-800 dark:text-emerald-50">
              {user?.name}
            </p>

            <p className="mt-1 truncate text-sm text-slate-500 dark:text-emerald-100/60">
              {user?.email}
            </p>
          </div>

          <div className="p-2">
            <MenuLink
              href="/dashboard/settings"
              icon={<Settings className="h-4 w-4" />}
              label={text.settings}
              isRtl={isRtl}
              onClick={() => setOpen(false)}
            />

            <button
              type="button"
              onClick={logout}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10 ${
                isRtl ? "flex-row text-right" : "flex-row text-left"
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{text.logout}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  isRtl,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  isRtl: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-slate-100 dark:text-emerald-50 dark:hover:bg-[#123f40] ${
        isRtl ? "flex-row text-right" : "flex-row text-left"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
    </Link>
  );
}
