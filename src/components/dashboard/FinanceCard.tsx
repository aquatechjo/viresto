"use client";

import { BarChart3, ReceiptText } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { Locale } from "@/lib/i18n";
import type { AgingBuckets, MonthTotals } from "@/lib/dashboard/types";
import { formatJOD } from "@/lib/money";
import DashboardCard, { CompactEmpty } from "./DashboardCard";
import type { DashboardText } from "./dashboard-text";
import { formatCompact, formatMonth } from "./format";

const INVOICED_COLOR = "#14b8a6";
const COLLECTED_COLOR = "#b87333";
const AGING_KEYS: Array<keyof AgingBuckets> = ["d0_30", "d31_60", "d61_90", "d90_plus"];
const AGING_COLORS: Record<keyof AgingBuckets, string> = {
  d0_30: "#14b8a6",
  d31_60: "#f59e0b",
  d61_90: "#f97316",
  d90_plus: "#ef4444",
};

interface FinanceCardProps {
  months: MonthTotals[];
  aging: AgingBuckets;
  locale: Locale;
  isRtl: boolean;
  t: DashboardText;
}

function ChartTooltip({ active, payload, label, dir }: TooltipContentProps<ValueType, NameType> & { dir: "rtl" | "ltr" }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      dir={dir}
      className="rounded-xl border px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      <p className="mb-1 font-black">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}: <bdi dir={dir}>{formatJOD(Number(entry.value))}</bdi>
        </p>
      ))}
    </div>
  );
}

export default function FinanceCard({ months, aging, locale, isRtl, t }: FinanceCardProps) {
  const dir = isRtl ? "rtl" : "ltr";
  const data = months.map((month) => ({ ...month, label: formatMonth(month.month, locale) }));
  const agingTotal = AGING_KEYS.reduce((sum, key) => sum + aging[key], 0);
  const isEmpty = agingTotal === 0 && months.every((month) => month.invoiced === 0 && month.collected === 0);

  const legend = (
    <span className="ms-1 hidden items-center gap-3 text-[11px] font-bold sm:inline-flex" style={{ color: "var(--text-3)" }}>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: INVOICED_COLOR }} />{t.invoiced}</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLLECTED_COLOR }} />{t.collected}</span>
    </span>
  );

  return (
    <DashboardCard
      title={t.finance}
      subtitle={t.financeSub}
      icon={<BarChart3 className="h-4 w-4" />}
      tone="teal"
      isRtl={isRtl}
      href="/dashboard/finance/reports"
      linkLabel={t.viewAll}
      aside={isEmpty ? undefined : legend}
    >
      {isEmpty ? (
        <CompactEmpty
          icon={<ReceiptText className="h-6 w-6" />}
          title={t.financeEmpty}
          href="/dashboard/finance/invoices"
          actionLabel={t.createInvoiceAction}
        />
      ) : (
        <>
          <div className="h-[220px] min-h-[220px] w-full min-w-0 flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={3}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  reversed={isRtl}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: "var(--text-3)" }}
                />
                <YAxis
                  orientation={isRtl ? "right" : "left"}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={44}
                  tick={{ fill: "var(--text-3)" }}
                  tickFormatter={(value: number) => formatCompact(value)}
                />
                <Tooltip content={(props) => <ChartTooltip {...props} dir={dir} />} cursor={{ fill: "var(--border)", opacity: 0.35 }} />
                <Bar dataKey="invoiced" name={t.invoiced} fill={INVOICED_COLOR} radius={[6, 6, 0, 0]} maxBarSize={22} />
                <Bar dataKey="collected" name={t.collected} fill={COLLECTED_COLOR} radius={[6, 6, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <p className="mb-2 text-xs font-black" style={{ color: "var(--text-2)" }}>
              {t.aging} <span className="font-semibold" style={{ color: "var(--text-3)" }}>· {t.agingSub}</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AGING_KEYS.map((key) => (
                <div key={key} className="min-w-0 rounded-xl border px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
                  <p className="truncate text-[11px] font-bold" style={{ color: "var(--text-3)" }}>
                    <bdi>{t.agingBuckets[key]}</bdi>
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold" style={{ color: "var(--text)" }} title={formatJOD(aging[key])}>
                    <bdi dir={dir}>{formatJOD(aging[key])}</bdi>
                  </p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${agingTotal ? Math.round((aging[key] / agingTotal) * 100) : 0}%`,
                        background: AGING_COLORS[key],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardCard>
  );
}
