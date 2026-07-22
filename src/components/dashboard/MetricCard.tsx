"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Minus,
} from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: ReactNode;
  href: string;
  alert?: boolean;
  insight?: string;
  trend?: "up" | "down" | "neutral";
}

type MetricTone = "teal" | "blue" | "violet" | "amber" | "rose";

const TONE_STYLES: Record<
  MetricTone,
  {
    icon: string;
    glow: string;
    accent: string;
    value: string;
  }
> = {
  teal: {
    icon:
      "border-teal-500/20 bg-gradient-to-br from-teal-400/25 to-emerald-500/10 text-teal-700 shadow-[0_10px_28px_rgba(13,148,136,0.16)] dark:text-teal-200",
    glow: "bg-teal-400/15",
    accent: "from-teal-500 via-emerald-400 to-transparent",
    value: "text-teal-950 dark:text-teal-50",
  },
  blue: {
    icon:
      "border-blue-500/20 bg-gradient-to-br from-blue-400/25 to-cyan-500/10 text-blue-700 shadow-[0_10px_28px_rgba(37,99,235,0.15)] dark:text-blue-200",
    glow: "bg-blue-400/15",
    accent: "from-blue-500 via-cyan-400 to-transparent",
    value: "text-blue-950 dark:text-blue-50",
  },
  violet: {
    icon:
      "border-violet-500/20 bg-gradient-to-br from-violet-400/25 to-fuchsia-500/10 text-violet-700 shadow-[0_10px_28px_rgba(124,58,237,0.15)] dark:text-violet-200",
    glow: "bg-violet-400/15",
    accent: "from-violet-500 via-fuchsia-400 to-transparent",
    value: "text-violet-950 dark:text-violet-50",
  },
  amber: {
    icon:
      "border-amber-500/20 bg-gradient-to-br from-amber-300/30 to-orange-500/10 text-amber-700 shadow-[0_10px_28px_rgba(217,119,6,0.14)] dark:text-amber-200",
    glow: "bg-amber-400/15",
    accent: "from-amber-500 via-orange-400 to-transparent",
    value: "text-amber-950 dark:text-amber-50",
  },
  rose: {
    icon:
      "border-rose-500/20 bg-gradient-to-br from-rose-400/25 to-red-500/10 text-rose-700 shadow-[0_10px_28px_rgba(225,29,72,0.14)] dark:text-rose-200",
    glow: "bg-rose-400/15",
    accent: "from-rose-500 via-red-400 to-transparent",
    value: "text-rose-950 dark:text-rose-50",
  },
};

const TREND_STYLES = {
  up: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  down:
    "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  neutral:
    "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-200",
} as const;

function resolveTone(href: string, alert: boolean): MetricTone {
  if (alert) return "rose";
  if (href.includes("appointments")) return "blue";
  if (href.includes("tasks")) return "violet";
  if (href.includes("invoices") || href.includes("finance")) return "amber";
  return "teal";
}

export default function MetricCard({
  label,
  value,
  sub,
  icon,
  href,
  alert = false,
  insight,
  trend = "neutral",
}: MetricCardProps) {
  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const tone = resolveTone(href, alert);
  const styles = TONE_STYLES[tone];

  return (
    <div className="min-w-0">
      <Link
        href={href}
        className="group relative block min-h-[190px] min-w-0 overflow-hidden rounded-[24px] border p-4 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_55px_rgba(15,61,62,0.14)] sm:p-5"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -end-10 -top-12 h-32 w-32 rounded-full blur-3xl transition duration-500 group-hover:scale-125 ${styles.glow}`}
        />

        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${styles.accent}`}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition duration-300 group-hover:-rotate-3 group-hover:scale-110 ${styles.icon}`}
          >
            {icon}
          </div>

          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border opacity-70 transition duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 rtl:group-hover:-translate-x-0.5"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-3)",
            }}
          >
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </span>
        </div>

        <div className="relative mt-4">
          <p
            className="text-[11px] font-black tracking-wide sm:text-xs"
            style={{ color: "var(--text-3)" }}
          >
            {label}
          </p>

          <p
            className={`mt-1.5 truncate text-[2rem] font-black leading-none tracking-[-0.04em] sm:text-[2.2rem] ${styles.value}`}
          >
            {typeof value === "number"
              ? new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 0,
                }).format(value)
              : value}
          </p>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            {insight && (
              <span
                className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${TREND_STYLES[trend]}`}
              >
                <TrendIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{insight}</span>
              </span>
            )}
          </div>

          <p
            className="mt-3 line-clamp-2 text-xs font-semibold leading-5"
            style={{ color: "var(--text-3)" }}
          >
            {sub}
          </p>
        </div>
      </Link>
    </div>
  );
}
