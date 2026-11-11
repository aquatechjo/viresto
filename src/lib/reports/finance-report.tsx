// The finance report (التقرير المالي): the finance reports page, printed
// on the shared report foundation. Data: GET /api/reports/summary with
// details=all and the page's filters; every active filter is printed under
// the title, and every number says what it covers (the period, or all
// periods within the client and case filters).

import { formatTimeRange } from "@/lib/datetime";
import { invoiceStatusText, invoiceStatusTone } from "@/lib/invoice-status-display";
import { statusTone } from "@/lib/theme/status";
import {
  CellWithNote,
  ReportLayout,
  ReportSection,
  ReportTable,
  ReportTitle,
  StatusBadge,
  SummaryCards,
  type ReportColumn,
  type ReportOffice,
} from "./components";
import { REPORT_EMPTY, isBlank, reportDate, reportDateStamp, reportMoney, textOrEmpty } from "./format";
import {
  CASE_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  UNKNOWN_LABEL,
  paymentMethodLabel,
  reportStatus,
} from "./labels";
import { renderReportHtml } from "./render";

type DateValue = string | Date;
type MoneyValue = number | string;

export const REPORT_MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
] as const;

type Named = { name: string } | null | undefined;
type Titled = { title: string } | null | undefined;

export type FinanceReportPayment = {
  id: string;
  amount: MoneyValue;
  status: string;
  method?: string | null;
  reportDate: DateValue;
  notes?: string | null;
  reference?: string | null;
  receiptNumber?: string | null;
  client?: Named;
  case?: Titled;
};

export type FinanceReportInvoice = {
  id: string;
  invoiceNumber: string | null;
  total: MoneyValue;
  status: string;
  isOverdue: boolean;
  issueDate: DateValue;
  dueDate?: DateValue | null;
  paidAmount: MoneyValue;
  remainingAmount: MoneyValue;
  client?: Named;
  case?: Titled;
};

export type FinanceReportAppointment = {
  id: string;
  title: string;
  startTime: DateValue;
  endTime?: DateValue | null;
  location?: string | null;
  case?: Titled;
};

export type FinanceReportTask = {
  id: string;
  title: string;
  dueDate?: DateValue | null;
  priority?: string | null;
  case?: Titled;
};

export type FinanceReportTopClient = {
  id: string;
  name: string;
  casesCount: number;
  paymentsTotal: MoneyValue;
  invoicesTotal: MoneyValue;
};

/** The JSON of GET /api/reports/summary?details=all (the fields printed). */
export type FinanceReportData = {
  office?: ReportOffice | null;
  clients: { id: string; name: string }[];
  summary: {
    periodRevenue: MoneyValue;
    totalPaidAll: MoneyValue;
    pendingPaymentsAmount: MoneyValue;
    totalInvoicesAmount: MoneyValue;
    paidInvoicesAmount: MoneyValue;
    unpaidInvoicesAmount: MoneyValue;
    overdueInvoicesAmount: MoneyValue;
    collectionRate: number;
    totalCases: number;
    upcomingAppointmentsCount: number;
    overdueTasksCount: number;
  };
  caseStatus: Record<string, number>;
  topClients: FinanceReportTopClient[];
  monthlyRevenue: { month: number; revenue: MoneyValue }[];
  periodPayments: FinanceReportPayment[];
  periodInvoices: FinanceReportInvoice[];
  upcomingAppointments: FinanceReportAppointment[];
  overdueTasks: FinanceReportTask[];
  detailCounts: { payments: number; invoices: number };
};

/** The page's filters when the report was printed ("" = all). */
export type FinanceReportScope = {
  type: "yearly" | "monthly";
  year: number;
  /** 0-11. */
  month: number;
  clientId?: string;
  caseStatus?: string;
  paymentStatus?: string;
  invoiceStatus?: string;
};

export type FinanceReportOptions = {
  issuedAt: Date;
  assetBaseUrl: string;
  logoUrl?: string | null;
};

export function financeReportTitle(scope: FinanceReportScope): string {
  return scope.type === "monthly"
    ? `تقرير ${REPORT_MONTHS_AR[scope.month] ?? ""} ${scope.year}`
    : `التقرير السنوي ${scope.year}`;
}

function periodLabel(scope: FinanceReportScope): string {
  return scope.type === "monthly" ? `${REPORT_MONTHS_AR[scope.month] ?? ""} ${scope.year}` : String(scope.year);
}

function label(labels: Record<string, string>, value: string): string {
  return labels[value] ?? UNKNOWN_LABEL;
}

/**
 * The line under the title: the period, then each filter that is set.
 * Filters left on "all" are not listed; with none set, one closing
 * phrase says so.
 */
