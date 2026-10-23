"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { VDSIcon, vds, type VDSTone } from "@/components/ui/vds";

export type KpiHintTone = "good" | "bad" | "neutral";

interface KpiCardProps {
  label: string;
  value: string;
  hint: ReactNode;
  hintTone?: KpiHintTone;
  icon: ReactNode;
  tone: VDSTone;
  href: string;
  // The UI direction: amounts mix digits with an Arabic unit, so they
  // follow the page instead of guessing from their first letter.
  dir: "rtl" | "ltr";
}

const HINT_COLORS: Record<KpiHintTone, string> = {
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

export default function KpiCard({ label, value, hint, hintTone = "neutral", icon, tone, href, dir }: KpiCardProps) {
  const [amount, unit] = splitUnit(value);

  return (
    <Link
      href={href}
      className="group flex h-full min-h-[124px] min-w-0 flex-col justify-between gap-2 border p-3.5 transition duration-200 hover:-translate-y-0.5 sm:p-4"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        borderRadius: vds.radius.surface,
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="line-clamp-2 text-[11px] font-black leading-4 sm:text-xs" style={{ color: "var(--text-3)" }}>
          {label}
        </p>
        <VDSIcon tone={tone} size="sm" className="!h-8 !w-8">
          {icon}
        </VDSIcon>
      </div>
      <p
        className={`truncate font-black leading-none tracking-tight ${amount.length > 8 ? "text-xl" : "text-2xl"}`}
        style={{ color: "var(--text)" }}
        title={value}
      >
        <bdi dir={dir}>
          {amount}
          {unit && <span className="ms-1 text-sm font-bold">{unit}</span>}
        </bdi>
      </p>
      <p
        className={`truncate text-[11px] font-bold ${HINT_COLORS[hintTone]}`}
        style={hintTone === "neutral" ? { color: "var(--text-3)" } : undefined}
      >
        <bdi dir={dir}>{hint}</bdi>
      </p>
    </Link>
  );
}
