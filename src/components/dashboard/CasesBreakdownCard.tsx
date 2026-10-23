"use client";

import { BriefcaseBusiness, PieChart } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { CaseStatusKey, CourtLevel } from "@/lib/dashboard/types";
import { formatCount } from "@/lib/plural";
import DashboardCard, { CompactEmpty } from "./DashboardCard";
import {
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  COURT_LEVEL_LABELS,
  type DashboardText,
} from "./dashboard-text";

interface CasesBreakdownCardProps {
  byStatus: Array<{ status: CaseStatusKey; count: number }>;
  byCourt: Array<{ level: CourtLevel; count: number }>;
  locale: Locale;
  isRtl: boolean;
  // Side by side when the card spans the full row (no finance card).
  wide?: boolean;
  t: DashboardText;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Donut({ segments, total, label }: { segments: Array<{ color: string; count: number }>; total: number; label: string }) {
  const arcs = segments.map((segment, index) => ({
    color: segment.color,
    length: (segment.count / total) * CIRCUMFERENCE,
    start: (segments.slice(0, index).reduce((sum, item) => sum + item.count, 0) / total) * CIRCUMFERENCE,
  }));

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label={label}>
      <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="12" />
      <g transform="rotate(-90 50 50)">
        {arcs.map((arc, index) => (
          <circle
            key={index}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth="12"
            strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
            strokeDashoffset={-arc.start}
          />
        ))}
      </g>
      <text
        x="50"
        y="50"
        style={{ fill: "var(--text)", fontSize: 20, fontWeight: 900 }}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {formatCount(total)}
      </text>
    </svg>
  );
}

export default function CasesBreakdownCard({ byStatus, byCourt, locale, isRtl, wide = false, t }: CasesBreakdownCardProps) {
  const total = byStatus.reduce((sum, item) => sum + item.count, 0);
  const courtMax = Math.max(1, ...byCourt.map((item) => item.count));

  return (
    <DashboardCard
      title={t.casesBreakdown}
      icon={<PieChart className="h-4 w-4" />}
      tone="blue"
      isRtl={isRtl}
      href="/dashboard/cases"
      linkLabel={t.viewAll}
    >
      {total === 0 ? (
        <CompactEmpty
          icon={<BriefcaseBusiness className="h-6 w-6" />}
          title={t.casesEmpty}
          href="/dashboard/cases"
          actionLabel={t.addCaseAction}
        />
      ) : (
        <div className={`flex min-w-0 flex-1 flex-col gap-4 ${wide ? "md:flex-row md:gap-8" : ""}`}>
          <div className={`min-w-0 ${wide ? "md:flex-1" : ""}`}>
            <p className="mb-2 text-xs font-black" style={{ color: "var(--text-2)" }}>{t.byStatus}</p>
            <div className="flex min-w-0 items-center gap-4">
              <Donut
                total={total}
                label={`${t.total}: ${formatCount(total)}`}
                segments={byStatus.map((item) => ({ color: CASE_STATUS_COLORS[item.status], count: item.count }))}
              />
              <ul className="min-w-0 flex-1 space-y-1.5">
                {byStatus.map((item) => (
                  <li key={item.status} className="flex min-w-0 items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CASE_STATUS_COLORS[item.status] }} />
                    <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: "var(--text-2)" }}>
                      {CASE_STATUS_LABELS[locale][item.status]}
                    </span>
                    <span className="font-black tabular-nums" style={{ color: "var(--text)" }}>{formatCount(item.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {byCourt.length > 0 && (
            <div className={`min-w-0 border-t pt-3 ${wide ? "md:flex-1 md:border-t-0 md:pt-0" : ""}`} style={{ borderColor: "var(--border)" }}>
              <p className="mb-2 text-xs font-black" style={{ color: "var(--text-2)" }}>{t.byCourt}</p>
              <ul className="space-y-2">
                {byCourt.map((item) => (
                  <li key={item.level} className="min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-semibold" style={{ color: "var(--text-2)" }}>
                        {COURT_LEVEL_LABELS[locale][item.level]}
                      </span>
                      <span className="font-black tabular-nums" style={{ color: "var(--text)" }}>{formatCount(item.count)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round((item.count / courtMax) * 100)}%`, background: "var(--gold)" }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
