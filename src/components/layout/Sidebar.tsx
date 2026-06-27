"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { toast } from "sonner";

import {
  LayoutDashboard,
  CalendarDays,
  Briefcase,
  Users,
  FileText,
  Wallet,
  ReceiptText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Activity,
  X,
} from "lucide-react";

import { initials } from "@/lib/utils";
import { translations } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";

type Role = "ADMIN" | "LAWYER" | "STAFF";

type NavLabelKey =
  | "dashboard"
  | "clients"
  | "cases"
  | "documents"
  | "appointments"
  | "tasks"
  | "team"
  | "payments"
  | "invoices"
  | "reports"
  | "activity"
  | "billing";

type SectionKey = "main" | "management" | "business";

type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  icon: ElementType;
  roles: Role[];
};

type NavGroup = {
  sectionKey: SectionKey;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    sectionKey: "main",
    items: [
      {
        href: "/dashboard",
        labelKey: "dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN", "LAWYER", "STAFF"],
      },
    ],
  },
  {
    sectionKey: "management",
    items: [
      {
        href: "/dashboard/clients",
        labelKey: "clients",
        icon: Users,
        roles: ["ADMIN", "LAWYER", "STAFF"],
      },
      {
        href: "/dashboard/cases",
        labelKey: "cases",
        icon: Briefcase,
        roles: ["ADMIN", "LAWYER", "STAFF"],
      },
      {
        href: "/dashboard/documents",
        labelKey: "documents",
        icon: FileText,
        roles: ["ADMIN", "LAWYER", "STAFF"],
      },
      {
        href: "/dashboard/appointments",
        labelKey: "appointments",
        icon: CalendarDays,
        roles: ["ADMIN", "LAWYER", "STAFF"],
      },
      {
        href: "/dashboard/tasks",
        labelKey: "tasks",
        icon: FileText,
        roles: ["ADMIN", "LAWYER", "STAFF"],
      },
      {
        href: "/dashboard/team",
        labelKey: "team",
        icon: Users,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    sectionKey: "business",
    items: [
      {
        href: "/dashboard/payments",
        labelKey: "payments",
        icon: Wallet,
        roles: ["ADMIN", "LAWYER"],
      },
      {
        href: "/dashboard/invoices",
        labelKey: "invoices",
        icon: ReceiptText,
        roles: ["ADMIN", "LAWYER"],
      },
      {
        href: "/dashboard/reports",
        labelKey: "reports",
        icon: BarChart3,
        roles: ["ADMIN", "LAWYER"],
      },
      {
        href: "/dashboard/activity",
        labelKey: "activity",
        icon: Activity,
        roles: ["ADMIN", "LAWYER"],
      },
    ],
  },
];

interface User {
  name: string;
  email: string;
  role: Role;
}

function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "LAWYER" || value === "STAFF";
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const userData = d?.data;

        if (d.success && userData && isRole(userData.role)) {
          setUser({
            name: userData.name,
            email: userData.email,
            role: userData.role,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    toast.success(t.sidebar.logoutSuccess);
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  const Inner = () => (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0f2b21] text-emerald-50"
    >
      {/* Brand */}
      <div className="shrink-0 border-b border-emerald-100/10 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50/10 ring-1 ring-emerald-100/10 sm:h-14 sm:w-14">
            <img
              src="/logo.png"
              alt="Viresto"
              className="h-10 w-10 object-contain sm:h-12 sm:w-12"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-black leading-tight text-emerald-50">
              Viresto
            </p>
            <p className="mt-0.5 truncate text-xs font-bold text-emerald-100/55">
              Legal Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
        {NAV.map((group) => (
          <div key={group.sectionKey} className="mb-4 last:mb-0 sm:mb-5">
            <p className="mb-2 px-3 text-start text-[11px] font-black uppercase tracking-wide text-emerald-100/55">
              {t.sidebar.sections[group.sectionKey]}
            </p>

            <div className="space-y-1.5">
              {group.items
                .filter((item) => {
                  if (!user) return true;
                  return item.roles.includes(user.role);
                })
                .map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        group flex h-11 min-w-0 items-center gap-3 rounded-2xl px-3 text-sm font-black transition-all duration-200 sm:h-12 sm:px-4
                        ${
                          active
                            ? "bg-[#294d3c] text-emerald-50 shadow-sm ring-1 ring-emerald-100/10"
                            : "text-emerald-100/70 hover:bg-[#173827] hover:text-emerald-50"
                        }
                      `}
                    >
                      <Icon
                        className={`
                          h-5 w-5 shrink-0 transition-all
                          ${
                            active
                              ? "text-emerald-300"
                              : "text-emerald-100/55 group-hover:text-emerald-200"
                          }
                        `}
                      />

                      <span className="min-w-0 flex-1 truncate text-start">
                        {t.sidebar.nav[item.labelKey]}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="shrink-0 border-t border-emerald-100/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
        <Link
          href="/dashboard/settings"
          className="flex min-w-0 items-center gap-3 rounded-2xl bg-emerald-50/5 p-3 transition hover:bg-emerald-50/10"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#294d3c] text-sm font-black text-emerald-50 sm:h-11 sm:w-11">
            {user ? initials(user.name) : "L"}
          </div>

          <div className="min-w-0 flex-1 text-start">
            <p className="truncate text-sm font-black text-emerald-50">
              {user?.name ?? "..."}
            </p>

            <p className="mt-0.5 truncate text-xs font-medium text-emerald-100/65">
              {user ? (t.sidebar.roles[user.role] ?? user.role) : ""}
            </p>
          </div>

          <Settings className="h-4 w-4 shrink-0 text-emerald-100/60" />
        </Link>

        <button
          suppressHydrationWarning
          type="button"
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4d35e] px-4 py-3 text-sm font-bold text-[#06170f] transition hover:bg-[#ffe27a]"
        >
          {locale === "ar" ? "تسجيل الخروج" : "Logout"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        aria-label={
          mobileOpen
            ? locale === "ar"
              ? "إغلاق القائمة"
              : "Close menu"
            : t.sidebar.openMenu
        }
        aria-expanded={mobileOpen}
        title={
          mobileOpen
            ? locale === "ar"
              ? "إغلاق القائمة"
              : "Close menu"
            : t.sidebar.openMenu
        }
        onClick={() => setMobileOpen((value) => !value)}
        className={`
          fixed top-[max(0.75rem,env(safe-area-inset-top))] z-[80] flex h-11 w-11 items-center justify-center
          rounded-2xl border border-emerald-400/20 bg-[#10291d]
          text-emerald-50 shadow-lg transition hover:bg-[#173827] xl:hidden
          ${isRtl ? "right-3" : "left-3"}
        `}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile */}
      {mobileOpen && (
        <div
          className={`
            fixed inset-0 z-[70] flex xl:hidden
            ${isRtl ? "justify-end" : "justify-start"}
          `}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={locale === "ar" ? "إغلاق القائمة" : "Close menu"}
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="relative z-[1] h-dvh w-[min(20.5rem,88vw)] max-w-[88vw] shadow-2xl">
            <Inner />
          </aside>
        </div>
      )}

      {/* Desktop */}
      <aside
        className={`
          fixed top-0 z-30 hidden h-dvh w-64 shadow-2xl xl:block
          ${isRtl ? "right-0" : "left-0"}
        `}
      >
        <Inner />
      </aside>
    </>
  );
}
