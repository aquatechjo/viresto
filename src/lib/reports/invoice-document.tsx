// The printed invoice, on the shared report system (header, footer,
// colors, fonts). Arabic (RTL) or English (LTR), as chosen on the invoice
// page. Printing and "Save as PDF" are the same action: the browser's
// print dialog.

import { invoiceStatusText, invoiceStatusTone } from "@/lib/invoice-status-display";
import {
  INVOICE_COPY,
  formatInvoiceNumber,
  invoiceCaseText,
  type InvoiceLocale,
  type PrintableInvoice,
} from "@/lib/invoice-print";
import { formatPhoneForDisplay } from "@/lib/phone";
import { statusTone } from "@/lib/theme/status";
import {
  ClosingLine,
  InfoGrid,
  NoticeBox,
  ReportLayout,
  ReportSection,
  ReportTable,
  ReportTitle,
  SignatureLines,
  Stamp,
  StatusBadge,
  SummaryCards,
  TextBox,
  TotalsList,
  type ReportColumn,
} from "./components";
import { reportDate, reportMoney, sumMoney } from "./format";
import { renderReportHtml } from "./render";

export type InvoiceDocumentOptions = {
  /** Absolute origin of the fonts; "" leaves them relative. */
  assetBaseUrl?: string;
  /** The office logo after the browser checked it loads; null: initial. */
  logoUrl?: string | null;
};

type Item = PrintableInvoice["items"][number] & { index: number };

/** Collected (PAID) payments of the invoice, and what is left. */
export function invoicePaymentTotals(invoice: PrintableInvoice) {
  const paid = sumMoney((invoice.payments ?? []).filter((payment) => payment.status === "PAID").map((payment) => payment.amount ?? 0));
  const remaining = Math.max(0, sumMoney([invoice.total, -paid]));
  return { paid, remaining };
}