export function financeScopeLine(scope: FinanceReportScope, clients: { id: string; name: string }[]): string {
  const parts = [`الفترة: ${periodLabel(scope)}`];

  if (scope.clientId) {
    parts.push(`الموكل: ${clients.find((client) => client.id === scope.clientId)?.name ?? UNKNOWN_LABEL}`);
  }
  if (scope.caseStatus) parts.push(`حالة القضية: ${label(CASE_STATUS_LABELS, scope.caseStatus)}`);
  if (scope.paymentStatus) parts.push(`الدفعات: ${label(PAYMENT_STATUS_LABELS, scope.paymentStatus)}`);
  if (scope.invoiceStatus) parts.push(`الفواتير: ${label(INVOICE_STATUS_LABELS, scope.invoiceStatus)}`);
  if (parts.length === 1) parts.push("جميع الموكلين والحالات");

  return parts.join("  ·  ");
}

/** The period's revenue counts collected payments only. */
function revenueHidden(scope: FinanceReportScope): boolean {
  return Boolean(scope.paymentStatus) && scope.paymentStatus !== "PAID";
}

function shownOf(shown: number, total: number): string | undefined {
  return total > shown ? `يعرض ${shown} من ${total}` : undefined;
}

const countFormat = new Intl.NumberFormat("en-US");
const count = (value: number) => countFormat.format(value);

const paymentColumns: ReportColumn<FinanceReportPayment>[] = [
  { key: "date", header: "التاريخ", cell: (row) => reportDate(row.reportDate), strong: true, width: "16%" },
  {
    key: "client",
    header: "الموكل",
    cell: (row) => <CellWithNote note={row.case?.title ?? null}>{textOrEmpty(row.client?.name)}</CellWithNote>,
    width: "24%",
  },
  { key: "amount", header: "المبلغ", cell: (row) => reportMoney(row.amount), numeric: true, width: "14%" },
  { key: "method", header: "طريقة الدفع", cell: (row) => paymentMethodLabel(row.method), width: "13%" },
  { key: "status", header: "الحالة", cell: (row) => <StatusBadge {...reportStatus("payment", row.status)} />, width: "11%" },
  {
    key: "notes",
    header: "ملاحظات",
    cell: (row) => {
      const refs = [row.receiptNumber ? `سند ${row.receiptNumber}` : null, row.reference ? `مرجع ${row.reference}` : null]
        .filter(Boolean)
        .join(" · ");
      if (isBlank(row.notes)) return refs ? <span className="cell-note">{refs}</span> : REPORT_EMPTY;
      return <CellWithNote note={refs || null}>{row.notes}</CellWithNote>;
    },
    width: "22%",
  },
];

const invoiceColumns: ReportColumn<FinanceReportInvoice>[] = [
  {
    key: "number",
    header: "رقم الفاتورة",
    cell: (row) => row.invoiceNumber ?? INVOICE_STATUS_LABELS.DRAFT,
    numeric: true,
    strong: true,
    width: "14%",
  },
  {
    key: "client",
    header: "الموكل",
    cell: (row) => <CellWithNote note={row.case?.title ?? null}>{textOrEmpty(row.client?.name)}</CellWithNote>,
    width: "21%",
  },
  {
    key: "issued",
    header: "الإصدار",
    cell: (row) => (
      <CellWithNote note={row.dueDate ? `الاستحقاق: ${reportDate(row.dueDate)}` : null}>{reportDate(row.issueDate)}</CellWithNote>
    ),
    width: "17%",
  },
  { key: "total", header: "المبلغ", cell: (row) => reportMoney(row.total), numeric: true, width: "12%" },
  { key: "paid", header: "المحصّل", cell: (row) => reportMoney(row.paidAmount), numeric: true, width: "12%" },
  { key: "remaining", header: "المتبقي", cell: (row) => reportMoney(row.remainingAmount), numeric: true, width: "12%" },
  {
    key: "status",
    header: "الحالة",
    cell: (row) => (
      <StatusBadge
        label={invoiceStatusText(row.status, row.isOverdue, INVOICE_STATUS_LABELS)}
        tone={statusTone("invoice", invoiceStatusTone(row.status, row.isOverdue))}
      />
    ),
    width: "12%",
  },
];

const appointmentColumns: ReportColumn<FinanceReportAppointment>[] = [
  { key: "date", header: "التاريخ", cell: (row) => reportDate(row.startTime), strong: true, width: "20%" },
  {
    key: "time",
    header: "الوقت",
    cell: (row) => <bdi dir="rtl">{formatTimeRange(row.startTime, row.endTime ?? null, "ar")}</bdi>,
    width: "16%",
  },
  { key: "title", header: "الموعد", cell: (row) => row.title, width: "24%" },
  { key: "case", header: "القضية", cell: (row) => textOrEmpty(row.case?.title), width: "22%" },
  { key: "location", header: "المكان", cell: (row) => textOrEmpty(row.location), width: "18%" },
];

