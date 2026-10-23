"use client";

import Link from "next/link";
import { CreditCard, Users } from "lucide-react";
import { VDSBadge, type VDSTone } from "@/components/ui/vds";
import type { Locale } from "@/lib/i18n";
import type { DashboardAccount, UsageMeter } from "@/lib/dashboard/types";
import { formatCount, pluralize } from "@/lib/plural";
import DashboardCard from "./DashboardCard";
import { PLURALS, SUBSCRIPTION_STATUS_LABELS, type DashboardText } from "./dashboard-text";
import { formatShortDate } from "./format";

const STATUS_TONE: Record<string, VDSTone> = {
  ACTIVE: "emerald",
  TRIALING: "blue",
  PAST_DUE: "gold",
  CANCELLED: "red",
  EXPIRED: "red",
  UNPAID: "red",
};

interface AccountCardProps {
  account: DashboardAccount;
  canManageBilling: boolean;
  locale: Locale;
  isRtl: boolean;
  timeZone: string;
  t: DashboardText;
}

function Meter({ label, meter, format, t }: { label: string; meter: UsageMeter; format: (value: number) => string; t: DashboardText }) {
  const percent = meter.limit ? Math.min(100, Math.round((meter.used / meter.limit) * 100)) : 0;
  const color = percent >= 90 ? "#ef4444" : percent >= 75 ? "#f59e0b" : "#14b8a6";

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold" style={{ color: "var(--text-2)" }}>{label}</span>
        <span className="font-black tabular-nums" style={{ color: "var(--text)" }}>
          <bdi>
            {format(meter.used)}
            {" / "}
            {meter.limit === null ? t.unlimited : format(meter.limit)}
          </bdi>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: meter.limit === null ? "0%" : `${Math.max(percent, meter.used > 0 ? 2 : 0)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function AccountCard({ account, canManageBilling, locale, isRtl, timeZone, t }: AccountCardProps) {
  const formatStorage = (mb: number) =>
    mb >= 1024 ? `${formatCount(Math.round((mb / 1024) * 10) / 10)} ${t.gb}` : `${formatCount(mb)} ${t.mb}`;

  const periodLine =
    account.trialDaysLeft !== null
      ? t.trialLeft(pluralize(locale, account.trialDaysLeft, PLURALS.days))
      : account.periodEndsAt
        ? (account.status === "CANCELLED" ? t.endsOn : t.renewsOn)(formatShortDate(account.periodEndsAt, locale, timeZone))
        : null;

  return (
    <DashboardCard
      title={t.account}
      icon={<CreditCard className="h-4 w-4" />}
      tone="gold"
      isRtl={isRtl}
      href={canManageBilling ? "/dashboard/billing" : undefined}
      linkLabel={canManageBilling ? t.manageSubscription : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold" style={{ color: "var(--text-3)" }}>{t.plan}</p>
            <p className="truncate text-base font-black" style={{ color: "var(--text)" }}>
              <bdi>{account.planName}</bdi>
            </p>
          </div>
          <VDSBadge tone={STATUS_TONE[account.status] ?? "slate"} className="shrink-0">
            {SUBSCRIPTION_STATUS_LABELS[locale][account.status] ?? account.status}
          </VDSBadge>
        </div>
        {periodLine && (
          <p className="-mt-1 text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>
            <bdi>{periodLine}</bdi>
          </p>
        )}

        <div className="space-y-2.5">
          <Meter label={t.users} meter={account.users} format={formatCount} t={t} />
          <Meter label={t.storage} meter={account.storageMb} format={formatStorage} t={t} />
          <Meter label={t.clients} meter={account.clients} format={formatCount} t={t} />
          <Meter label={t.casesUsage} meter={account.cases} format={formatCount} t={t} />
        </div>

        <Link
          href="/dashboard/team"
          className="mt-auto flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition hover:bg-black/[.03] dark:hover:bg-white/[.04]"
          style={{ borderColor: "var(--border)" }}
        >
          <Users className="h-4 w-4 shrink-0" style={{ color: "var(--text-3)" }} />
          <span className="font-bold" style={{ color: "var(--text-2)" }}>{t.team}</span>
          <span className="min-w-0 flex-1 truncate text-end font-black" style={{ color: "var(--text)" }}>
            <bdi>
              {pluralize(locale, account.teamMembers, PLURALS.members)}
              {account.pendingInvitations > 0 && ` · ${pluralize(locale, account.pendingInvitations, PLURALS.pendingInvitations)}`}
            </bdi>
          </span>
        </Link>
      </div>
    </DashboardCard>
  );
}
