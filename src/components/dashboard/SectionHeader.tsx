"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  href?: string;
  linkLabel?: string;
  isRtl: boolean;
}

export default function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
  isRtl,
}: SectionHeaderProps) {
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-black sm:text-lg" style={{ color: "var(--text)" }}>
          {title}
        </h2>
        <p className="mt-1 text-xs leading-5 sm:text-sm" style={{ color: "var(--text-3)" }}>
          {subtitle}
        </p>
      </div>

      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-black transition hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: "var(--sidebar)" }}
        >
          {linkLabel}
          <ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