const taskColumns: ReportColumn<FinanceReportTask>[] = [
  { key: "due", header: "الاستحقاق", cell: (row) => reportDate(row.dueDate), strong: true, width: "20%" },
  { key: "title", header: "المهمة", cell: (row) => row.title, width: "38%" },
  { key: "case", header: "القضية", cell: (row) => textOrEmpty(row.case?.title), width: "27%" },
  {
    key: "priority",
    header: "الأولوية",
    cell: (row) => (row.priority ? <StatusBadge {...reportStatus("priority", row.priority)} /> : REPORT_EMPTY),
    width: "15%",
  },
];

type RankedClient = FinanceReportTopClient & { rank: number };

const topClientColumns: ReportColumn<RankedClient>[] = [
  { key: "rank", header: "#", cell: (row) => row.rank, numeric: true, align: "center", width: "7%" },
  { key: "name", header: "الموكل", cell: (row) => row.name, strong: true, width: "39%" },
  { key: "paid", header: "المدفوع في الفترة", cell: (row) => reportMoney(row.paymentsTotal), numeric: true, width: "20%" },
  { key: "invoices", header: "فواتير الفترة", cell: (row) => reportMoney(row.invoicesTotal), numeric: true, width: "20%" },
  { key: "cases", header: "القضايا", cell: (row) => row.casesCount, numeric: true, align: "center", width: "14%" },
];

type MonthPair = { id: string; first: { month: number; revenue: MoneyValue }; second?: { month: number; revenue: MoneyValue } };

const monthColumns: ReportColumn<MonthPair>[] = [
  { key: "m1", header: "الشهر", cell: (row) => REPORT_MONTHS_AR[row.first.month], strong: true, width: "25%" },
  { key: "r1", header: "الإيراد", cell: (row) => reportMoney(row.first.revenue), numeric: true, width: "25%" },
  { key: "m2", header: "الشهر", cell: (row) => (row.second ? REPORT_MONTHS_AR[row.second.month] : ""), strong: true, width: "25%" },
  { key: "r2", header: "الإيراد", cell: (row) => (row.second ? reportMoney(row.second.revenue) : ""), numeric: true, width: "25%" },
];

