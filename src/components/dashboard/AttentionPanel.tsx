"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import SectionHeader from "./SectionHeader";

export interface AttentionItem {
  key: string;
  title: string;
  message: string;
  href: string;
  icon: ReactNode;
  tone: "danger" | "warning" | "info";
  priority: "critical" | "today" | "upcoming";
  badgeLabel: string;
  actionLabel: string;
}

interface AttentionPanelProps {
  items: AttentionItem[];
  isRtl: boolean;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptySubtitle: string;
}

const TONE_STYLES = {
  danger: {
    background: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.24)",
    icon: "text-red-600 dark:text-red-300 bg-red-500/15",
    badge: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-200",
  },
  warning: {
    background: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.24)",
    icon: "text-amber-700 dark:text-amber-300 bg-amber-500/15",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  },
  info: {
    background: "var(--green-soft)",
    border: "var(--border)",
    icon: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  },
} as const;

export default function AttentionPanel({
  items,
  isRtl,
  title,
  subtitle,
  emptyTitle,
  emptySubtitle,
}: AttentionPanelProps) {
  if (items.length === 0) {
    return (
      <div className="animate-slide">
        <section className="card flex min-w-0 items-center gap-3 p-3.5 sm:px-4" aria-label={title}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-sm font-black sm:text-base" style={{ color: "var(--text)" }}>
                {emptyTitle}
              </h2>
              <span className="hidden text-xs sm:inline" style={{ color: "var(--text-3)" }}>
                · {emptySubtitle}
              </span>
            </div>
            <p className="mt-1 text-xs sm:hidden" style={{ color: "var(--text-3)" }}>
              {emptySubtitle}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="animate-slide">
      <section className="card h-fit min-w-0 p-4 sm:p-5">
        <SectionHeader title={title} subtitle={subtitle} isRtl={isRtl} />
        <div className="stagger grid min-w-0 gap-3 md:grid-cols-2">
          {items.map((item) => {
            const toneStyles = TONE_STYLES[item.tone];

            return (
              <div key={item.key} className="min-w-0">
                <Link
                  href={item.href}
                  className="group flex min-h-full min-w-0 items-start gap-3 rounded-2xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-sm"
                  style={{ background: toneStyles.background, borderColor: toneStyles.border }}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneStyles.icon}`}>
                    {item.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-black" style={{ color: "var(--text)" }}>
                        {item.title}
                      </p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${toneStyles.badge}`}>
                        {item.badgeLabel}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: "var(--text-3)" }}>
                      {item.message}
                    </p>

                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-teal-700 dark:text-teal-200">
                      {item.actionLabel}
                      {isRtl ? (
                        <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      )}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
