"use client";

import { Search } from "lucide-react";
import { translations } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import { openGlobalSearch } from "./GlobalSearchPalette";

interface DashboardSearchProps {
  /** "topbar" shows the Ctrl+K hint; the drawer is touch-first. */
  variant: "topbar" | "drawer";
  /** Extra classes for the wrapper (e.g. TopBar grid placement). */
  className?: string;
  /** Called after the palette opens, e.g. to close the mobile drawer. */
  onNavigate?: () => void;
}

/**
 * The search box in the TopBar (xl+) and the Sidebar drawer (below xl).
 * It opens the office-wide search palette (GlobalSearchPalette), which also
 * opens on Ctrl+K. Both hosts are always-dark surfaces, so the box uses the
 * theme-invariant --landing-* palette in both themes.
 */
export default function DashboardSearch({
  variant,
  className = "",
  onNavigate,
}: DashboardSearchProps) {
  const { locale, isRtl } = useLocale();
  const t = translations[locale];

  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => {
          openGlobalSearch();
          onNavigate?.();
        }}
        className={`
          flex h-10 w-full min-w-0 items-center gap-2.5 rounded-2xl border border-[var(--landing-border-strong)]
          bg-[#103334]/90 px-3 text-sm font-semibold text-emerald-200/70
          shadow-none outline-none transition-all hover:border-copper-400/60
          focus-visible:border-copper-400 focus-visible:ring-4 focus-visible:ring-copper-400/10
          sm:h-11 ${isRtl ? "text-right" : "text-left"}
        `}
      >
        <Search className="h-4 w-4 shrink-0 text-emerald-200" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t.topbar.searchPlaceholder}</span>
        {variant === "topbar" && (
          <kbd
            dir="ltr"
            aria-hidden="true"
            className="shrink-0 rounded-md border border-[var(--landing-border-strong)] bg-[var(--landing-surface)] px-1.5 py-0.5 font-sans text-[10px] font-bold text-emerald-100/80"
          >
            Ctrl K
          </kbd>
        )}
      </button>
    </div>
  );
}
