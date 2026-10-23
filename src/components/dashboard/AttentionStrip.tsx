"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { vds } from "@/components/ui/vds";

export type AttentionTone = "danger" | "warning" | "info";

export type AttentionItem = {
  key: string;
  title: string;
  detail: string;
  href: string;
  icon: ReactNode;
  tone: AttentionTone;
};

const TONES: Record<AttentionTone, { fg: string; soft: string; border: string }> = {
  danger: { fg: "text-rose-700 dark:text-rose-300", soft: "rgba(239,68,68,.08)", border: "rgba(239,68,68,.28)" },
  warning: { fg: "text-amber-700 dark:text-amber-300", soft: "rgba(245,158,11,.08)", border: "rgba(245,158,11,.30)" },
  info: { fg: "text-sky-700 dark:text-sky-300", soft: "rgba(14,165,233,.08)", border: "rgba(14,165,233,.28)" },
};

interface AttentionStripProps {
  title: string;
  items: AttentionItem[];
  isRtl: boolean;
}

/** Only what needs action now; renders nothing when all is well. */
export default function AttentionStrip({ title, items, isRtl }: AttentionStripProps) {
  if (items.length === 0) return null;
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const dir = isRtl ? "rtl" : "ltr";

  return (
    <section
      className="min-w-0 border p-3 sm:p-4"
      style={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: vds.radius.card }}
      aria-label={title}
    >
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-black" style={{ color: "var(--text)" }}>
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
        {title}
      </h2>
      {/* Wrapping flex, not a grid: a short last row stretches, no hole. */}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const tone = TONES[item.tone];
          return (
            <Link
              key={item.key}
              href={item.href}
              title={`${item.title} · ${item.detail}`}
              className="group flex min-h-[60px] min-w-0 flex-[1_1_210px] items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition hover:brightness-105"
              style={{ background: tone.soft, borderColor: tone.border }}
            >
              <span className={`shrink-0 ${tone.fg}`}>{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-xs font-black sm:text-[13px] ${tone.fg}`}>
                  <bdi dir={dir}>{item.title}</bdi>
                </span>
                <span className="block truncate text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>
                  <bdi dir={dir}>{item.detail}</bdi>
                </span>
              </span>
              <ArrowIcon className="h-3.5 w-3.5 shrink-0 opacity-50 transition group-hover:opacity-100" style={{ color: "var(--text-3)" }} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
