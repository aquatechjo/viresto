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
}

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
}: StatItem & {
  // The UI direction: amounts mix digits with an Arabic unit, so they
  // follow the page instead of guessing from their first letter.
  dir: "rtl" | "ltr";
}) {
  const text = String(value);
  const [amount, unit] = splitUnit(text);
  const className = `flex h-full min-w-0 flex-col justify-between gap-2 border p-3.5 text-start sm:p-4 ${
    hint !== undefined ? "min-h-[124px]" : "min-h-[104px]"
  } ${href ? "group transition duration-200 hover:-translate-y-0.5" : ""}`;
  const style = {
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
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

export default function PageStats({
  items,
  dir,
  className = "",
}: {
  items: StatItem[];
  dir: "rtl" | "ltr";
  className?: string;
}) {
  const columns = GRID_COLUMNS[items.length] ?? GRID_COLUMNS[6];

  return (
    <div className={`grid min-w-0 gap-3 ${columns} ${className}`}>
      {items.map((item) => (
        <StatCard key={item.label} {...item} dir={dir} />
      ))}
    </div>
  );
}
