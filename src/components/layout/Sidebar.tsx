"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  CreditCard,
  Settings,
  LogOut,
  Menu,
  Activity,
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
      {
        href: "/dashboard/billing",
        labelKey: "billing",
        icon: CreditCard,
        roles: ["ADMIN"],
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
    fetch("/api/auth/me")
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

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    toast.success(t.sidebar.logoutSuccess);
    router.push("/login");
  }

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  const Inner = () => (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="flex h-full flex-col bg-[#0f2b21] text-emerald-50"
    >
      {/* Brand */}
      <div className="border-b border-emerald-100/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50/10 ring-1 ring-emerald-100/10">
            <img
              src="/logo.png"
              alt="Viresto"
              className="h-12 w-12 object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="text-lg font-black leading-tight text-emerald-50">
              Viresto
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        {NAV.map((group) => (
          <div key={group.sectionKey} className="mb-5">
            <p className="mb-2 px-3 text-start text-xs font-black tracking-wide text-emerald-100/55">
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
                        group flex h-12 items-center gap-3 rounded-2xl px-4 text-sm font-black transition-all duration-200
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
      <div className="border-t border-emerald-100/10 p-4">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-2xl bg-emerald-50/5 p-3 transition hover:bg-emerald-50/10"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#294d3c] text-sm font-black text-emerald-50">
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
          type="button"
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f4d35] px-4 py-3 text-sm font-black text-emerald-50 transition hover:bg-[#276342]"
        >
          <LogOut className="h-4 w-4" />
          {t.sidebar.logout}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        aria-label={t.sidebar.openMenu}
        title={t.sidebar.openMenu}
        onClick={() => setMobileOpen(true)}
        className={`
          fixed top-4 z-50 flex h-11 w-11 items-center justify-center
          rounded-2xl border border-emerald-400/20 bg-[#10291d]
          text-emerald-50 shadow-lg lg:hidden
          ${isRtl ? "right-4" : "left-4"}
        `}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile */}
      {mobileOpen && (
        <div
          className={`
            fixed inset-0 z-40 flex lg:hidden
            ${isRtl ? "justify-end" : "justify-start"}
          `}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="relative h-full w-72 shadow-2xl">
            <Inner />
          </aside>
        </div>
      )}

      {/* Desktop */}
      <aside
        className={`
          fixed top-0 z-30 hidden h-full w-64 shadow-2xl lg:block
          ${isRtl ? "right-0" : "left-0"}
        `}
      >
        <Inner />
      </aside>
    </>
  );
}
