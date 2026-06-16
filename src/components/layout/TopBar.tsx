"use client";

import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useState, useEffect, useRef } from "react";
import ProfileMenu from "./ProfileMenu";
import { Search, Scale } from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";
import { translations } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";

const TITLE_KEYS: Record<string, keyof typeof translations.ar.dashboard> = {
  "/dashboard": "title",
  "/dashboard/appointments": "appointments",
  "/dashboard/cases": "cases",
  "/dashboard/clients": "clients",
  "/dashboard/documents": "documents",
  "/dashboard/payments": "payments",
  "/dashboard/reports": "reports",
  "/dashboard/settings": "settings",
  "/dashboard/tasks": "tasks",
  "/dashboard/activity": "activity",
  "/dashboard/billing": "billing",
  "/dashboard/team": "team",
};

function useDebounce<T>(val: T, ms: number) {
  const [d, setD] = useState(val);

  useEffect(() => {
    const t = setTimeout(() => setD(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);

  return d;
}

interface SR {
  clients: any[];
  cases: any[];
  tasks: any[];
  documents: any[];
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  const titleKey =
    Object.entries(TITLE_KEYS)
      .filter(([k]) => pathname === k || pathname.startsWith(k + "/"))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "title";

  const title = t.dashboard[titleKey] ?? t.dashboard.title;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SR | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dq = useDebounce(query, 280);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (dq.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(dq)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setResults(d.data);
      })
      .finally(() => setLoading(false));
  }, [dq]);

  const hasResults =
    results &&
    results.clients.length +
      results.cases.length +
      results.tasks.length +
      results.documents.length >
      0;

  const statusLabels = t.cases.statuses as Record<string, string>;

  const PRIORITY_DOT: Record<string, string> = {
    HIGH: "🔴",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  const now = new Date();

  const dateStr =
    locale === "ar"
      ? new Intl.DateTimeFormat("ar-JO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(now)
      : new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(now);

  const alignClass = isRtl ? "text-right" : "text-left";

  function closeSearch() {
    setOpen(false);
    setQuery("");
  }

  return (
    <header
      dir="ltr"
      className={`
        sticky top-0 z-20 flex min-h-[72px] min-w-0 flex-wrap items-center gap-3
        border-b border-slate-200 bg-white/85 py-3 shadow-sm backdrop-blur-[18px]
        transition-colors dark:border-[#2d4a3e] dark:bg-[#0d241a]/95
        sm:flex-nowrap sm:gap-4 lg:h-[72px] lg:py-0
        ${
          isRtl
            ? "pr-[72px] pl-4 lg:pr-6 lg:pl-6"
            : "pl-[72px] pr-4 lg:pl-6 lg:pr-6"
        }
      `}
    >
      {/* Search */}
      <div
        ref={ref}
        className="order-1 relative w-full min-w-0 flex-[1_0_100%] sm:order-4 sm:min-w-[220px] sm:flex-1 lg:max-w-[720px]"
      >
        <span
          className={`
            pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-emerald-200
            ${isRtl ? "right-3" : "left-3"}
          `}
        >
          <Search className="h-4 w-4" />
        </span>

        <input
          aria-label={t.topbar.searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t.topbar.searchPlaceholder}
          className={`
            h-11 w-full rounded-2xl border border-slate-200 bg-white py-2
            text-[16px] font-semibold text-slate-800 placeholder:text-slate-400
            shadow-sm outline-none transition-all hover:border-emerald-300
            focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10
            dark:border-emerald-700/60 dark:bg-[#08291d] dark:text-white
            dark:placeholder:text-emerald-200/80 dark:hover:border-emerald-500/80
            sm:text-sm
            ${isRtl ? "pr-10 pl-4 text-right" : "pl-10 pr-4 text-left"}
          `}
        />

        {loading && (
          <span
            className={`
              spinner-sm spinner absolute top-1/2 -translate-y-1/2
              ${isRtl ? "left-3" : "right-3"}
            `}
          />
        )}

        {/* Dropdown */}
        {open && query.length >= 2 && (
          <div
            className={`
              absolute top-full z-50 mt-2 max-h-[70vh] w-full overflow-y-auto rounded-2xl
              border border-slate-200 bg-white shadow-2xl dark:border-[#2d4a3e] dark:bg-[#10291d]
              sm:w-96
              ${isRtl ? "right-0" : "left-0"}
            `}
          >
            {!hasResults && !loading && (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-emerald-100/70">
                {t.topbar.noResultsFor} "{query}"
              </p>
            )}

            {results?.clients?.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  router.push(`/dashboard/clients/${c.id}`);
                  closeSearch();
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 ${alignClass} transition-colors hover:bg-slate-50 dark:hover:bg-[#173827]`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--green-soft)] text-xs font-bold text-[var(--sidebar)]">
                  {c.name?.[0] ?? "C"}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold text-slate-800 dark:text-emerald-50 ${alignClass}`}
                  >
                    {c.name}
                  </p>

                  <p
                    className={`truncate text-xs text-slate-500 dark:text-emerald-200 ${alignClass}`}
                  >
                    {c.phone ?? (locale === "ar" ? "موكل" : "Client")}
                  </p>
                </div>
              </button>
            ))}

            {results?.cases?.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  router.push(`/dashboard/cases/${c.id}`);
                  closeSearch();
                }}
                className={`flex w-full items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 ${alignClass} transition-colors hover:bg-slate-50 dark:border-[#2d4a3e] dark:hover:bg-[#173827]`}
              >
                <span className="text-xs">
                  <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold text-slate-800 dark:text-emerald-50 ${alignClass}`}
                  >
                    {c.title}
                  </p>

                  <p
                    className={`truncate text-xs text-slate-500 dark:text-emerald-200 ${alignClass}`}
                  >
                    {c.client?.name} · {statusLabels[c.status] ?? c.status}
                  </p>
                </div>
              </button>
            ))}

            {results?.tasks?.map((task) => (
              <button
                type="button"
                key={task.id}
                onClick={() => {
                  router.push("/dashboard/tasks");
                  closeSearch();
                }}
                className={`flex w-full items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 ${alignClass} transition-colors hover:bg-slate-50 dark:border-[#2d4a3e] dark:hover:bg-[#173827]`}
              >
                <span className="text-xs">{PRIORITY_DOT[task.priority]}</span>

                <p
                  className={`truncate text-sm text-slate-800 dark:text-emerald-50 ${alignClass} ${
                    task.completed ? "line-through" : ""
                  }`}
                >
                  {task.title}
                </p>
              </button>
            ))}

            {results?.documents?.map((document) => (
              <button
                type="button"
                key={document.id}
                onClick={() => {
                  router.push("/dashboard/documents");
                  closeSearch();
                }}
                className={`flex w-full items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 ${alignClass} transition-colors hover:bg-slate-50 dark:border-[#2d4a3e] dark:hover:bg-[#173827]`}
              >
                <span className="text-xs">📄</span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold text-slate-800 dark:text-emerald-50 ${alignClass}`}
                  >
                    {document.fileName}
                  </p>

                  <p
                    className={`truncate text-xs text-slate-500 dark:text-emerald-200 ${alignClass}`}
                  >
                    {locale === "ar" ? "مستند" : "Document"} ·{" "}
                    {document.fileType}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Account */}
      <div className="order-3 flex shrink-0 items-center sm:order-2">
        <ProfileMenu />
      </div>

      {/* Controls */}
      <div className="order-4 flex shrink-0 items-center gap-2 sm:order-3">
        <ThemeToggle />
        <LanguageToggle />

        <span
          className="
            hidden h-11 items-center gap-1.5 rounded-2xl border border-slate-200
            bg-slate-50/90 px-4 text-xs font-bold text-slate-700 shadow-sm
            transition-all hover:border-emerald-200 hover:bg-white md:flex
            dark:border-emerald-700/60 dark:bg-[#08291d] dark:text-white
            dark:hover:border-emerald-500/80 dark:hover:bg-[#103b2a]
          "
        >
          📅 {dateStr}
        </span>
      </div>

      {/* Title */}
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="order-2 min-w-0 shrink-0 text-right sm:order-1 sm:w-auto"
      >
        <h1 className="max-w-[42vw] truncate text-sm font-black text-slate-800 dark:text-emerald-50 sm:max-w-[180px] lg:max-w-[240px]">
          {title}
        </h1>
      </div>
    </header>
  );
}