export function FinanceReport({
  data,
  scope,
  options,
}: {
  data: FinanceReportData;
  scope: FinanceReportScope;
  options: FinanceReportOptions;
}) {
  const { summary } = data;
  const office: ReportOffice = {
    name: data.office?.name || "Viresto",
    phone: data.office?.phone,
    email: data.office?.email,
    address: data.office?.address,
    logoUrl: options.logoUrl ?? null,
  };
  const monthStamp = scope.type === "monthly" ? `-${String(scope.month + 1).padStart(2, "0")}` : "";
  const months = [...data.monthlyRevenue].sort((a, b) => a.month - b.month);
  const monthPairs: MonthPair[] = months.slice(0, 6).map((first, index) => ({
    id: String(first.month),
    first,
    second: months[index + 6],
  }));
  const ranked = data.topClients.map((client, index) => ({ ...client, rank: index + 1 }));
  const hideRevenue = revenueHidden(scope);

  return (
    <ReportLayout
      meta={{
        documentTitle: `${financeReportTitle(scope)} - ${office.name}`,
        number: `FR-${scope.year}${monthStamp}-${reportDateStamp(options.issuedAt)}`,
        issuedAt: options.issuedAt,
        office,
        assetBaseUrl: options.assetBaseUrl,
      }}
    >
      <ReportTitle subtitle={financeScopeLine(scope, data.clients)}>{financeReportTitle(scope)}</ReportTitle>

      <ReportSection title="أرقام الفترة" note={`من ${periodLabel(scope)} فقط، ضمن الفلاتر أعلاه`}>
        <SummaryCards
          cards={[
            {
              label: "إيرادات الفترة",
              value: hideRevenue ? REPORT_EMPTY : reportMoney(summary.periodRevenue),
              hint: hideRevenue ? "لا تُحسب مع فلتر الدفعات الحالي" : "الدفعات المحصّلة في الفترة",
              tone: "accent",
            },
            { label: "دفعات الفترة", value: count(data.detailCounts.payments), hint: "بكل حالاتها ضمن الفلاتر" },
            { label: "فواتير الفترة", value: count(data.detailCounts.invoices), hint: "حسب تاريخ الإصدار" },
          ]}
        />
      </ReportSection>

      <ReportSection title="الوضع المالي الحالي" note="كل الفترات حتى تاريخ الإصدار، ضمن فلتري الموكل وحالة القضية">
        <SummaryCards
          cards={[
            { label: "إجمالي الفواتير", value: reportMoney(summary.totalInvoicesAmount), hint: "دون المسودات والملغاة" },
            { label: "المحصّل من الفواتير", value: reportMoney(summary.paidInvoicesAmount) },
            { label: "غير المدفوع", value: reportMoney(summary.unpaidInvoicesAmount), tone: "accent" },
            { label: "منه متأخر", value: reportMoney(summary.overdueInvoicesAmount) },
          ]}
        />
        <SummaryCards
          cards={[
            { label: "نسبة التحصيل", value: `${summary.collectionRate}%`, hint: "المحصّل ÷ إجمالي الفواتير" },
            { label: "دفعات معلقة أو متأخرة", value: reportMoney(summary.pendingPaymentsAmount) },
            { label: "إجمالي التحصيل", value: reportMoney(summary.totalPaidAll), hint: "كل الدفعات المحصّلة" },
          ]}
        />
      </ReportSection>

      <ReportSection
        title="القضايا"
        count={summary.totalCases}
        note="حسب الحالة الآن، ضمن فلتري الموكل وحالة القضية"
        isEmpty={summary.totalCases === 0}
        emptyMessage="لا توجد قضايا ضمن الفلاتر الحالية"
      >
        <SummaryCards
          cards={(Object.keys(CASE_STATUS_LABELS) as (keyof typeof CASE_STATUS_LABELS)[]).map((status) => ({
            label: CASE_STATUS_LABELS[status],
            value: count(data.caseStatus[status] ?? 0),
          }))}
        />
      </ReportSection>

      {scope.type === "yearly" ? (
        <ReportSection
          title={`الإيرادات الشهرية ${scope.year}`}
          note={hideRevenue ? "الدفعات المحصّلة فقط، بغض النظر عن فلتر الدفعات" : "الدفعات المحصّلة في كل شهر"}
          isEmpty={months.length === 0}
          emptyMessage="لا توجد إيرادات"
        >
          <ReportTable columns={monthColumns} rows={monthPairs} rowKey={(row) => row.id} />
        </ReportSection>
      ) : null}

      <ReportSection
        title="أعلى الموكلين بالمبلغ المدفوع"
        note="الدفعات المحصّلة في الفترة، من الأعلى"
        isEmpty={ranked.length === 0}
        emptyMessage="لا توجد دفعات محصّلة ضمن الفلاتر الحالية"
      >
        <ReportTable columns={topClientColumns} rows={ranked} rowKey={(row) => row.id} />
      </ReportSection>

      <ReportSection
        title="دفعات الفترة"
        count={data.detailCounts.payments}
        note={shownOf(data.periodPayments.length, data.detailCounts.payments)}
        isEmpty={data.periodPayments.length === 0}
        emptyMessage="لا توجد دفعات ضمن الفلاتر الحالية"
      >
        <ReportTable columns={paymentColumns} rows={data.periodPayments} rowKey={(row) => row.id} />
      </ReportSection>

      <ReportSection
        title="فواتير الفترة"
        count={data.detailCounts.invoices}
        note={shownOf(data.periodInvoices.length, data.detailCounts.invoices)}
        isEmpty={data.periodInvoices.length === 0}
        emptyMessage="لا توجد فواتير ضمن الفلاتر الحالية"
      >
        <ReportTable columns={invoiceColumns} rows={data.periodInvoices} rowKey={(row) => row.id} />
      </ReportSection>

      <ReportSection
        title="المواعيد القادمة"
        count={summary.upcomingAppointmentsCount}
        note={shownOf(data.upcomingAppointments.length, summary.upcomingAppointmentsCount) ?? "حتى نهاية الفترة"}
        isEmpty={data.upcomingAppointments.length === 0}
        emptyMessage="لا توجد مواعيد قادمة ضمن الفترة"
      >
        <ReportTable columns={appointmentColumns} rows={data.upcomingAppointments} rowKey={(row) => row.id} />
      </ReportSection>

      <ReportSection
        title="المهام المتأخرة"
        count={summary.overdueTasksCount}
        note={shownOf(data.overdueTasks.length, summary.overdueTasksCount)}
        isEmpty={data.overdueTasks.length === 0}
        emptyMessage="لا توجد مهام متأخرة ضمن الفترة"
      >
        <ReportTable columns={taskColumns} rows={data.overdueTasks} rowKey={(row) => row.id} />
      </ReportSection>
    </ReportLayout>
  );
}

export function buildFinanceReportHtml(
  data: FinanceReportData,
  scope: FinanceReportScope,
  options: FinanceReportOptions,
): string {
  return renderReportHtml(<FinanceReport data={data} scope={scope} options={options} />);
}
