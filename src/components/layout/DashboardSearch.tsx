"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, Scale } from "lucide-react";
import { translations } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import { startNavigationFeedback } from "@/lib/navigation-feedback";

function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);

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

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "🔴",
  MEDIUM: "🟡",
  LOW: "🟢",
};

interface DashboardSearchProps {
  /**
   * "topbar": results open as an absolute dropdown under the input.
   * "drawer": results render inline below the input, so the mobile drawer's
   * overflow-hidden container can't clip them and they span its full width.
   */
  variant: "topbar" | "drawer";
  /** Extra classes for the wrapper (e.g. TopBar grid placement). */
  className?: string;
  /** Called after a result is picked, e.g. to close the mobile drawer. */
  onNavigate?: () => void;
}

/**
 * Dashboard-wide search (clients, cases, tasks, documents via /api/search).
 * Rendered in the TopBar on xl+ and inside the Sidebar drawer below xl.
 * Both hosts are always-dark surfaces, so it uses the theme-invariant
 * --landing-* palette in both themes.
 */
export default function DashboardSearch({
  variant,
  className = "",
  onNavigate,
}: DashboardSearchProps) {
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        if (controller.signal.aborted) return;

        setResults(
          data?.success ? normalizeSearchResults(data.data) : EMPTY_RESULTS,
        );
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setResults(EMPTY_RESULTS);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  const safeResults = results ?? EMPTY_RESULTS;

  const hasResults =
    safeResults.clients.length +
      safeResults.cases.length +
      safeResults.tasks.length +
      safeResults.documents.length >
    0;

  const statusLabels = t.cases.statuses as Record<string, string>;
  const alignClass = isRtl ? "text-right" : "text-left";
  const isDrawer = variant === "drawer";

  function closeSearch() {
    setOpen(false);
    setQuery("");
  }

  function navigateFromSearch(href: string) {
    startNavigationFeedback();
    router.push(href);
    closeSearch();
    onNavigate?.();
  }

  function warmSearchRoute(href: string) {
    router.prefetch(href);
  }

  const rowClass = `flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 ${alignClass} transition-colors hover:bg-[var(--landing-surface-2)]`;
  const dividedRowClass = `${rowClass} border-t border-[var(--landing-border)]`;
  const primaryTextClass = `truncate text-sm font-semibold text-emerald-50 ${alignClass}`;
  const secondaryTextClass = `truncate text-xs text-emerald-200 ${alignClass}`;

  return (
    <div ref={searchRef} className={`relative w-full min-w-0 ${className}`}>
      <span
        className={`
          pointer-events-none absolute top-5 -translate-y-1/2
          text-emerald-200 sm:top-[22px]
          ${isRtl ? "right-3" : "left-3"}
        `}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </span>

      <input
        type="search"
        aria-label={t.topbar.searchPlaceholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t.topbar.searchPlaceholder}
        className={`
          h-10 w-full rounded-2xl border border-[var(--landing-border-strong)] bg-[#103334]/90 py-2
          text-[16px] font-semibold text-white placeholder:text-emerald-200/70
          shadow-none outline-none transition-all hover:border-copper-400/60
          focus:border-copper-400 focus:ring-4 focus:ring-copper-400/10
          sm:h-11 sm:text-sm
          [&::-webkit-search-cancel-button]:hidden
          ${isRtl ? "pr-10 pl-10 text-right" : "pl-10 pr-10 text-left"}
        `}
      />

      {loading && (
        <span
          className={`
            spinner-sm spinner absolute top-5 -translate-y-1/2 sm:top-[22px]
            ${isRtl ? "left-3" : "right-3"}
          `}
        />
      )}

      {open && query.length >= 2 && (
        <div
          className={
            isDrawer
              ? "mt-2 max-h-[55dvh] w-full overflow-y-auto overscroll-contain rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-xl"
              : `absolute top-full z-[55] mt-2 max-h-[62vh] w-full max-w-[calc(100vw-1.25rem)] overflow-y-auto rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-2xl xl:min-w-[440px] ${
                  isRtl ? "right-0" : "left-0"
                }`
          }
        >
          {!hasResults && !loading && (
            <p className="px-4 py-4 text-center text-sm text-emerald-100/70">
              {t.topbar.noResultsFor} &quot;{query}&quot;
            </p>
          )}

          {safeResults.clients.map((client, index) => {
            const href = `/dashboard/clients/${client.publicId ?? client.id}`;

            return (
              <button
                type="button"
                key={client.id}
                onMouseEnter={() => warmSearchRoute(href)}
                onFocus={() => warmSearchRoute(href)}
                onClick={() => navigateFromSearch(href)}
                className={index === 0 ? rowClass : dividedRowClass}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-300/10 text-xs font-bold text-teal-200">
                  {client.name?.[0] ?? "C"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className={primaryTextClass}>{client.name}</p>
                  <p className={secondaryTextClass}>
                    {client.phone ?? (locale === "ar" ? "موكل" : "Client")}
                  </p>
                </div>
              </button>
            );
          })}

          {safeResults.cases.map((caseItem) => {
            const href = `/dashboard/cases/${caseItem.publicId ?? caseItem.id}`;

            return (
              <button
                type="button"
                key={caseItem.id}
                onMouseEnter={() => warmSearchRoute(href)}
                onFocus={() => warmSearchRoute(href)}
                onClick={() => navigateFromSearch(href)}
                className={dividedRowClass}
              >
                <Scale className="h-4 w-4 shrink-0 text-emerald-300" />

                <div className="min-w-0 flex-1">
                  <p className={primaryTextClass}>{caseItem.title}</p>
                  <p className={secondaryTextClass}>
                    {caseItem.client?.name} ·{" "}
                    {statusLabels[caseItem.status] ?? caseItem.status}
                  </p>
                </div>
              </button>
            );
          })}

          {safeResults.tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              onMouseEnter={() => warmSearchRoute("/dashboard/tasks")}
              onFocus={() => warmSearchRoute("/dashboard/tasks")}
              onClick={() => navigateFromSearch("/dashboard/tasks")}
              className={dividedRowClass}
            >
              <span className="shrink-0 text-xs">
                {PRIORITY_DOT[task.priority]}
              </span>

              <p
                className={`min-w-0 flex-1 truncate text-sm text-emerald-50 ${alignClass} ${
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
              onMouseEnter={() => warmSearchRoute("/dashboard/documents")}
              onFocus={() => warmSearchRoute("/dashboard/documents")}
              onClick={() => navigateFromSearch("/dashboard/documents")}
              className={dividedRowClass}
            >
              <span className="shrink-0 text-xs">📄</span>

              <div className="min-w-0 flex-1">
                <p className={primaryTextClass}>{document.fileName}</p>
                <p className={secondaryTextClass}>
                  {locale === "ar" ? "مستند" : "Document"} ·{" "}
                  {document.fileType}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
