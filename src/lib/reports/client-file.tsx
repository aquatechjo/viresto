// The client file (ملف الموكل): one client's details, agreed fees and
// payments, cases, and sessions/appointments, on the shared report
// foundation. Data: GET /api/clients/[id]/full.

import { formatTimeRange } from "@/lib/datetime";
import {
  CellWithNote,
  InfoGrid,
  ReportLayout,
  ReportSection,
  ReportSubsection,
  ReportTable,
  ReportTitle,
  StatusBadge,
  SummaryCards,
  type ReportColumn,
  type ReportOffice,
} from "./components";
import {
  isBlank,
  maskNationalId,
  REPORT_EMPTY,
  reportDate,
  reportDateStamp,
  reportMoney,
  reportPhone,
  sumMoney,
  textOrEmpty,
} from "./format";
import { appointmentTypeLabel, paymentMethodLabel, reportStatus } from "./labels";
import { renderReportHtml } from "./render";

type DateValue = string | Date;
type MoneyValue = string | number;

export type ClientFileCase = {
  id: string;
  title: string;
  caseNumber: string | null;
  court: string | null;
  status: string;
  feeAgreed: MoneyValue;
};

export type ClientFileAppointment = {
  id: string;
  title: string;
  description: string | null;
  startTime: DateValue;
  endTime: DateValue | null;
  location: string | null;
  type: string;
  status: string;
  case: { title: string; caseNumber: string | null; court: string | null } | null;
};

export type ClientFilePayment = {
  id: string;
  amount: MoneyValue;
  method: string;
  status: string;
  paidAt: DateValue | null;
  createdAt: DateValue;
  notes: string | null;
  reference: string | null;
  receiptNumber: string | null;
  cancelledAt: DateValue | null;
};

/** The JSON of GET /api/clients/[id]/full. */
export type ClientFileData = {
  publicId: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  nationalId: string | null;
  notes: string | null;
  archivedAt: DateValue | null;
  cases: ClientFileCase[];
  appointments: ClientFileAppointment[];
  payments: ClientFilePayment[];
  office: ReportOffice | null;
  access: { contact: boolean; finance: boolean };
};

export type ClientFileOptions = {
  issuedAt: Date;
  assetBaseUrl: string;
  /** The logo after the browser checked it loads (null: show the initial). */
  logoUrl?: string | null;
  revealNationalId?: boolean;
};

const HIDDEN = "غير متاح بصلاحياتك";

/** A payment that counts as paid: collected and not cancelled. */
export function isCollected(payment: Pick<ClientFilePayment, "status" | "cancelledAt">): boolean {
  return payment.status === "PAID" && !payment.cancelledAt;
}

/**
 * Agreed fees (sum of the cases' feeAgreed), paid (collected payments,
 * cancelled ones excluded) and their difference. Deliberately not the
 * invoice-based "uncollected" figure of the finance pages.
 */
export function clientFileTotals(data: Pick<ClientFileData, "cases" | "payments">) {
  const agreed = sumMoney(data.cases.map((item) => item.feeAgreed));
  const paid = sumMoney(data.payments.filter(isCollected).map((item) => item.amount));
  const remaining = sumMoney([agreed, -paid]);
  return { agreed, paid, remaining };
}

function time(value: DateValue) {
  return new Date(value).getTime();
}

/** Sessions from the issue moment on, soonest first; earlier ones, latest first. */
export function splitAppointments(appointments: ClientFileAppointment[], now: Date) {
  const cutoff = now.getTime();
  const upcoming = appointments
    .filter((item) => time(item.startTime) >= cutoff)
    .sort((a, b) => time(a.startTime) - time(b.startTime));
  const past = appointments
    .filter((item) => time(item.startTime) < cutoff)
    .sort((a, b) => time(b.startTime) - time(a.startTime));
  return { upcoming, past };
}

function caseRef(item: { title: string; caseNumber: string | null }) {
  return item.caseNumber ? `${item.title} (${item.caseNumber})` : item.title;
}

const caseColumns: ReportColumn<ClientFileCase>[] = [
  { key: "number", header: "رقم القضية", cell: (row) => textOrEmpty(row.caseNumber), numeric: true, strong: true, width: "15%" },
  { key: "title", header: "القضية", cell: (row) => row.title, width: "33%" },
  { key: "court", header: "المحكمة", cell: (row) => textOrEmpty(row.court), width: "22%" },
  {
    key: "status",
    header: "الحالة",
    cell: (row) => <StatusBadge {...reportStatus("case", row.status)} />,
    width: "13%",
  },
  { key: "fee", header: "الأتعاب", cell: (row) => reportMoney(row.feeAgreed), numeric: true, align: "end", width: "17%" },
];

const appointmentColumns: ReportColumn<ClientFileAppointment>[] = [
  { key: "date", header: "التاريخ", cell: (row) => reportDate(row.startTime), strong: true, width: "18%" },
  {
    key: "time",
    header: "الوقت",
    cell: (row) => <bdi dir="rtl">{formatTimeRange(row.startTime, row.endTime, "ar")}</bdi>,
    width: "15%",
  },
  {
    key: "court",
    header: "المحكمة / المكان",
    cell: (row) => textOrEmpty(row.location || row.case?.court),
    width: "20%",
  },
  {
    key: "type",
    header: "النوع",
    cell: (row) => (
      <>
        {appointmentTypeLabel(row.type)}
        {row.status !== "SCHEDULED" ? (
          <>
            {" "}
            <StatusBadge {...reportStatus("appointment", row.status)} />
          </>
        ) : null}
      </>
    ),
    width: "15%",
  },
  {
    key: "notes",
    header: "ملاحظات",
    cell: (row) => (
      <CellWithNote note={[row.description?.trim(), row.case ? `القضية: ${caseRef(row.case)}` : null].filter(Boolean).join("\n") || null}>
        {row.title}
      </CellWithNote>
    ),
    width: "32%",
  },
];