export function InvoiceDocument({
  invoice,
  locale,
  options = {},
}: {
  invoice: PrintableInvoice;
  locale: InvoiceLocale;
  options?: InvoiceDocumentOptions;
}) {
  const copy = INVOICE_COPY[locale];
  const number = formatInvoiceNumber(invoice.invoiceNumber, locale);
  const isCancelled = invoice.status === "CANCELLED";
  const status = {
    label: invoiceStatusText(invoice.status, invoice.isOverdue, copy.statuses),
    tone: statusTone("invoice", invoiceStatusTone(invoice.status, invoice.isOverdue)),
  };
  const payments = invoice.payments ?? [];
  const { paid, remaining } = invoicePaymentTotals(invoice);
  const date = (value: string | null | undefined) => (value ? reportDate(value, locale) : copy.empty);
  const tenant = invoice.tenant;

  const columns: ReportColumn<Item>[] = [
    { key: "n", header: copy.number, cell: (row) => row.index, numeric: true, align: "center", width: "7%" },
    { key: "description", header: copy.description, cell: (row) => row.description, width: "47%" },
    { key: "quantity", header: copy.quantity, cell: (row) => row.quantity, numeric: true, align: "center", width: "12%" },
    { key: "unit", header: copy.unitPrice, cell: (row) => reportMoney(row.unitPrice), numeric: true, width: "17%" },
    {
      key: "total",
      header: copy.lineTotal,
      cell: (row) => reportMoney(row.total ?? Number(row.quantity || 0) * Number(row.unitPrice || 0)),
      numeric: true,
      strong: true,
      width: "17%",
    },
  ];

  return (
    <ReportLayout
      meta={{
        documentTitle: `${copy.invoice} ${number}`,
        number,
        issuedAt: new Date(invoice.issueDate),
        office: {
          name: tenant?.name || "Viresto",
          phone: tenant?.phone,
          email: tenant?.email,
          address: tenant?.address,
          logoUrl: options.logoUrl ?? null,
        },
        assetBaseUrl: options.assetBaseUrl ?? "",
        locale,
        headerRows: [
          { label: copy.invoiceNumber, value: number, numeric: true },
          { label: copy.issueDate, value: date(invoice.issueDate) },
        ],
      }}
    >
      {isCancelled ? <Stamp>{copy.cancelledStamp}</Stamp> : null}

      <ReportTitle>
        {copy.invoice} <span className="num">{number}</span>
        <span className="report-title-badge">
          <StatusBadge {...status} />
        </span>
      </ReportTitle>

      <div className="report-section">
        <SummaryCards
          cards={[
            { label: copy.invoiceNumber, value: number },
            { label: copy.issueDate, value: date(invoice.issueDate), numeric: false },
            { label: copy.dueDate, value: date(invoice.dueDate), numeric: false },
            { label: copy.finalTotal, value: reportMoney(invoice.total), tone: "accent" },
          ]}
        />
        {isCancelled ? (
          <NoticeBox title={copy.cancellationReason}>
            <p>{invoice.cancellationReason || copy.empty}</p>
            {invoice.cancelledAt ? (
              <p>
                {copy.cancelledOn}: {date(invoice.cancelledAt)}
              </p>
            ) : null}
          </NoticeBox>
        ) : null}
      </div>

      <div className="report-two-columns">
        <ReportSection title={copy.clientDetails}>
          <InfoGrid
            emptyValue={copy.empty}
            items={[
              { label: copy.clientName, value: invoice.client?.name, wide: true },
              { label: copy.phone, value: formatPhoneForDisplay(invoice.client?.phone) || null, numeric: true, wide: true },
              { label: copy.email, value: invoice.client?.email, numeric: true, wide: true },
            ]}
          />
        </ReportSection>
        <ReportSection title={copy.caseDetails}>
          <InfoGrid
            emptyValue={copy.empty}
            items={[
              { label: copy.case, value: invoiceCaseText(invoice, locale), wide: true },
              { label: copy.status, value: status.label, wide: true },
              {
                label: copy.linkedPayments,
                value: payments.length > 0 ? String(payments.length) : copy.noLinkedPayment,
                wide: true,
              },
            ]}
          />
        </ReportSection>
      </div>

      <ReportSection title={copy.items} isEmpty={invoice.items.length === 0} emptyMessage={copy.noItems}>
        <ReportTable
          columns={columns}
          rows={invoice.items.map((item, index) => ({ ...item, index: index + 1 }))}
          rowKey={(row) => row.id ?? String(row.index)}
        />
      </ReportSection>

      <div className="report-two-columns">
        <ReportSection title={copy.notes}>
          <TextBox>{invoice.notes || copy.noNotes}</TextBox>
        </ReportSection>
        <ReportSection title={copy.lineTotal}>
          <TotalsList
            rows={[
              { label: copy.subtotal, value: reportMoney(invoice.subtotal) },
              { label: copy.tax, value: reportMoney(invoice.tax) },
              { label: copy.discount, value: reportMoney(invoice.discount) },
              { label: copy.finalTotal, value: reportMoney(invoice.total), grand: true },
            ]}
          />
        </ReportSection>
      </div>

      {payments.length > 0 ? (
        <ReportSection title={copy.linkedPayments}>
          <SummaryCards
            cards={[
              { label: copy.paymentsCount, value: String(payments.length) },
              { label: copy.paid, value: reportMoney(paid) },
              { label: copy.remaining, value: reportMoney(remaining), tone: "accent" },
            ]}
          />
        </ReportSection>
      ) : null}

      <SignatureLines labels={[copy.officeSignature, copy.clientSignature]} />
      <ClosingLine>{copy.generatedBy}</ClosingLine>
    </ReportLayout>
  );
}

export function buildInvoicePrintHtml(
  invoice: PrintableInvoice,
  locale: InvoiceLocale,
  options: InvoiceDocumentOptions = {},
): string {
  return renderReportHtml(<InvoiceDocument invoice={invoice} locale={locale} options={options} />);
}
