"use client";

import type { ReactNode } from "react";
import { vds, type VDSTone } from "./tokens";

interface VDSProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: VDSTone;
  label?: ReactNode;
  className?: string;
}

export default function VDSProgressRing({
  value,
  size = 72,
  strokeWidth = 7,
  tone = "emerald",
  label,
  className = "",
}: VDSProgressRingProps) {
  const safeValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;
  const palette = vds.tone[tone];

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.fg}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: `stroke-dashoffset ${vds.motion.slow}ms ease` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center text-xs font-black" style={{ color: "var(--text)" }}>
        {label ?? `${Math.round(safeValue)}%`}
      </div>
    </div>
  );
}
