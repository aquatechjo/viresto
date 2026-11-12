// The printed payment receipt (سند القبض), on the shared report system.
// Arabic (RTL) or English (LTR). Printing and "Save as PDF" are the same
// action: the browser's print dialog.

import { RECEIPT_COPY, amountInWords, type PrintableReceipt, type ReceiptLocale } from "@/lib/receipt-print";
import { formatPhoneForDisplay } from "@/lib/phone";
import {
  ClosingLine,
  InfoGrid,
  NoticeBox,
  ReportLayout,
  ReportSection,
  ReportTitle,
  SignatureLines,
  Stamp,
  StatusBadge,
  SummaryCards,
  type InfoItem,
} from "./components";
import { reportDate, reportMoney } from "./format";
import { renderReportHtml } from "./render";

export type ReceiptDocumentOptions = {
  /** Absolute origin of the fonts; "" leaves them relative. */
  assetBaseUrl?: string;
  /** The office logo after the browser checked it loads; null: initial. */
  logoUrl?: string | null;
};

export function ReceiptDocument({
  receipt,
  locale,
  options = {},
}: {
  receipt: PrintableReceipt;
  locale: ReceiptLocale;
  options?: ReceiptDocumentOptions;
}) {
  const copy = RECEIPT_COPY[locale];
  const isCancelled = receipt.status === "CANCELLED";
  const number = receipt.receiptNumber || copy.noNumber;
  const date = (value: string | null | undefined) => (value ? reportDate(value, locale) : copy.empty);
  const tenant = receipt.tenant;

  const caseText = receipt.case
    ? `${receipt.case.title || copy.empty}${receipt.case.caseNumber ? ` - ${receipt.case.caseNumber}` : ""}`
    : null;
  const invoiceText = receipt.invoice?.invoiceNumber ?? null;
  const phone = formatPhoneForDisplay(receipt.client?.phone) || null;

  const details: InfoItem[] = [
    { label: copy.receivedFrom, value: receipt.client?.name || copy.empty, wide: true },
    ...(phone ? [{ label: copy.phone, value: phone, numeric: true }] : []),
    ...(caseText ? [{ label: copy.case, value: caseText }] : []),
    ...(invoiceText ? [{ label: copy.invoice, value: invoiceText, numeric: true }] : []),
    ...(!caseText && !invoiceText ? [{ label: copy.forWhat, value: copy.noLink }] : []),
    { label: copy.method, value: copy.methods[receipt.method] || copy.empty },
    { label: copy.reference, value: receipt.reference || copy.empty, numeric: Boolean(receipt.reference) },
    { label: copy.collectedBy, value: receipt.collectedBy?.name || copy.empty },
  ];

  return (
    <ReportLayout
      meta={{
        documentTitle: `${copy.receipt} ${number}`,
        number,
        issuedAt: receipt.paidAt ? new Date(receipt.paidAt) : new Date(),
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
          { label: copy.receiptNumber, value: number, numeric: Boolean(receipt.receiptNumber) },
          { label: copy.paidAt, value: date(receipt.paidAt) },
        ],
      }}
    >
      {isCancelled ? <Stamp>{copy.stamp}</Stamp> : null}

      <ReportTitle>
        {copy.receipt} <span className="num">{number}</span>
        <span className="report-title-badge">
          <StatusBadge
            label={isCancelled ? copy.statusCancelled : copy.statusPaid}
            tone={isCancelled ? "gray" : "green"}
          />
        </span>
      </ReportTitle>

      <div className="report-section">
        <SummaryCards
          cards={[
            { label: copy.receiptNumber, value: number },
            { label: copy.paidAt, value: date(receipt.paidAt), numeric: false },
            { label: copy.amount, value: reportMoney(receipt.amount), tone: "accent" },
          ]}
        />
      </div>

      <ReportSection title={copy.amountInWords}>
        <div className="report-words">{amountInWords(receipt.amount, locale)}</div>
      </ReportSection>

      {isCancelled ? (
        <NoticeBox title={copy.cancellationReason}>
          <p>{receipt.cancellationReason || copy.empty}</p>
          {receipt.cancelledAt ? (
            <p>
              {copy.cancelledOn}: {date(receipt.cancelledAt)}
            </p>
          ) : null}
        </NoticeBox>
      ) : null}

      <ReportSection title={copy.details}>
        <InfoGrid emptyValue={copy.empty} items={details} />
      </ReportSection>

      <SignatureLines labels={[copy.receiverSignature, copy.officeStamp]} />
      <ClosingLine>{copy.generatedBy}</ClosingLine>
    </ReportLayout>
  );
}

export function buildReceiptPrintHtml(
  receipt: PrintableReceipt,
  locale: ReceiptLocale,
  options: ReceiptDocumentOptions = {},
): string {
  return renderReportHtml(<ReceiptDocument receipt={receipt} locale={locale} options={options} />);
}
