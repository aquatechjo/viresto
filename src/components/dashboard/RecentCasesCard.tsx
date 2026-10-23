"use client";

import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { CaseStatusKey, DashboardCase } from "@/lib/dashboard/types";
import DashboardCard, { CompactEmpty } from "./DashboardCard";
import { CASE_STATUS_COLORS, CASE_STATUS_LABELS, type DashboardText } from "./dashboard-text";
import { formatRelative } from "./format";

interface RecentCasesCardProps {
  cases: DashboardCase[];
  locale: Locale;
  isRtl: boolean;
  nowIso: string;
  t: DashboardText;
}

function StatusBadge({ status, locale }: { status: CaseStatusKey; locale: Locale }) {
  const color = CASE_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-black"
      style={{ color: "var(--text-2)", borderColor: `${color}55`, background: `${color}1a` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {CASE_STATUS_LABELS[locale][status]}
    </span>
  );
}

export default function RecentCasesCard({ cases, locale, isRtl, nowIso, t }: RecentCasesCardProps) {
  return (
    <DashboardCard
      title={t.recentCases}
      icon={<BriefcaseBusiness className="h-4 w-4" />}
      tone="teal"
      isRtl={isRtl}
      href="/dashboard/cases"
      linkLabel={t.viewAll}
    >
      {cases.length === 0 ? (
        <CompactEmpty
          icon={<BriefcaseBusiness className="h-6 w-6" />}
          title={t.casesEmpty}
          href="/dashboard/cases"
          actionLabel={t.addCaseAction}
        />
      ) : (
        <ul className="min-w-0 divide-y" style={{ borderColor: "var(--border)" }}>
          {cases.map((item) => (
            <li key={item.id} className="min-w-0" style={{ borderColor: "var(--border)" }}>
              <Link
                href={`/dashboard/cases/${item.publicId}`}
                className="-mx-2 flex min-h-[56px] min-w-0 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-black/[.03] dark:hover:bg-white/[.04]"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-baseline gap-2">
                    {item.caseNumber && (
                      <bdi
                        dir="ltr"
                        className="shrink-0 font-mono text-[11px] font-bold"
                        style={{ color: "var(--accent-text)" }}
                      >
                        {item.caseNumber}
                      </bdi>
                    )}
                    <bdi className="truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>
                      {item.title}
                    </bdi>
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                    <bdi>{item.client?.name ?? t.noClient}</bdi>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={item.status} locale={locale} />
                  <time dateTime={item.updatedAt} className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>
                    <bdi>{formatRelative(item.updatedAt, nowIso, locale)}</bdi>
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