const paymentColumns: ReportColumn<ClientFilePayment>[] = [
  { key: "date", header: "التاريخ", cell: (row) => reportDate(row.paidAt ?? row.createdAt), strong: true, width: "18%" },
  { key: "amount", header: "المبلغ", cell: (row) => reportMoney(row.amount), numeric: true, width: "17%" },
  { key: "method", header: "طريقة الدفع", cell: (row) => paymentMethodLabel(row.method), width: "15%" },
  {
    key: "status",
    header: "الحالة",
    cell: (row) => <StatusBadge {...reportStatus("payment", row.status)} />,
    width: "13%",
  },
  {
    key: "notes",
    header: "ملاحظات",
    cell: (row) => {
      const refs = [
        row.receiptNumber ? `سند ${row.receiptNumber}` : null,
        row.reference ? `مرجع ${row.reference}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return isBlank(row.notes) ? (refs ? <span className="cell-note">{refs}</span> : REPORT_EMPTY) : (
        <CellWithNote note={refs || null}>{row.notes}</CellWithNote>
      );
    },
    width: "37%",
  },
];

export function ClientFileReport({ data, options }: { data: ClientFileData; options: ClientFileOptions }) {
  const office: ReportOffice = {
    name: data.office?.name || "Viresto",
    phone: data.office?.phone,
    email: data.office?.email,
    address: data.office?.address,
    logoUrl: options.logoUrl ?? null,
  };
  const contact = (value: string | null) => (data.access.contact ? value : HIDDEN);
  const totals = clientFileTotals(data);
  const { upcoming, past } = splitAppointments(data.appointments, options.issuedAt);
  const sortedPayments = [...data.payments].sort(
    (a, b) => time(b.paidAt ?? b.createdAt) - time(a.paidAt ?? a.createdAt),
  );

  return (
    <ReportLayout
      meta={{
        documentTitle: `ملف الموكل - ${data.name}`,
        number: `CF-${data.publicId}-${reportDateStamp(options.issuedAt)}`,
        issuedAt: options.issuedAt,
        office,
        assetBaseUrl: options.assetBaseUrl,
      }}
    >
      <ReportTitle subtitle={data.archivedAt ? `موكل مؤرشف منذ ${reportDate(data.archivedAt)}` : undefined}>
        ملف الموكل: {data.name}
      </ReportTitle>

      <ReportSection title="البيانات الشخصية">
        <InfoGrid
          items={[
            { label: "الاسم", value: data.name },
            {
              label: "رقم الهاتف",
              value: contact(isBlank(data.phone) ? null : reportPhone(data.phone)),
              numeric: data.access.contact,
            },
            { label: "البريد الإلكتروني", value: contact(data.email), numeric: data.access.contact },
            {
              label: "رقم الهوية",
              value: contact(isBlank(data.nationalId) ? null : maskNationalId(data.nationalId, { reveal: options.revealNationalId })),
              numeric: data.access.contact,
            },
            { label: "العنوان", value: contact(data.address), wide: true },
            { label: "ملاحظات", value: contact(data.notes), wide: true },
          ]}
        />
      </ReportSection>

      {data.access.finance ? (
        <ReportSection
          title="الملخص المالي"
          isEmpty={data.cases.length === 0 && data.payments.length === 0}
          emptyMessage="لا توجد أتعاب أو دفعات مسجلة"
        >
          <SummaryCards
            cards={[
              { label: "الأتعاب المتفق عليها", value: reportMoney(totals.agreed), hint: "مجموع أتعاب القضايا" },
              { label: "المدفوع", value: reportMoney(totals.paid), hint: "الدفعات المحصّلة، دون الملغاة" },
              { label: "المتبقي", value: reportMoney(totals.remaining), hint: "المتفق عليه ناقص المدفوع", tone: "accent" },
            ]}
          />
        </ReportSection>
      ) : null}

      <ReportSection
        title="القضايا"
        count={data.cases.length}
        isEmpty={data.cases.length === 0}
        emptyMessage="لا توجد قضايا مسجلة"
      >
        <ReportTable columns={caseColumns} rows={data.cases} rowKey={(row) => row.id} />
      </ReportSection>

      <ReportSection
        title="الجلسات والمواعيد"
        count={data.appointments.length}
        isEmpty={data.appointments.length === 0}
        emptyMessage="لا توجد جلسات أو مواعيد مسجلة"
      >
        <ReportSubsection title="القادمة" isEmpty={upcoming.length === 0} emptyMessage="لا توجد جلسات قادمة">
          <ReportTable columns={appointmentColumns} rows={upcoming} rowKey={(row) => row.id} />
        </ReportSubsection>
        <ReportSubsection title="السابقة" isEmpty={past.length === 0} emptyMessage="لا توجد جلسات سابقة">
          <ReportTable columns={appointmentColumns} rows={past} rowKey={(row) => row.id} />
        </ReportSubsection>
      </ReportSection>

      {data.access.finance ? (
        <ReportSection
          title="المدفوعات"
          count={data.payments.length}
          isEmpty={data.payments.length === 0}
          emptyMessage="لا توجد دفعات مسجلة"
        >
          <ReportTable columns={paymentColumns} rows={sortedPayments} rowKey={(row) => row.id} />
        </ReportSection>
      ) : null}
    </ReportLayout>
  );
}

export function buildClientFileHtml(data: ClientFileData, options: ClientFileOptions): string {
  return renderReportHtml(<ClientFileReport data={data} options={options} />);
}
