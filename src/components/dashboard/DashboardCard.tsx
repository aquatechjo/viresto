"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { VDSIcon, vds, type VDSTone } from "@/components/ui/vds";

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  tone?: VDSTone;
  isRtl: boolean;
  href?: string;
  linkLabel?: string;
  // Rendered next to the title (a count, a legend).
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

// One dashboard card: fills its grid cell (h-full) so cards in a row end
// level, and its body grows (flex-1) instead of leaving a gap below.
export default function DashboardCard({
  title,
  subtitle,
  icon,
  tone = "teal",
  isRtl,
  href,
  linkLabel,
  aside,
  className = "",
  children,
}: DashboardCardProps) {
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section
      className={`flex h-full min-w-0 flex-col border p-4 sm:p-5 ${className}`}
      style={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: vds.radius.card }}
    >
      <header className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <VDSIcon tone={tone} size="sm">{icon}</VDSIcon>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black sm:text-base" style={{ color: "var(--text)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {aside}
        </div>
        {href && linkLabel && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-black transition hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: "var(--text-2)" }}
          >
            {linkLabel}
            <ArrowIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

interface CompactEmptyProps {
  icon: ReactNode;
  title: string;
  actionLabel?: string;
  href?: string;
}

/** Icon, one line and one action, centred in whatever space the card has. */
export function CompactEmpty({ icon, title, actionLabel, href }: CompactEmptyProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      <span className="opacity-70" style={{ color: "var(--text-3)" }}>{icon}</span>
      <p className="text-sm font-bold" style={{ color: "var(--text-2)" }}>{title}</p>
      {href && actionLabel && (
        <Link
          href={href}
          className="rounded-lg px-2.5 py-1 text-xs font-black transition hover:brightness-110"
          style={{ background: "var(--gold-soft)", color: "var(--accent-text)" }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
