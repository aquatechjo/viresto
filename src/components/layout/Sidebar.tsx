"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { toast } from "sonner";

import {
  LayoutDashboard,
  CalendarDays,
  Briefcase,
  Users,
  FileText,
  ReceiptText,
  Banknote,
  BarChart3,
  CreditCard,
  Settings,
  Menu,
  Activity,
  ShieldCheck,
  X,
} from "lucide-react";

import { initials } from "@/lib/utils";
import { translations } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import {
  getCurrentUser,
  invalidateCurrentUser,
} from "@/lib/client-session";

type Role = "ADMIN" | "LAWYER" | "STAFF";

type NavLabelKey =
  | "dashboard"
  | "clients"
  | "cases"
  | "documents"
  | "appointments"
  | "tasks"
  | "team"
  | "activity"
  | "billing";

type SectionKey = "main" | "management" | "finance" | "business";

type NavItem = {
  href: string;
  labelKey?: NavLabelKey;
  label?: { ar: string; en: string };
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
    sectionKey: "finance",
    items: [
      {
        href: "/dashboard/finance/invoices",
        label: { ar: "الفواتير", en: "Invoices" },
        icon: ReceiptText,
        roles: ["ADMIN", "LAWYER"],
      },
      {
        href: "/dashboard/finance/payments",
        label: { ar: "الدفعات", en: "Payments" },
        icon: Banknote,
        roles: ["ADMIN", "LAWYER"],
      },
      {
        href: "/dashboard/finance/reports",
        label: { ar: "التقارير", en: "Reports" },
        icon: BarChart3,
        roles: ["ADMIN", "LAWYER"],
      },
    ],
  },
  {
    sectionKey: "business",
    items: [
      {
        href: "/dashboard/billing",
        labelKey: "billing",
        icon: CreditCard,
        roles: ["ADMIN"],
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
  isSystemAdmin: boolean;
}

function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "LAWYER" || value === "STAFF";
}

export default function Sidebar() {
  const pathname = usePathname();
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getCurrentUser()
      .then((result) => {
        const userData = result.user;

        if (
          !cancelled &&
          result.ok &&
          userData &&
          isRole(userData.role)
        ) {
          setUser({
            name: userData.name,
            email: userData.email,
            role: userData.role,
            isSystemAdmin: Boolean(userData.isSystemAdmin),
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  async function logout() {
    localStorage.removeItem("viresto_last_activity");
    invalidateCurrentUser();

    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => null);

    toast.success(t.sidebar.logoutSuccess);
    window.location.href = "/login";
  }

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--brand-shell)] text-emerald-50"
      >
        {/* Brand */}
        <div className="shrink-0 border-b border-emerald-100/10 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-copper-400/30 bg-[var(--brand-canvas)] shadow-lg shadow-black/20">
              <img
                src="/logo.png"
                alt="Viresto"
                className="h-full w-full scale-[1.22] object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black leading-tight text-white">
                Viresto
              </p>

              <p className="mt-1 truncate text-xs font-bold text-copper-300">
                Legal Platform
              </p>
            </div>

            {mobile && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={locale === "ar" ? "إغلاق القائمة" : "Close menu"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-[var(--brand-surface)] text-emerald-50 transition hover:bg-[var(--brand-surface-hover)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
          {NAV.map((group) => (
            <div key={group.sectionKey} className="mb-3.5 last:mb-0 sm:mb-4">
              <p className="mb-1.5 px-3 text-start text-[10px] font-black uppercase tracking-wide text-emerald-100/55 sm:mb-2 sm:text-[11px]">
                {group.sectionKey === "finance"
                  ? locale === "ar"
                    ? "المالية"
                    : "Finance"
                  : t.sidebar.sections[group.sectionKey]}
              </p>

              <div className="space-y-1">
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
                          group flex h-10 min-w-0 items-center gap-3 rounded-2xl
                          px-3 text-sm font-black transition-all duration-200
                          sm:h-11 sm:px-4
                          ${
                            active
                              ? "bg-[#b87333] text-[#041819] shadow-sm ring-1 ring-copper-300/40"
                              : "text-emerald-100/70 hover:bg-[var(--brand-surface-hover)] hover:text-emerald-50"
                          }
                        `}
                      >
                        <Icon
                          className={`
                            h-[18px] w-[18px] shrink-0 transition-all sm:h-5 sm:w-5
                            ${
                              active
                                ? "text-[#041819]"
                                : "text-emerald-100/55 group-hover:text-emerald-200"
                            }
                          `}
                          aria-hidden="true"
                        />

                        <span className="min-w-0 flex-1 truncate text-start">
                          {item.label
                            ? item.label[locale]
                            : item.labelKey
                              ? t.sidebar.nav[item.labelKey]
                              : ""}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        {user?.isSystemAdmin && (
          <div className="shrink-0 px-3 pb-2 sm:px-4 sm:pb-3">
            <Link
              href="/admin"
              className="group flex min-h-12 items-center gap-3 rounded-2xl border border-copper-300/35 bg-copper-500/15 px-3 py-2.5 text-emerald-50 transition hover:border-copper-300/65 hover:bg-copper-500/25 sm:px-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#b87333] text-[#041819] shadow-sm">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1 text-start">
                <span className="block truncate text-sm font-black">
                  {locale === "ar"
                    ? "لوحة إدارة الشركة"
                    : "Company admin"}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-emerald-100/60">
                  {locale === "ar"
                    ? "المكاتب والاشتراكات"
                    : "Offices & subscriptions"}
                </span>
              </span>
            </Link>
          </div>
        )}

        {/* User + Logout */}
        <div className="shrink-0 border-t border-emerald-100/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <Link
            href="/dashboard/settings"
            className="flex min-w-0 items-center gap-3 rounded-2xl bg-emerald-50/5 p-2.5 transition hover:bg-emerald-50/10 sm:p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-copper-500 text-xs font-black text-[#041819] sm:h-10 sm:w-10 sm:rounded-2xl sm:text-sm">
              {user ? initials(user.name) : "L"}
            </div>

            <div className="min-w-0 flex-1 text-start">
              <p className="truncate text-sm font-black text-emerald-50">
                {user?.name ?? "..."}
              </p>

              <p className="mt-0.5 truncate text-[11px] font-medium text-emerald-100/65 sm:text-xs">
                {user ? (t.sidebar.roles[user.role] ?? user.role) : ""}
              </p>
            </div>

            <Settings
              className="h-4 w-4 shrink-0 text-emerald-100/60"
              aria-hidden="true"
            />
          </Link>

          <button
            suppressHydrationWarning
            type="button"
            onClick={logout}
            className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#b87333] px-4 text-sm font-bold text-[#041819] transition hover:bg-[#cc8e55] sm:mt-3 sm:h-11"
          >
            {locale === "ar" ? "تسجيل الخروج" : "Logout"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile / tablet trigger */}
      <button
        type="button"
        aria-label={t.sidebar.openMenu}
        aria-expanded={mobileOpen}
        title={t.sidebar.openMenu}
        onClick={() => setMobileOpen(true)}
        className={`
          fixed top-[max(0.75rem,env(safe-area-inset-top))] z-[80]
          flex h-10 w-10 items-center justify-center rounded-2xl
          border border-emerald-400/20 bg-[var(--brand-surface)] text-emerald-50
          shadow-lg transition duration-200 hover:bg-[var(--brand-surface-hover)] xl:hidden
          ${isRtl ? "right-3" : "left-3"}
          ${
            mobileOpen
              ? "pointer-events-none scale-95 opacity-0"
              : "scale-100 opacity-100"
          }
        `}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Mobile / tablet drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[70] xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={locale === "ar" ? "قائمة التنقل" : "Navigation menu"}
        >
          <button
            type="button"
            aria-label={locale === "ar" ? "إغلاق القائمة" : "Close menu"}
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside
            className={`
              absolute inset-y-0 z-[1] h-dvh w-[min(19rem,88vw)]
              max-w-[88vw] shadow-2xl
              ${isRtl ? "right-0" : "left-0"}
            `}
          >
            <SidebarContent mobile />
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
        <SidebarContent />
      </aside>
    </>
  );
}
