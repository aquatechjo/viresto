"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  Presentation,
} from "lucide-react";
import { vds, type VDSTone } from "@/components/ui/vds";
import type { Locale } from "@/lib/i18n";
import type { DashboardDocument } from "@/lib/dashboard/types";
import { fileKind, fileTypeLabel, type FileKind } from "@/lib/file-type";
import DashboardCard, { CompactEmpty } from "./DashboardCard";
import type { DashboardText } from "./dashboard-text";
import { formatShortDate } from "./format";

const KIND_STYLE: Record<FileKind, { icon: ComponentType<{ className?: string }>; tone: VDSTone }> = {
  pdf: { icon: FileText, tone: "red" },
  word: { icon: FileText, tone: "blue" },
  excel: { icon: FileSpreadsheet, tone: "emerald" },
  powerpoint: { icon: Presentation, tone: "gold" },
  image: { icon: FileImage, tone: "purple" },
  text: { icon: FileText, tone: "slate" },
  archive: { icon: FileArchive, tone: "slate" },
  audio: { icon: FileAudio, tone: "cyan" },
  video: { icon: FileVideo, tone: "cyan" },
  other: { icon: File, tone: "slate" },
};

interface RecentDocumentsCardProps {
  documents: DashboardDocument[];
  locale: Locale;
  isRtl: boolean;
  timeZone: string;
  t: DashboardText;
}

export default function RecentDocumentsCard({ documents, locale, isRtl, timeZone, t }: RecentDocumentsCardProps) {
  return (
    <DashboardCard
      title={t.recentDocuments}
      icon={<FolderOpen className="h-4 w-4" />}
      tone="cyan"
      isRtl={isRtl}
      href="/dashboard/documents"
      linkLabel={t.viewAll}
    >
      {documents.length === 0 ? (
        <CompactEmpty
          icon={<FolderOpen className="h-6 w-6" />}
          title={t.documentsEmpty}
          href="/dashboard/documents"
          actionLabel={t.uploadAction}
        />
      ) : (
        <ul className="min-w-0 divide-y" style={{ borderColor: "var(--border)" }}>
          {documents.map((doc) => {
            const kind = fileKind(doc.fileType, doc.fileName);
            const style = KIND_STYLE[kind];
            const tone = vds.tone[style.tone];
            const Icon = style.icon;

            return (
              <li key={doc.id} className="flex min-h-[56px] min-w-0 items-center gap-3 py-2" style={{ borderColor: "var(--border)" }}>
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                  style={{ color: tone.fg, background: tone.soft, borderColor: tone.border }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href="/dashboard/documents"
                    className="block truncate text-[13px] font-bold hover:underline"
                    style={{ color: "var(--text)" }}
                    title={doc.fileName}
                  >
                    <bdi dir="auto">{doc.fileName}</bdi>
                  </Link>
                  <p className="flex min-w-0 items-center gap-1.5 text-[11px]" style={{ color: "var(--text-3)" }}>
                    <span className="shrink-0 font-black" style={{ color: "var(--text-2)" }}>
                      {fileTypeLabel(doc.fileType, doc.fileName, locale)}
                    </span>
                    <span aria-hidden="true">·</span>
                    {doc.case ? (
                      <Link href={`/dashboard/cases/${doc.case.publicId}`} className="min-w-0 truncate hover:underline">
                        <bdi dir={doc.case.caseNumber ? "ltr" : "auto"}>{doc.case.caseNumber ?? doc.case.title}</bdi>
                      </Link>
                    ) : (
                      <span className="truncate">{t.noCase}</span>
                    )}
                  </p>
                </div>
                <time
                  dateTime={doc.createdAt}
                  className="shrink-0 text-[11px] font-semibold"
                  style={{ color: "var(--text-3)" }}
                >
                  <bdi>{formatShortDate(doc.createdAt, locale, timeZone)}</bdi>
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
