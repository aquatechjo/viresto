"use client";

import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useEffect, useRef, useState } from "react";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "./NotificationBell";
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
  "/dashboard/invoices": "invoices",
  "/dashboard/payments": "payments",
  "/dashboard/reports": "reports",
  "/dashboard/settings": "settings",
  "/dashboard/tasks": "tasks",
  "/dashboard/activity": "activity",
  "/dashboard/billing": "billing",
  "/dashboard/team": "team",
};

function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedValue(value),
      delay,
    );

    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

interface SearchResults {
  clients: any[];
  cases: any[];
  tasks: any[];
  documents: any[];
}

const EMPTY_RESULTS: SearchResults = {
  clients: [],
  cases: [],
  tasks: [],
  documents: [],
};

function normalizeSearchResults(
  data: Partial<SearchResults> | null | undefined,
): SearchResults {
  return {
    clients: Array.isArray(data?.clients) ? data.clients : [],
    cases: Array.isArray(data?.cases) ? data.cases : [],
    tasks: Array.isArray(data?.tasks) ? data.tasks : [],
    documents: Array.isArray(data?.documents) ? data.documents : [],
  };
}

const COMPACT_CONTROL =
  "[&>button]:h-9 [&>button]:w-9 [&>button]:min-w-9 " +
  "[&>button]:items-center [&>button]:justify-center " +
  "[&>button]:rounded-xl [&>button]:px-0 " +
  "sm:[&>button]:h-10 sm:[&>button]:w-10 sm:[&>button]:min-w-10 " +
  "sm:[&>button]:rounded-2xl";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  const titleKey =
    Object.entries(TITLE_KEYS)
      .filter(([path]) => pathname === path || pathname.startsWith(`${path}/`))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "title";

  const title = t.dashboard[titleKey] ?? t.dashboard.title;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dateStr, setDateStr] = useState("");

  const debouncedQuery = useDebounce(query, 280);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;

        setResults(
          data?.success
            ? normalizeSearchResults(data.data)
            : EMPTY_RESULTS,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setResults(EMPTY_RESULTS);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    const formatter =
      locale === "ar"
        ? new Intl.DateTimeFormat("ar-JO", {
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

  const safeResults = results ?? EMPTY_RESULTS;

  const hasResults =
    safeResults.clients.length +
      safeResults.cases.length +
      safeResults.tasks.length +
      safeResults.documents.length >
    0;

  const statusLabels = t.cases.statuses as Record<string, string>;

  const priorityDot: Record<string, string> = {
    HIGH: "🔴",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  const alignClass = isRtl ? "text-right" : "text-left";

  function closeSearch() {
    setOpen(false);
    setQuery("");
  }

  return (
    <header
      dir={isRtl ? "rtl" : "ltr"}
      className={`
        fixed top-0 z-40 min-w-0 overflow-visible border-b border-slate-200
        bg-white/92 shadow-sm backdrop-blur-[18px] transition-colors
        dark:border-[#0f3d3e] dark:bg-[#082526]/95
        ${
          isRtl
            ? "right-0 left-0 pr-[62px] pl-2.5 sm:pr-[68px] sm:pl-4 xl:right-64 xl:px-6"
            : "left-0 right-0 pl-[62px] pr-2.5 sm:pl-[68px] sm:pr-4 xl:left-64 xl:px-6"
        }
      `}
    >
      <div
        className="
          grid min-h-[112px] w-full min-w-0
          grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]
          items-center gap-x-1.5 gap-y-2 py-2.5
          sm:min-h-[116px] sm:gap-x-2
          xl:min-h-[76px]
          xl:grid-cols-[minmax(280px,1fr)_auto_auto_auto_auto_auto_auto]
          xl:gap-3 xl:py-3
        "
      >
        {/* Page title — first cell on mobile, last cell on desktop */}
        <div
          className={`
            col-start-1 row-start-1 min-w-0
            xl:col-start-7 xl:row-start-1 xl:max-w-[220px]
            ${isRtl ? "text-right xl:text-left" : "text-left xl:text-right"}
          `}
        >
          <h1 className="truncate text-sm font-black text-slate-800 dark:text-emerald-50 sm:text-base">
            {title}
          </h1>
        </div>

        {/* Language */}
        <div
          className={`col-start-2 row-start-1 shrink-0 xl:col-start-3 ${COMPACT_CONTROL}`}
        >
          <LanguageToggle />
        </div>

        {/* Theme */}
        <div
          className={`col-start-3 row-start-1 shrink-0 xl:col-start-4 ${COMPACT_CONTROL}`}
        >
          <ThemeToggle />
        </div>

        {/* Notifications */}
        <div
          className={`relative z-50 col-start-4 row-start-1 shrink-0 overflow-visible xl:col-start-5 ${COMPACT_CONTROL}`}
        >
          <NotificationBell />
        </div>

        {/* Profile — avatar only on mobile/tablet, full control on desktop */}
        <div className="relative z-50 col-start-5 row-start-1 min-w-0 shrink-0 overflow-visible xl:col-start-6">
          <ProfileMenu />
        </div>

        {/* Date — desktop only */}
        <span
          className="
            hidden h-10 shrink-0 items-center gap-1.5 rounded-2xl
            border border-slate-200 bg-slate-50/90 px-3 text-xs font-bold
            text-slate-700 shadow-sm transition-all hover:border-emerald-200
            hover:bg-white xl:col-start-2 xl:row-start-1 xl:flex
            dark:border-emerald-700/60 dark:bg-[#082c2d] dark:text-white
            dark:hover:border-emerald-500/80 dark:hover:bg-[#185354]
          "
        >
          📅 {dateStr || "—"}
        </span>

        {/* Search — full-width second row on mobile/tablet */}
        <div
          ref={searchRef}
          className="
            relative col-span-full row-start-2 w-full min-w-0
            xl:col-span-1 xl:col-start-1 xl:row-start-1
            xl:min-w-[280px] xl:max-w-[860px]
          "
        >
          <span
            className={`
              pointer-events-none absolute top-1/2 -translate-y-1/2
              text-slate-400 dark:text-emerald-200
              ${isRtl ? "right-3" : "left-3"}
            `}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </span>

          <input
            aria-label={t.topbar.searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t.topbar.searchPlaceholder}
            className={`
              h-10 w-full rounded-2xl border border-slate-200 bg-white py-2
              text-[16px] font-semibold text-slate-800 placeholder:text-slate-400
              shadow-sm outline-none transition-all hover:border-emerald-300
              focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10
              sm:h-11 sm:text-sm
              dark:border-emerald-700/60 dark:bg-[#082c2d] dark:text-white
              dark:placeholder:text-emerald-200/80 dark:hover:border-emerald-500/80
              ${isRtl ? "pr-10 pl-10 text-right" : "pl-10 pr-10 text-left"}
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

          {open && query.length >= 2 && (
            <div
              className={`
                absolute top-full z-[55] mt-2 max-h-[62vh] w-full
                max-w-[calc(100vw-1.25rem)] overflow-y-auto rounded-2xl
                border border-slate-200 bg-white shadow-2xl
                dark:border-[#0f3d3e] dark:bg-[#0b292a]
                xl:min-w-[440px]
                ${isRtl ? "right-0" : "left-0"}
              `}
            >
              {!hasResults && !loading && (
                <p className="px-4 py-4 text-center text-sm text-slate-500 dark:text-emerald-100/70">
                  {t.topbar.noResultsFor} &quot;{query}&quot;
                </p>
              )}

              {safeResults.clients.map((client) => (
                <button
                  type="button"
                  key={client.id}
                  onClick={() => {
                    router.push(`/dashboard/clients/${client.id}`);
                    closeSearch();
                  }}
                  className={`flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 ${alignClass} transition-colors hover:bg-slate-50 dark:hover:bg-[#123f40]`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--green-soft)] text-xs font-bold text-[var(--sidebar)]">
                    {client.name?.[0] ?? "C"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold text-slate-800 dark:text-emerald-50 ${alignClass}`}
                    >
                      {client.name}
                    </p>

                    <p
                      className={`truncate text-xs text-slate-500 dark:text-emerald-200 ${alignClass}`}
                    >
                      {client.phone ??
                        (locale === "ar" ? "موكل" : "Client")}
                    </p>
                  </div>
                </button>
              ))}

              {safeResults.cases.map((caseItem) => (
                <button
                  type="button"
                  key={caseItem.id}
                  onClick={() => {
                    router.push(`/dashboard/cases/${caseItem.id}`);
                    closeSearch();
                  }}
                  className={`flex w-full min-w-0 items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 ${alignClass} transition-colors hover:bg-slate-50 dark:border-[#0f3d3e] dark:hover:bg-[#123f40]`}
                >
                  <Scale className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold text-slate-800 dark:text-emerald-50 ${alignClass}`}
                    >
                      {caseItem.title}
                    </p>

                    <p
                      className={`truncate text-xs text-slate-500 dark:text-emerald-200 ${alignClass}`}
                    >
                      {caseItem.client?.name} ·{" "}
                      {statusLabels[caseItem.status] ?? caseItem.status}
                    </p>
                  </div>
                </button>
              ))}

              {safeResults.tasks.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => {
                    router.push("/dashboard/tasks");
                    closeSearch();
                  }}
                  className={`flex w-full min-w-0 items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 ${alignClass} transition-colors hover:bg-slate-50 dark:border-[#0f3d3e] dark:hover:bg-[#123f40]`}
                >
                  <span className="shrink-0 text-xs">
                    {priorityDot[task.priority]}
                  </span>

                  <p
                    className={`min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-emerald-50 ${alignClass} ${
                      task.completed ? "line-through" : ""
                    }`}
                  >
                    {task.title}
                  </p>
                </button>
              ))}

              {safeResults.documents.map((document) => (
                <button
                  type="button"
                  key={document.id}
                  onClick={() => {
                    router.push("/dashboard/documents");
                    closeSearch();
                  }}
                  className={`flex w-full min-w-0 items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 ${alignClass} transition-colors hover:bg-slate-50 dark:border-[#0f3d3e] dark:hover:bg-[#123f40]`}
                >
                  <span className="shrink-0 text-xs">📄</span>

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
      </div>
    </header>
  );
}
