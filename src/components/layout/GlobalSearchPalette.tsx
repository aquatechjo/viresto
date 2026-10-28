"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  X,
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

// Office-wide search palette (GET /api/search). Mounted once, in the TopBar;
// the search boxes in the TopBar and the Sidebar drawer open it through
// openGlobalSearch(), and Ctrl+K / ⌘K opens it from anywhere. Unlike the
// always-dark search boxes, the palette uses the theme tokens (--card,
// --text…) so it follows light and dark mode.

const OPEN_EVENT = "viresto:open-global-search";
const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

export function openGlobalSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

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

export default function GlobalSearchPalette() {
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setState({ status: "idle" });
  }, []);

  // Ctrl+K / ⌘K toggles; event.code so it also works on an Arabic layout.
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        (event.code === "KeyK" || event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    function handleOpen() {
      setOpen(true);
    }

    document.addEventListener("keydown", handleShortcut);
    window.addEventListener(OPEN_EVENT, handleOpen);

    return () => {
      document.removeEventListener("keydown", handleShortcut);
      window.removeEventListener(OPEN_EVENT, handleOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    // Esc from anywhere in the palette, the input included.
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      DEBOUNCE_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!open || debouncedQuery.length < MIN_LENGTH) {
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
            typeof data?.message === "string" ? data.message : t.topbar.searchFailed,
          );
        }

        setState({ status: "done", results: data.data as SearchResults });
        setActiveIndex(0);
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setState({ status: "error", message: error.message || t.topbar.searchFailed });
      });

    return () => controller.abort();
  }, [debouncedQuery, open, locale, t.topbar.searchFailed]);

  const results =
    state.status === "done" || state.status === "loading" ? state.results : null;

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

  function navigate(href: string) {
    close();
    startNavigationFeedback();
    router.push(href);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flatItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flatItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flatItems.length) % flatItems.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = flatItems[activeIndex] ?? flatItems[0];
      navigate(target.item.href);
    }
  }

  function badgeLabel(group: SearchGroup, code?: string) {
    if (!code) return null;
    if (group === "clients" && code === "ARCHIVED") return t.topbar.searchArchived;
    if (group === "cases") {
      return (t.cases.statuses as Record<string, string>)[code] ?? null;
    }
    if (group === "team") {
      if (code === "INACTIVE") return t.topbar.searchInactive;
      return (t.sidebar.roles as Record<string, string>)[code] ?? null;
    }
    return null;
  }

  if (!open) return null;

  const trimmed = query.trim();
  const isTyping = trimmed !== debouncedQuery;
  const showHint = trimmed.length < MIN_LENGTH;
  const showLoading =
    !showHint && flatItems.length === 0 && (state.status === "loading" || isTyping);
  const showEmpty =
    !showHint && !isTyping && state.status === "done" && flatItems.length === 0;
  const alignClass = isRtl ? "text-right" : "text-left";
  const activeOption = flatItems[activeIndex];

  let runningIndex = 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm animate-in fade-in duration-150 sm:p-6 sm:pt-[10vh]"
      style={{ background: "var(--overlay)" }}
      onMouseDown={close}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.topbar.searchPlaceholder}
        className="flex max-h-[min(80dvh,640px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl animate-in zoom-in-95 slide-in-from-top-2 duration-150"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Query */}
        <div
          className="flex shrink-0 items-center gap-3 border-b px-4"
          style={{ borderColor: "var(--border)" }}
        >
          <Search className="h-5 w-5 shrink-0" style={{ color: "var(--text-3)" }} aria-hidden="true" />

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-controls="global-search-results"
            aria-activedescendant={
              activeOption ? `global-search-${activeOption.group}-${activeOption.item.id}` : undefined
            }
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t.topbar.searchPlaceholder}
            className={`h-14 min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:font-medium placeholder:text-[var(--text-3)] ${alignClass}`}
            style={{ color: "var(--text)" }}
          />

          {(state.status === "loading" || (isTyping && !showHint)) && (
            <span className="spinner-sm spinner shrink-0" aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={close}
            aria-label={t.topbar.searchClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:opacity-80"
            style={{ background: "var(--input-bg)", color: "var(--text-3)" }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="global-search-results"
          role="listbox"
          aria-label={t.topbar.searchPlaceholder}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        >
          {showHint && <StatusLine text={t.topbar.searchHint} />}
          {showLoading && <StatusLine text={t.topbar.searching} live />}
          {showEmpty && (
            <StatusLine text={`${t.topbar.noResultsFor} "${trimmed}"`} live />
          )}
          {state.status === "error" && !showHint && (
            <StatusLine text={state.message} live tone="danger" />
          )}

          {results &&
            !showHint &&
            GROUP_ORDER.map((group) => {
              const items = results[group] ?? [];
              if (items.length === 0) return null;
              const Icon = GROUP_ICONS[group];

              return (
                <div key={group} role="group" aria-label={t.topbar.searchGroups[group]} className="mb-1 last:mb-0">
                  <p
                    className={`px-3 pb-1 pt-3 text-[11px] font-black uppercase tracking-wide ${alignClass}`}
                    style={{ color: "var(--text-3)" }}
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
                        id={`global-search-${group}-${item.id}`}
                        role="option"
                        aria-selected={active}
                        data-index={index}
                        onMouseMove={() => {
                          if (!active) setActiveIndex(index);
                        }}
                        onMouseEnter={() => router.prefetch(item.href)}
                        onClick={() => navigate(item.href)}
                        className={`flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 ${alignClass} transition-colors`}
                        style={{ background: active ? "var(--surface-2)" : "transparent" }}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background: active ? "var(--gold-soft)" : "var(--input-bg)",
                            color: active ? "var(--gold)" : "var(--text-3)",
                          }}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <bdi className="truncate text-sm font-bold" style={{ color: "var(--text)" }}>
                              {item.title}
                            </bdi>
                            {badge && (
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                style={{ background: "var(--input-bg)", color: "var(--text-2)" }}
                              >
                                {badge}
                              </span>
                            )}
                          </span>
                          {item.meta.length > 0 && (
                            <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--text-3)" }}>
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

        {/* Keyboard hints — pointer devices only */}
        <div
          className="hidden shrink-0 items-center gap-4 border-t px-4 py-2.5 text-[11px] font-semibold sm:flex"
          style={{ borderColor: "var(--border)", color: "var(--text-3)" }}
        >
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            {t.topbar.searchKeysNavigate}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd>
            {t.topbar.searchKeysOpen}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            {t.topbar.searchKeysClose}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatusLine({
  text,
  live = false,
  tone = "muted",
}: {
  text: string;
  live?: boolean;
  tone?: "muted" | "danger";
}) {
  return (
    <p
      className="px-4 py-8 text-center text-sm font-semibold"
      style={{ color: tone === "danger" ? "var(--danger)" : "var(--text-3)" }}
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <bdi>{text}</bdi>
    </p>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      dir="ltr"
      className="inline-flex min-w-[22px] items-center justify-center rounded-md border px-1.5 py-0.5 font-sans text-[10px] font-bold"
      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-2)" }}
    >
      {children}
    </kbd>
  );
}
