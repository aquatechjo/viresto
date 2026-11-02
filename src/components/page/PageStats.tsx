"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { VDSIcon, vds, type VDSTone } from "@/components/ui/vds";

export type StatHintTone = "good" | "bad" | "neutral";

export interface StatItem {
  label: string;
  /** Already formatted (formatJOD, formatCount...), Latin digits. */
  value: string | number;
  hint?: ReactNode;
  hintTone?: StatHintTone;
  icon?: ReactNode;
  tone?: VDSTone;
  /** Makes the card a link, as on the dashboard. */
  href?: string;
  /**
   * In a filtering PageStats (`filter` prop): the filter value this card
   * selects. Cards without one are figures only and look it.
   */
  filterValue?: string;
}

/**
 * Makes cards with a filterValue toggle buttons for one filter state: a
 * card is on while `value` equals its filterValue, and pressing the card
 * that is on goes back to `allValue`.
 */
export interface StatsFilter {
  value: string;
  onChange: (value: string) => void;
  allValue: string;
}

type CardMode = "plain" | "filter" | "display";

const HINT_COLORS: Record<StatHintTone, string> = {
  good: "text-emerald-700 dark:text-emerald-300",
  bad: "text-rose-700 dark:text-rose-300",
  neutral: "",
};

// "15,200 د.أ" -> ["15,200", "د.أ"]. Cairo's heaviest weight draws the
// hamza of أ like a madda (آ), so the unit is set at a lighter weight.
function splitUnit(value: string): [string, string | null] {
  const match = value.match(/^(.*\d)\s+(\D+)$/);
  return match ? [match[1], match[2]] : [value, null];
}

// One figure: label and icon, the value, an optional hint line.
export function StatCard({
  label,
  value,
  hint,
  hintTone = "neutral",
  icon,
  tone = "teal",
  href,
  dir,
  mode = "plain",
  active = false,
  onSelect,
}: Omit<StatItem, "filterValue"> & {
  // The UI direction: amounts mix digits with an Arabic unit, so they
  // follow the page instead of guessing from their first letter.
  dir: "rtl" | "ltr";
  /** plain: a figure. filter: a toggle button. display: a figure next to filter cards. */
  mode?: CardMode;
  active?: boolean;
  onSelect?: () => void;
}) {
  const text = String(value);
  const [amount, unit] = splitUnit(text);
  const interactive = Boolean(href) || mode === "filter";
  const className = `flex h-full w-full min-w-0 flex-col justify-between gap-2 border p-3.5 text-start sm:p-4 ${
    hint !== undefined ? "min-h-[124px]" : "min-h-[104px]"
  } ${
    interactive
      ? "group cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/50"
      : ""
  }`;
  // A figure beside filter cards is flat and dashed, so it doesn't read as
  // one more button.
  const style =
    mode === "filter" && active
      ? {
          background: "rgba(184,115,51,0.08)",
          borderColor: "var(--gold)",
          boxShadow: "0 0 0 1px var(--gold)",
          borderRadius: vds.radius.surface,
        }
      : mode === "display"
        ? {
            background: "var(--card-2)",
            borderColor: "var(--border)",
            borderStyle: "dashed" as const,
            borderRadius: vds.radius.surface,
          }
        : {
            background: "var(--card)",
            borderColor: "var(--border)",
            borderRadius: vds.radius.surface,
          };

  const body = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="line-clamp-2 text-[11px] font-black leading-4 sm:text-xs" style={{ color: "var(--text-3)" }}>
          {label}
        </p>
        {icon && (
          <VDSIcon tone={tone} size="sm" className="!h-8 !w-8">
            {icon}
          </VDSIcon>
        )}
      </div>
      <p
        className={`truncate font-black leading-none tracking-tight ${amount.length > 8 ? "text-xl" : "text-2xl"}`}
        style={{ color: "var(--text)" }}
        title={text}
      >
        <bdi dir={dir}>
          {amount}
          {unit && <span className="ms-1 text-sm font-bold">{unit}</span>}
        </bdi>
      </p>
      {hint !== undefined && (
        <p
          className={`truncate text-[11px] font-bold ${HINT_COLORS[hintTone]}`}
          style={hintTone === "neutral" ? { color: "var(--text-3)" } : undefined}
        >
          <bdi dir={dir}>{hint}</bdi>
        </p>
      )}
    </>
  );

  if (mode === "filter") {
    return (
      <button type="button" aria-pressed={active} onClick={onSelect} className={className} style={style}>
        {body}
      </button>
    );
  }

  return href ? (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
}

// Full class strings so Tailwind keeps them: two per row on phones, all
// in one row on wide screens.
const GRID_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  // Two per row on phones, the third across both columns.
  3: "grid-cols-2 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1",
  4: "grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

export default function PageStats({
  items,
  dir,
  filter,
  displayOnly = false,
  className = "",
}: {
  items: StatItem[];
  dir: "rtl" | "ltr";
  /** Turns the cards that have a filterValue into the page's filter. */
  filter?: StatsFilter;
  /** Figures shown on a page whose other cards filter (e.g. amounts). */
  displayOnly?: boolean;
  className?: string;
}) {
  const columns = GRID_COLUMNS[items.length] ?? GRID_COLUMNS[6];

  return (
    <div className={`grid min-w-0 gap-3 ${columns} ${className}`}>
      {items.map(({ filterValue, ...item }) => {
        if (filter && filterValue !== undefined) {
          const active = filter.value === filterValue;
          return (
            <StatCard
              key={item.label}
              {...item}
              dir={dir}
              mode="filter"
              active={active}
              onSelect={() => filter.onChange(active ? filter.allValue : filterValue)}
            />
          );
        }

        return (
          <StatCard
            key={item.label}
            {...item}
            dir={dir}
            mode={filter || displayOnly ? "display" : "plain"}
          />
        );
      })}
    </div>
  );
}
