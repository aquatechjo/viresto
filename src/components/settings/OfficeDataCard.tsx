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
    title: "تصدير البيانات وحذف المكتب",
    description:
      "نزّل نسخة كاملة من بيانات المكتب بصيغة JSON: الموكلون والقضايا والمواعيد والمهام والفواتير والدفعات وبيانات المستندات وسجل النشاط والفريق والاشتراك. ملفات المستندات نفسها تُنزَّل من القائمة أدناه.",
    exportButton: "تنزيل بيانات المكتب",
    exporting: "جارٍ التجهيز...",
    exportFailed: "تعذر تنزيل بيانات المكتب",
    exportDone: "تم تنزيل بيانات المكتب",
    filesTitle: "ملفات المستندات",
    filesButton: "عرض ملفات المستندات",
    filesLoading: "جارٍ التحميل...",
    filesMore: "عرض المزيد",
    filesEmpty: "لا توجد مستندات في المكتب.",
    filesFailed: "تعذر تحميل قائمة المستندات",
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
    title: "Data export and office deletion",
    description:
      "Download a complete copy of the office data as JSON: clients, cases, appointments, tasks, invoices, payments, document details, the activity log, the team and the subscription. Download the document files themselves from the list below.",
    exportButton: "Download office data",
    exporting: "Preparing...",
    exportFailed: "Could not download the office data",
    exportDone: "Office data downloaded",
    filesTitle: "Document files",
    filesButton: "Show document files",
    filesLoading: "Loading...",
    filesMore: "Show more",
    filesEmpty: "The office has no documents.",
    filesFailed: "Could not load the document list",
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

type ExportDocument = { id: string; fileName: string; fileSize: number | null };

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [files, setFiles] = useState<ExportDocument[] | null>(null);
  const [filesCursor, setFilesCursor] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  async function loadFiles(cursor: string | null) {
    setLoadingFiles(true);
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await fetch(`/api/data-requests/documents${query}`, { cache: "no-store" });
      if (!response.ok) {
        toast.error(await messageFrom(response, copy.filesFailed));
        return;
      }
      const data = (await response.json())?.data;
      setFiles((current) => [...(cursor ? current ?? [] : []), ...(data?.documents ?? [])]);
      setFilesCursor(data?.nextCursor ?? null);
    } catch {
      toast.error(copy.filesFailed);
    } finally {
      setLoadingFiles(false);
    }
  }

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

      <div className="mt-5">
        <h3 className="text-sm font-black" style={{ color: "var(--text)" }}>
          {copy.filesTitle}
        </h3>
        {files === null ? (
          <button
            type="button"
            onClick={() => loadFiles(null)}
            disabled={loadingFiles}
            className="btn btn-ghost mt-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingFiles ? copy.filesLoading : copy.filesButton}
          </button>
        ) : files.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--text-3)" }}>
            {copy.filesEmpty}
          </p>
        ) : (
          <>
            <ul
              className="mt-2 max-h-72 divide-y overflow-y-auto rounded-2xl border"
              style={{ borderColor: "var(--border)" }}
            >
              {files.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <a
                    href={`/api/data-requests/documents/${encodeURIComponent(file.id)}`}
                    download
                    dir="auto"
                    className="min-w-0 truncate font-bold underline-offset-2 hover:underline"
                    style={{ color: "var(--text)" }}
                  >
                    {file.fileName}
                  </a>
                  <span dir="ltr" className="shrink-0 text-xs" style={{ color: "var(--text-3)" }}>
                    {formatSize(file.fileSize)}
                  </span>
                </li>
              ))}
            </ul>
            {filesCursor ? (
              <button
                type="button"
                onClick={() => loadFiles(filesCursor)}
                disabled={loadingFiles}
                className="btn btn-ghost mt-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingFiles ? copy.filesLoading : copy.filesMore}
              </button>
            ) : null}
          </>
        )}
      </div>

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
