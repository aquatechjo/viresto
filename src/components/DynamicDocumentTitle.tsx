"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

type LocalizedTitle = {
  ar: string;
  en: string;
};

const EXACT_TITLES: Record<string, LocalizedTitle> = {
  "/": { ar: "الرئيسية", en: "Home" },
  "/pricing": { ar: "الأسعار", en: "Pricing" },
  "/login": { ar: "تسجيل الدخول", en: "Sign in" },
  "/register": { ar: "إنشاء حساب", en: "Create account" },
  "/forgot-password": { ar: "نسيت كلمة المرور", en: "Forgot password" },
  "/reset-password": { ar: "إعادة تعيين كلمة المرور", en: "Reset password" },
  "/verify-email": { ar: "تأكيد البريد الإلكتروني", en: "Verify email" },
  "/admin": { ar: "لوحة إدارة الشركة", en: "Company admin dashboard" },
  "/dashboard": { ar: "لوحة التحكم", en: "Dashboard" },
  "/dashboard/activity": { ar: "سجل النشاط", en: "Activity log" },
  "/dashboard/appointments": { ar: "المواعيد", en: "Appointments" },
  "/dashboard/billing": {
    ar: "الاشتراك والفوترة",
    en: "Billing & subscription",
  },
  "/dashboard/cases": { ar: "القضايا", en: "Cases" },
  "/dashboard/clients": { ar: "الموكلون", en: "Clients" },
  "/dashboard/clients/new": { ar: "إضافة موكل", en: "Add client" },
  "/dashboard/documents": { ar: "المستندات", en: "Documents" },
  "/dashboard/tasks": { ar: "المهام", en: "Tasks" },
  "/dashboard/team": { ar: "الفريق", en: "Team" },
  "/dashboard/finance": { ar: "الإدارة المالية", en: "Finance" },
  "/dashboard/finance/invoices": { ar: "الفواتير", en: "Invoices" },
  "/dashboard/finance/payments": { ar: "المدفوعات", en: "Payments" },
  "/dashboard/finance/reports": { ar: "التقارير المالية", en: "Financial reports" },
  "/dashboard/invoices": { ar: "الفواتير", en: "Invoices" },
  "/dashboard/payments": { ar: "المدفوعات", en: "Payments" },
  "/dashboard/reports": { ar: "التقارير", en: "Reports" },
  "/dashboard/security": { ar: "الأمان", en: "Security" },
  "/dashboard/security/sessions": {
    ar: "الجلسات النشطة",
    en: "Active sessions",
  },
  "/dashboard/settings": { ar: "الإعدادات", en: "Settings" },
};

function normalizePathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function getRouteTitle(pathname: string): LocalizedTitle {
  const path = normalizePathname(pathname);
  const exactTitle = EXACT_TITLES[path];

  if (exactTitle) return exactTitle;

  if (/^\/dashboard\/cases\/[^/]+$/.test(path)) {
    return { ar: "تفاصيل القضية", en: "Case details" };
  }

  if (/^\/dashboard\/clients\/[^/]+$/.test(path)) {
    return { ar: "ملف الموكل", en: "Client profile" };
  }

  if (
    /^\/dashboard\/(?:finance\/)?invoices\/[^/]+$/.test(path)
  ) {
    return { ar: "تفاصيل الفاتورة", en: "Invoice details" };
  }

  if (path.startsWith("/dashboard")) {
    return { ar: "لوحة التحكم", en: "Dashboard" };
  }

  return { ar: "Viresto", en: "Viresto" };
}

function getBrowserLocale(): Locale {
  if (typeof document === "undefined") return "ar";

  const htmlLocale = document.documentElement.lang?.toLowerCase();
  if (htmlLocale === "en") return "en";

  try {
    const storedLocale =
      window.localStorage.getItem("locale") ||
      window.localStorage.getItem("viresto-locale");

    if (storedLocale === "en") return "en";
  } catch {
    // The HTML language remains the safe fallback when storage is unavailable.
  }

  return "ar";
}

export default function DynamicDocumentTitle() {
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>("ar");

  useEffect(() => {
    const syncLocale = () => setLocale(getBrowserLocale());
    const handleLocaleChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<Locale>).detail;
      setLocale(nextLocale === "en" ? "en" : "ar");
    };

    syncLocale();

    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    window.addEventListener("localechange", handleLocaleChange);
    window.addEventListener("storage", syncLocale);

    return () => {
      observer.disconnect();
      window.removeEventListener("localechange", handleLocaleChange);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  useEffect(() => {
    const pageTitle = getRouteTitle(pathname || "/")[locale];
    document.title = pageTitle === "Viresto" ? pageTitle : `${pageTitle} | Viresto`;
  }, [locale, pathname]);

  return null;
}
