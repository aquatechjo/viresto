"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import VDSCard from "./VDSCard";
import VDSIcon from "./VDSIcon";
import { vds, type VDSTone } from "./tokens";

type TrendDirection = "up" | "down" | "neutral";

interface VDSKPIProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: VDSTone;
  helper?: ReactNode;
  trend?: {
    value: string;
    direction: TrendDirection;
    label?: string;
  };
  className?: string;
}

export default function VDSKPI({
  label,
  value,
  icon,
  tone = "teal",
  helper,
  trend,
  className = "",
}: VDSKPIProps) {
  const palette = vds.tone[tone];
  const TrendIcon =
    trend?.direction === "up" ? ArrowUpRight : trend?.direction === "down" ? ArrowDownRight : Minus;

  return (
    <VDSCard interactive className={`relative overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: palette.fg }}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: "var(--text-3)" }}>
            {label}
          </p>
          <div className="mt-3 text-3xl font-black tracking-tight" style={{ color: "var(--text)" }}>
            {value}
          </div>
        </div>
        <VDSIcon tone={tone} size="lg">
          {icon}
        </VDSIcon>
      </div>

      {(trend || helper) && (
        <div className="mt-4 flex min-w-0 items-center justify-between gap-3">
          {trend ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black"
                style={{
                  color:
                    trend.direction === "down"
                      ? vds.tone.red.fg
                      : trend.direction === "neutral"
                        ? vds.tone.slate.fg
                        : vds.tone.emerald.fg,
                  background:
                    trend.direction === "down"
                      ? vds.tone.red.soft
                      : trend.direction === "neutral"
                        ? vds.tone.slate.soft
                        : vds.tone.emerald.soft,
                }}
              >
                <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {trend.value}
              </span>
              {trend.label && (
                <span className="truncate text-xs" style={{ color: "var(--text-3)" }}>
                  {trend.label}
                </span>
              )}
            </div>
          ) : (
            <span />
          )}

          {helper && (
            <div className="shrink-0 text-xs font-semibold" style={{ color: "var(--text-3)" }}>
              {helper}
            </div>
          )}
        </div>
      )}
    </VDSCard>
  );
}
