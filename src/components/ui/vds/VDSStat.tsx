"use client";

import type { ReactNode } from "react";
import VDSIcon from "./VDSIcon";
import type { VDSTone } from "./tokens";

interface VDSStatProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: VDSTone;
  meta?: ReactNode;
  className?: string;
}

export default function VDSStat({
  label,
  value,
  icon,
  tone = "teal",
  meta,
  className = "",
}: VDSStatProps) {
  return (
    <div
      className={`min-w-0 rounded-[20px] border p-3.5 ${className}`}
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <VDSIcon tone={tone} size="sm">
        {icon}
      </VDSIcon>
      <p className="mt-3 text-xs font-bold" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
        <p className="truncate text-xl font-black" style={{ color: "var(--text)" }}>
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </p>
        {meta ? <div className="shrink-0 text-[10px] font-bold">{meta}</div> : null}
      </div>
    </div>
  );
}
