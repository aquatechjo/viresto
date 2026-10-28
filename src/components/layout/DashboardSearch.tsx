"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Receipt,
  Scale,
  Search,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { translations } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import { startNavigationFeedback } from "@/lib/navigation-feedback";
import type {
  SearchGroup,
  SearchResultItem,
  SearchResults,
} from "@/lib/global-search";

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

const GROUP_ORDER: SearchGroup[] = [
  "clients",
  "cases",
  "invoices",
  "payments",
  "documents",
  "appointments",
  "tasks",
  "team",
];

const GROUP_ICONS: Record<SearchGroup, LucideIcon> = {
  clients: Users,
  cases: Scale,
  invoices: Receipt,
  payments: Wallet,
  documents: FileText,
  appointments: CalendarDays,
  tasks: CheckSquare,
  team: UserCog,
};

type SearchState =
  | { status: "idle" }
  | { status: "loading"; results: SearchResults | null }
  | { status: "done"; results: SearchResults }
  | { status: "error"; message: string };

interface FlatItem {
  group: SearchGroup;
  item: SearchResultItem;
}

interface DashboardSearchProps {
  /**
   * "topbar": results open as an absolute dropdown under the input, and
   * Ctrl+K / ⌘K focuses it.
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
 * Office-wide search (clients, cases, invoices, payments, documents,
 * appointments, tasks, team via /api/search), grouped by type.
 * Rendered in the TopBar on xl+ and inside the Sidebar drawer below xl.
 * Both hosts are always-dark surfaces in light and dark mode, so the input
 * and dropdown use the theme-invariant --landing-* palette.
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = `dashboard-search-${variant}`;

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

  // Ctrl+K / ⌘K focuses the TopBar box when it is on screen (xl+).
  // event.code so it also works on an Arabic keyboard layout.
  useEffect(() => {
    if (variant !== "topbar") return;

    function handleShortcut(event: KeyboardEvent) {
      const input = inputRef.current;
      if (
        !input ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        (event.code !== "KeyK" && event.key.toLowerCase() !== "k") ||
        input.getClientRects().length === 0
      ) {
        return;
      }

      event.preventDefault();
      input.focus();
      input.select();
      setOpen(true);
    }

    document.addEventListener("keydown", handleShortcut);

    return () => document.removeEventListener("keydown", handleShortcut);
  }, [variant]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      DEBOUNCE_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < MIN_LENGTH) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setState((current) => ({
      status: "loading",
      results: current.status === "done" ? current.results : null,
    }));

    const params = new URLSearchParams({ q: debouncedQuery, locale });

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          throw new Error(
            typeof data?.message === "string"
              ? data.message
              : t.topbar.searchFailed,
          );
        }

        setState({ status: "done", results: data.data as SearchResults });
        setActiveIndex(0);
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setState({
          status: "error",
          message: error.message || t.topbar.searchFailed,
        });
      });

    return () => controller.abort();
  }, [debouncedQuery, locale, t.topbar.searchFailed]);

  const results =
    state.status === "done" || state.status === "loading"
      ? state.results
      : null;

  const flatItems = useMemo<FlatItem[]>(
    () =>
      results
        ? GROUP_ORDER.flatMap((group) =>
            (results[group] ?? []).map((item) => ({ group, item })),
          )
        : [],
    [results],
  );

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function clearSearch() {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setState({ status: "idle" });
  }

  function navigateFromSearch(href: string) {
    startNavigationFeedback();
    router.push(href);
    clearSearch();
    inputRef.current?.blur();
    onNavigate?.();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
      return;
    }

    if (!open || flatItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flatItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + flatItems.length) % flatItems.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = flatItems[activeIndex] ?? flatItems[0];
      navigateFromSearch(target.item.href);
    }
  }

  function badgeLabel(group: SearchGroup, code?: string) {
    if (!code) return null;
    if (group === "clients" && code === "ARCHIVED") {
      return t.topbar.searchArchived;
    }
    if (group === "cases") {
      return (t.cases.statuses as Record<string, string>)[code] ?? null;
    }
    if (group === "team") {
      if (code === "INACTIVE") return t.topbar.searchInactive;
      return (t.sidebar.roles as Record<string, string>)[code] ?? null;
    }
    return null;
  }

  const trimmed = query.trim();
  const isTyping = trimmed !== debouncedQuery;
  // Nothing shows below two characters: no hint, no dropdown.
  const showDropdown = open && trimmed.length >= MIN_LENGTH;
  const showLoading =
    flatItems.length === 0 && (state.status === "loading" || isTyping);
  const showEmpty =
    !isTyping && state.status === "done" && flatItems.length === 0;
  const busy =
    trimmed.length >= MIN_LENGTH && (state.status === "loading" || isTyping);

  const alignClass = isRtl ? "text-right" : "text-left";
  const isDrawer = variant === "drawer";
  const activeOption = showDropdown ? flatItems[activeIndex] : undefined;

  let runningIndex = 0;

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
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label={t.topbar.searchPlaceholder}
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeOption
            ? `${listId}-${activeOption.group}-${activeOption.item.id}`
            : undefined
        }
        aria-keyshortcuts={variant === "topbar" ? "Control+K Meta+K" : undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
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

      {busy && (
        <span
          className={`
            spinner-sm spinner absolute top-5 -translate-y-1/2 sm:top-[22px]
            ${isRtl ? "left-3" : "right-3"}
          `}
        />
      )}

      {showDropdown && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t.topbar.searchPlaceholder}
          className={
            isDrawer
              ? "mt-2 max-h-[55dvh] w-full overflow-y-auto overscroll-contain rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-1.5 shadow-xl"
              : "absolute inset-x-0 top-full z-[60] mt-2 max-h-[62vh] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-1.5 shadow-2xl"
          }
        >
          {showLoading && <StatusLine text={t.topbar.searching} />}
          {showEmpty && (
            <StatusLine text={`${t.topbar.noResultsFor} "${trimmed}"`} />
          )}
          {state.status === "error" && !isTyping && (
            <StatusLine text={state.message} tone="danger" />
          )}

          {results &&
            GROUP_ORDER.map((group) => {
              const items = results[group] ?? [];
              if (items.length === 0) return null;
              const Icon = GROUP_ICONS[group];

              return (
                <div
                  key={group}
                  role="group"
                  aria-label={t.topbar.searchGroups[group]}
                >
                  <p
                    className={`px-2.5 pb-1 pt-2.5 text-[11px] font-black tracking-wide text-emerald-200/70 ${alignClass}`}
                  >
                    {t.topbar.searchGroups[group]}
                  </p>

                  {items.map((item) => {
                    const index = runningIndex++;
                    const active = index === activeIndex;
                    const badge = badgeLabel(group, item.badge);

                    return (
                      <button
                        type="button"
                        key={item.id}
                        id={`${listId}-${group}-${item.id}`}
                        role="option"
                        aria-selected={active}
                        tabIndex={-1}
                        data-index={index}
                        onMouseMove={() => {
                          if (!active) setActiveIndex(index);
                        }}
                        onMouseEnter={() => router.prefetch(item.href)}
                        onClick={() => navigateFromSearch(item.href)}
                        className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 ${alignClass} transition-colors ${
                          active ? "bg-[var(--landing-surface-2)]" : ""
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            active
                              ? "bg-copper-400/15 text-copper-300"
                              : "bg-teal-300/10 text-teal-200"
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <bdi className="truncate text-sm font-semibold text-emerald-50">
                              {item.title}
                            </bdi>
                            {badge && (
                              <span className="shrink-0 rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 text-[10px] font-bold text-emerald-100/80">
                                {badge}
                              </span>
                            )}
                          </span>
                          {item.meta.length > 0 && (
                            <span className="mt-0.5 block truncate text-xs text-emerald-200">
                              {item.meta.map((part, partIndex) => (
                                <span key={partIndex}>
                                  {partIndex > 0 && " · "}
                                  <bdi>{part}</bdi>
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function StatusLine({
  text,
  tone = "muted",
}: {
  text: string;
  tone?: "muted" | "danger";
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`px-4 py-4 text-center text-sm ${
        tone === "danger" ? "text-red-300" : "text-emerald-100/70"
      }`}
    >
      <bdi>{text}</bdi>
    </p>
  );
}
