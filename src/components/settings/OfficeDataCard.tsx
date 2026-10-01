"use client";

import { useState } from "react";
import { toast } from "sonner";
import { VDSCard } from "@/components/ui/vds";

// Office ADMIN only (AUDIT_REPORT.md M4): download all office data and ask
// for the office to be deleted. Both routes stay reachable while the office
// is locked, like this settings page.

type Locale = "ar" | "en";

const COPY = {
  ar: {
    title: "بيانات المكتب",
    description:
      "نزّل نسخة كاملة من بيانات المكتب بصيغة JSON: الموكلون والقضايا والمواعيد والمهام والفواتير والدفعات وبيانات المستندات وسجل النشاط والفريق والاشتراك. ملفات المستندات نفسها لا تدخل في هذا الملف؛ اطلبها من الدعم إن احتجتها.",
    exportButton: "تنزيل بيانات المكتب",
    exporting: "جارٍ التجهيز...",
    exportFailed: "تعذر تنزيل بيانات المكتب",
    exportDone: "تم تنزيل بيانات المكتب",
    deletionTitle: "طلب حذف المكتب",
    deletionDescription:
      "يُرسل الطلب إلى إدارة Viresto، ولا يُحذف شيء فورًا. سنتواصل معك عبر البريد قبل الحذف. الحذف نهائي ويشمل كل بيانات المكتب وحسابات فريقه، فنزّل نسخة من البيانات أولًا.",
    reasonLabel: "السبب (اختياري)",
    confirmLabel: "أفهم أن حذف المكتب نهائي ولا يمكن التراجع عنه.",
    deletionButton: "إرسال طلب الحذف",
    sending: "جارٍ الإرسال...",
    deletionSent: "تم إرسال طلب حذف المكتب. سنتواصل معك عبر البريد.",
    deletionAlready: "طلب حذف المكتب مُرسل بالفعل خلال آخر 24 ساعة.",
    deletionFailed: "تعذر إرسال طلب الحذف",
  },
  en: {
    title: "Office data",
    description:
      "Download a complete copy of the office data as JSON: clients, cases, appointments, tasks, invoices, payments, document details, the activity log, the team and the subscription. The document files themselves are not in this file; ask support if you need them.",
    exportButton: "Download office data",
    exporting: "Preparing...",
    exportFailed: "Could not download the office data",
    exportDone: "Office data downloaded",
    deletionTitle: "Request office deletion",
    deletionDescription:
      "The request goes to the Viresto team; nothing is deleted right away. We will contact you by email before deleting. Deletion is permanent and covers all office data and team accounts, so download a copy first.",
    reasonLabel: "Reason (optional)",
    confirmLabel: "I understand that deleting the office is permanent and cannot be undone.",
    deletionButton: "Send deletion request",
    sending: "Sending...",
    deletionSent: "Deletion request sent. We will contact you by email.",
    deletionAlready: "A deletion request was already sent in the last 24 hours.",
    deletionFailed: "Could not send the deletion request",
  },
} as const;

function filenameFrom(response: Response) {
  const header = response.headers.get("content-disposition") ?? "";
  return /filename="([^"]+)"/.exec(header)?.[1] ?? "viresto-export.json";
}

async function messageFrom(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.message === "string" ? data.message : fallback;
}

export default function OfficeDataCard({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const [exporting, setExporting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  async function downloadExport() {
    setExporting(true);
    try {
      const response = await fetch("/api/data-requests/export", { cache: "no-store" });
      if (!response.ok) {
        toast.error(await messageFrom(response, copy.exportFailed));
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(response);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(copy.exportDone);
    } catch {
      toast.error(copy.exportFailed);
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    setSending(true);
    try {
      const response = await fetch("/api/data-requests/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (!response.ok) {
        toast.error(await messageFrom(response, copy.deletionFailed));
        return;
      }

      const data = await response.json().catch(() => null);
      const message = data?.data?.alreadyRequested ? copy.deletionAlready : copy.deletionSent;
      setSentMessage(message);
      toast.success(message);
    } catch {
      toast.error(copy.deletionFailed);
    } finally {
      setSending(false);
    }
  }

  return (
    <VDSCard padded={false} className="p-5">
      <h2 className="font-black" style={{ color: "var(--text)" }}>
        {copy.title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-7" style={{ color: "var(--text-3)" }}>
        {copy.description}
      </p>
      <button
        type="button"
        onClick={downloadExport}
        disabled={exporting}
        className="btn btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {exporting ? copy.exporting : copy.exportButton}
      </button>

      <div
        className="mt-6 rounded-2xl border p-4"
        style={{ borderColor: "var(--danger)", background: "var(--red-soft)" }}
      >
        <h3 className="font-black" style={{ color: "var(--danger)" }}>
          {copy.deletionTitle}
        </h3>
        <p className="mt-1 text-sm leading-7" style={{ color: "var(--text-2)" }}>
          {copy.deletionDescription}
        </p>

        {sentMessage ? (
          <p className="mt-3 text-sm font-bold" style={{ color: "var(--text)" }}>
            {sentMessage}
          </p>
        ) : (
          <>
            <label className="mt-3 block text-sm font-bold" style={{ color: "var(--text-2)" }}>
              {copy.reasonLabel}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                rows={2}
                className="input mt-1 w-full"
              />
            </label>
            <label
              className="mt-3 flex cursor-pointer items-start gap-3 text-sm font-semibold leading-7"
              style={{ color: "var(--text-2)" }}
            >
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0"
              />
              <span>{copy.confirmLabel}</span>
            </label>
            <button
              type="button"
              onClick={requestDeletion}
              disabled={!confirmed || sending}
              className="btn btn-danger mt-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? copy.sending : copy.deletionButton}
            </button>
          </>
        )}
      </div>
    </VDSCard>
  );
}
