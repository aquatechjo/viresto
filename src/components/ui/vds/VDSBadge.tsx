"use client";

import type { ReactNode } from "react";
import { vds, type VDSTone } from "./tokens";

interface VDSBadgeProps { children: ReactNode; tone?: VDSTone; className?: string; }

export default function VDSBadge({ children, tone = "slate", className = "" }: VDSBadgeProps) {
  const color = vds.tone[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${className}`} style={{ color: color.fg, background: color.soft, borderColor: color.border }}>
      {children}
    </span>
  );
}
