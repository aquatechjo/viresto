"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";

import { useLocale } from "@/lib/useLocale";

interface UserType {
  name: string;
  email: string;
}

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
  const [user, setUser] = useState<UserType | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const text = COPY[locale === "ar" ? "ar" : "en"];

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setUser(data.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  async function logout() {
    sessionStorage.removeItem("viresto_tab_session");
    sessionStorage.removeItem("viresto_last_activity");

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
        className="flex h-12 min-w-[235px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-slate-800 shadow-sm transition-all hover:border-emerald-300 hover:bg-slate-50 dark:border-emerald-700/60 dark:bg-[#08291d] dark:text-emerald-50 dark:hover:border-emerald-500/80 dark:hover:bg-[#103b2a]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#07351f] text-sm font-black text-white dark:bg-emerald-900 dark:text-white">
          {user?.name?.[0] ?? "L"}
        </div>

        <div
          className={`hidden min-w-0 flex-1 leading-tight md:block ${
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
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-emerald-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-[#2d4a3e] dark:bg-[#10291d]/95 ${
            isRtl ? "right-0" : "left-0"
          }`}
        >
          <div
            className={`border-b border-slate-200 p-4 dark:border-[#2d4a3e] ${
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
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-slate-100 dark:text-emerald-50 dark:hover:bg-[#173827] ${
        isRtl ? "flex-row text-right" : "flex-row text-left"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
    </Link>
  );
}
