"use client";

import type { ReactNode } from "react";
import { DateTime } from "luxon";
import {
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Gavel,
  ListTodo,
  ReceiptText,
  UserPlus,
  WalletCards,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { formatJOD } from "@/lib/money";
import { formatCount, pluralize } from "@/lib/plural";
import type { DashboardData } from "@/lib/dashboard/types";
import DemoModeCard from "@/components/demo/DemoModeCard";
import DashboardHeader from "./DashboardHeader";
import KpiCard, { type KpiHintTone } from "./KpiCard";
import AttentionStrip, { type AttentionItem } from "./AttentionStrip";
import AgendaCard from "./AgendaCard";
import TasksCard from "./TasksCard";
import FinanceCard from "./FinanceCard";
import CasesBreakdownCard from "./CasesBreakdownCard";
import RecentCasesCard from "./RecentCasesCard";
import RecentDocumentsCard from "./RecentDocumentsCard";
import ActivityFeed from "./ActivityFeed";
import AccountCard from "./AccountCard";
import { PLURALS, TEXT, type DashboardText } from "./dashboard-text";
import { formatLongDate } from "./format";

interface DashboardViewProps {
  data: DashboardData;
  locale: Locale;
  isRtl: boolean;
  // Office name, or the user's first name.
  name: string;
  hasLoadError: boolean;
  isRefreshing: boolean;
  refreshStatus: "idle" | "success" | "error";
  onRefresh: () => void;
}

function attentionItems(data: DashboardData, locale: Locale, t: DashboardText): AttentionItem[] {
  const { attention } = data;
  const items: AttentionItem[] = [];

  if (attention.overdueInvoices && attention.overdueInvoices.count > 0) {
    items.push({
      key: "overdue-invoices",
      title: pluralize(locale, attention.overdueInvoices.count, PLURALS.overdueInvoices),
      detail: t.attentionOverdueAmount(formatJOD(attention.overdueInvoices.amount)),
      href: "/dashboard/finance/invoices",
      icon: <ReceiptText className="h-5 w-5" />,
      tone: "danger",
    });
  }

  if (attention.overdueTasks > 0) {
    items.push({
      key: "overdue-tasks",
      title: pluralize(locale, attention.overdueTasks, PLURALS.overdueTasks),
      detail: t.attentionOverdueTasksSub,
      href: "/dashboard/tasks",
      icon: <ListTodo className="h-5 w-5" />,
      tone: "danger",
    });
  }

  if (attention.sessionsWithin48h > 0) {
    items.push({
      key: "sessions-48h",
      title: pluralize(locale, attention.sessionsWithin48h, PLURALS.sessionsWithin48h),
      detail: t.attentionSessionsSub,
      href: "/dashboard/appointments",
      icon: <Gavel className="h-5 w-5" />,
      tone: "warning",
    });
  }

  if (attention.staleCases > 0) {
    items.push({
      key: "stale-cases",
      title: pluralize(locale, attention.staleCases, PLURALS.staleCases),
      detail: t.attentionStaleSub,
      href: "/dashboard/cases",
      icon: <Clock3 className="h-5 w-5" />,
      tone: "info",
    });
  }

  const subscription = attention.subscription;
  if (subscription) {
    const daysLeft = subscription.daysLeft ?? 0;
    items.push({
      key: "subscription",
      title:
        subscription.kind === "TRIAL_ENDING"
          ? t.trialEnding
          : subscription.kind === "PAYMENT_FAILED"
            ? t.paymentFailed
            : t.cancelling,
      detail: pluralize(
        locale,
        daysLeft,
        subscription.kind === "PAYMENT_FAILED" ? PLURALS.locksIn : PLURALS.endsIn,
      ),
      href: "/dashboard/billing",
      icon: <CreditCard className="h-5 w-5" />,
      tone: subscription.kind === "PAYMENT_FAILED" ? "danger" : "warning",
    });
  }

  return items;
}

// The 12-column dashboard: every row's cards share one height (grid
// stretch + h-full cards); tablet gets two columns, mobile one.
export default function DashboardView({
  data,
  locale,
  isRtl,
  name,
  hasLoadError,
  isRefreshing,
  refreshStatus,
  onRefresh,
}: DashboardViewProps) {
  const t = TEXT[locale];
  const { kpis, permissions, timeZone, generatedAt: nowIso } = data;
  const canViewFinance = permissions.canViewFinance;

  const hour = DateTime.fromISO(nowIso).setZone(timeZone).hour;
  const greeting = hour < 12 ? t.morning : t.evening;
  const dir = isRtl ? "rtl" : "ltr";
  const title = name ? (
    <>
      {greeting}
      {locale === "ar" ? "، " : ", "}
      <bdi>{name}</bdi>
    </>
  ) : (
    greeting
  );

  const followUps = kpis.overdueTasks + kpis.dueTodayTasks;
  const summaryParts = [
    kpis.todayAppointments > 0 ? pluralize(locale, kpis.todayAppointments, PLURALS.appointmentsToday) : null,
    followUps > 0 ? pluralize(locale, followUps, PLURALS.tasksNeedingFollowUp) : null,
  ].filter(Boolean);
  const summary =
    summaryParts.length === 0
      ? t.clearDay
      : locale === "ar"
        ? `${t.youHave} ${summaryParts.join(` ${t.and}`)}.`
        : `${t.youHave} ${summaryParts.join(` ${t.and} `)}.`;

  const changePct = kpis.collectedChangePct;
  const collectedHint: { text: ReactNode; tone: KpiHintTone } =
    changePct === null
      ? { text: t.kpiNoBase, tone: "neutral" }
      : {
          text: (
            <>
              <bdi dir="ltr">{`${changePct > 0 ? "+" : ""}${changePct}%`}</bdi> {t.kpiVsLastMonth}
            </>
          ),
          tone: changePct >= 0 ? "good" : "bad",
        };
  const overdueInvoiceCount = data.attention.overdueInvoices?.count ?? 0;

  const sideBySide = "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12";

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="animate-fade w-full min-w-0 max-w-full space-y-4 overflow-x-hidden text-start"
    >
      {hasLoadError && (
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-200"
          role="status"
        >
          {t.loadingFailed}
        </div>
      )}

      <DemoModeCard />

      {/* Row 1: greeting, date, quick actions */}
      <DashboardHeader
        title={title}
        dir={dir}
        dateLabel={formatLongDate(nowIso, locale, timeZone)}
        summary={summary}
        canViewFinance={canViewFinance}
        isRefreshing={isRefreshing}
        refreshStatus={refreshStatus}
        onRefresh={onRefresh}
        labels={{
          quickActions: t.quickActions,
          addClient: t.addClient,
          addCase: t.addCase,
          addAppointment: t.addAppointment,
          createInvoice: t.createInvoice,
          uploadDocument: t.uploadDocument,
          refresh: t.refresh,
          refreshing: t.refreshing,
          refreshSuccess: t.refreshSuccess,
          refreshError: t.refreshError,
        }}
      />

      {/* Row 2: KPIs */}
      <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          dir={dir}
          label={t.kpiActiveCases}
          value={formatCount(kpis.activeCases)}
          hint={pluralize(locale, kpis.totalCases, PLURALS.ofTotalCases)}
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          tone="teal"
          href="/dashboard/cases"
        />
        <KpiCard
          dir={dir}
          label={t.kpiSessions}
          value={formatCount(kpis.sessionsThisWeek)}
          hint={t.kpiSessionsHint}
          icon={<Gavel className="h-4 w-4" />}
          tone="gold"
          href="/dashboard/appointments"
        />
        <KpiCard
          dir={dir}
          label={t.kpiOverdueTasks}
          value={formatCount(kpis.overdueTasks)}
          hint={kpis.overdueTasks > 0 ? t.kpiOverdueHint : t.kpiOnTrack}
          hintTone={kpis.overdueTasks > 0 ? "bad" : "good"}
          icon={<ListTodo className="h-4 w-4" />}
          tone={kpis.overdueTasks > 0 ? "red" : "purple"}
          href="/dashboard/tasks"
        />
        {canViewFinance ? (
          <>
            <KpiCard
              dir={dir}
              label={t.kpiOutstanding}
              value={formatJOD(kpis.outstanding)}
              hint={
                overdueInvoiceCount > 0
                  ? pluralize(locale, overdueInvoiceCount, PLURALS.overdueInvoices)
                  : t.kpiNoOverdueInvoices
              }
              hintTone={overdueInvoiceCount > 0 ? "bad" : "good"}
              icon={<WalletCards className="h-4 w-4" />}
              tone="gold"
              href="/dashboard/finance/invoices"
            />
            <KpiCard
              dir={dir}
              label={t.kpiCollected}
              value={formatJOD(kpis.collectedThisMonth)}
              hint={collectedHint.text}
              hintTone={collectedHint.tone}
              icon={<CircleDollarSign className="h-4 w-4" />}
              tone="emerald"
              href="/dashboard/finance/payments"
            />
          </>
        ) : (
          <>
            <KpiCard
              dir={dir}
              label={t.kpiTodayAppointments}
              value={formatCount(kpis.todayAppointments)}
              hint={t.kpiTodayHint}
              icon={<CalendarDays className="h-4 w-4" />}
              tone="blue"
              href="/dashboard/appointments"
            />
            <KpiCard
              dir={dir}
              label={t.kpiDueToday}
              value={formatCount(kpis.dueTodayTasks)}
              hint={t.kpiDueTodayHint}
              icon={<CalendarClock className="h-4 w-4" />}
              tone="purple"
              href="/dashboard/tasks"
            />
          </>
        )}
        <KpiCard
          dir={dir}
          label={t.kpiNewClients}
          value={formatCount(kpis.newClientsThisMonth)}
          hint={pluralize(locale, kpis.totalClients, PLURALS.totalClients)}
          icon={<UserPlus className="h-4 w-4" />}
          tone="blue"
          href="/dashboard/clients"
        />
      </div>

      {/* Row 3: only what needs action */}
      <AttentionStrip title={t.attention} items={attentionItems(data, locale, t)} isRtl={isRtl} />

      {/* Row 4: the week ahead */}
      <div className={sideBySide}>
        <div className="min-w-0 xl:col-span-8">
          <AgendaCard
            items={data.agenda}
            total={data.agendaTotal}
            locale={locale}
            isRtl={isRtl}
            timeZone={timeZone}
            nowIso={nowIso}
            t={t}
          />
        </div>
        <div className="min-w-0 xl:col-span-4">
          <TasksCard tasks={data.upcomingTasks} locale={locale} isRtl={isRtl} timeZone={timeZone} nowIso={nowIso} t={t} />
        </div>
      </div>

      {/* Row 5: money and caseload */}
      <div className={sideBySide}>
        {data.finance && (
          <div className="min-w-0 xl:col-span-8">
            <FinanceCard months={data.finance.months} aging={data.finance.aging} locale={locale} isRtl={isRtl} t={t} />
          </div>
        )}
        <div className={`min-w-0 ${data.finance ? "xl:col-span-4" : "md:col-span-2 xl:col-span-12"}`}>
          <CasesBreakdownCard
            byStatus={data.casesByStatus}
            byCourt={data.casesByCourt}
            locale={locale}
            isRtl={isRtl}
            wide={!data.finance}
            t={t}
          />
        </div>
      </div>

      {/* Row 6: latest records */}
      <div className={sideBySide}>
        <div className="min-w-0 xl:col-span-6">
          <RecentCasesCard cases={data.recentCases} locale={locale} isRtl={isRtl} nowIso={nowIso} t={t} />
        </div>
        <div className="min-w-0 xl:col-span-6">
          <RecentDocumentsCard documents={data.recentDocuments} locale={locale} isRtl={isRtl} timeZone={timeZone} t={t} />
        </div>
      </div>

      {/* Row 7: activity and account */}
      <div className={sideBySide}>
        <div className={`min-w-0 ${data.account ? "xl:col-span-8" : "md:col-span-2 xl:col-span-12"}`}>
          <ActivityFeed activities={data.recentActivities} locale={locale} isRtl={isRtl} nowIso={nowIso} t={t} />
        </div>
        {data.account && (
          <div className="min-w-0 xl:col-span-4">
            <AccountCard
              account={data.account}
              canManageBilling={permissions.canManageBilling}
              locale={locale}
              isRtl={isRtl}
              timeZone={timeZone}
              t={t}
            />
          </div>
        )}
      </div>
    </main>
  );
}
