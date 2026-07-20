"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import VDSIcon from "./VDSIcon";
import type { VDSTone } from "./tokens";

interface VDSSectionHeaderProps {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  isRtl: boolean;
  icon?: ReactNode;
  tone?: VDSTone;
}

export default function VDSSectionHeader({ title, subtitle, href, linkLabel, isRtl, icon, tone = "teal" }: VDSSectionHeaderProps) {
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  return (
    <header className="mb-4 flex min-w-0 items-start justify-between gap-3 border-b pb-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <VDSIcon tone={tone} size="sm">{icon}</VDSIcon>}
        <div className="min-w-0">
          <h2 className="text-base font-black sm:text-lg" style={{ color: "var(--text)" }}>{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-5 sm:text-sm" style={{ color: "var(--text-3)" }}>{subtitle}</p>}
        </div>
      </div>
      {href && linkLabel && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-black transition hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "var(--sidebar)" }}>
          {linkLabel}<ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </header>
  );
}
