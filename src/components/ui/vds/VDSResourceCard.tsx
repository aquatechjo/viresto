"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import VDSIcon from "./VDSIcon";
import type { VDSTone } from "./tokens";

interface VDSResourceCardProps {
  href: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  tone?: VDSTone;
  isRtl: boolean;
  badge?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export default function VDSResourceCard({
  href,
  title,
  subtitle,
  icon,
  tone = "teal",
  isRtl,
  badge,
  meta,
  className = "",
}: VDSResourceCardProps) {
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <Link
      href={href}
      className={`group flex min-w-0 items-center gap-3 rounded-[20px] border p-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${className}`}
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <VDSIcon tone={tone}>{icon}</VDSIcon>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-black" style={{ color: "var(--text)" }}>
            {title}
          </p>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        {subtitle ? (
          <p className="mt-1 truncate text-xs" style={{ color: "var(--text-3)" }}>
            {subtitle}
          </p>
        ) : null}
        {meta ? <div className="mt-2 min-w-0">{meta}</div> : null}
      </div>
      <Arrow className="h-4 w-4 shrink-0 opacity-35 transition group-hover:opacity-80" style={{ color: "var(--text-3)" }} />
    </Link>
  );
}
