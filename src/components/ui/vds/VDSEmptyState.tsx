"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ScaleIn } from "@/components/motion";
import VDSIcon from "./VDSIcon";
import type { VDSTone } from "./tokens";

interface VDSEmptyStateProps { icon: ReactNode; title: string; description?: string; actionLabel?: string; href?: string; tone?: VDSTone; }

export default function VDSEmptyState({ icon, title, description, actionLabel, href, tone = "teal" }: VDSEmptyStateProps) {
  return (
    <ScaleIn>
      <div className="flex min-h-[132px] flex-col items-center justify-center rounded-[20px] border border-dashed p-5 text-center" style={{ borderColor: "var(--border)", background: "linear-gradient(180deg, transparent, rgba(15,61,62,.025))" }}>
        <VDSIcon tone={tone} size="md">{icon}</VDSIcon>
        <p className="mt-3 text-sm font-black" style={{ color: "var(--text-2)" }}>{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs leading-5" style={{ color: "var(--text-3)" }}>{description}</p>}
        {href && actionLabel && <Link href={href} className="mt-3 rounded-xl px-3 py-2 text-xs font-black transition hover:-translate-y-0.5" style={{ background: "var(--green-soft)", color: "var(--sidebar)" }}>{actionLabel}</Link>}
      </div>
    </ScaleIn>
  );
}
