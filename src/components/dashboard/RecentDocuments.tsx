"use client";

import type { ReactNode } from "react";
import { FolderOpen, Tag } from "lucide-react";
import { VDSBadge, VDSCard, VDSResourceCard } from "@/components/ui/vds";
import EmptyState from "./EmptyState";
import SectionHeader from "./SectionHeader";

interface DocumentItem { id: string; fileName: string; fileType?: string | null; createdAt: string; tags?: string[]; }
interface RecentDocumentsProps {
  documents: DocumentItem[]; isRtl: boolean; formatDate: (value: string) => string;
  getDocumentIcon: (fileType?: string | null) => ReactNode;
  labels: { title: string; subtitle: string; viewAll: string; empty: string; };
}

export default function RecentDocuments({ documents, isRtl, formatDate, getDocumentIcon, labels }: RecentDocumentsProps) {
  return (
    <VDSCard>
      <SectionHeader title={labels.title} subtitle={labels.subtitle} href="/dashboard/documents" linkLabel={labels.viewAll} isRtl={isRtl} />
      {documents.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-5 w-5" />} title={labels.empty} href="/dashboard/documents" actionLabel={labels.viewAll} />
      ) : (
        <div className="stagger space-y-3">
          {documents.map((doc) => (
            <div key={doc.id}>
              <VDSResourceCard
                href="/dashboard/documents"
                title={doc.fileName}
                subtitle={formatDate(doc.createdAt)}
                icon={getDocumentIcon(doc.fileType)}
                tone="cyan"
                isRtl={isRtl}
                badge={doc.fileType ? <VDSBadge tone="cyan">{doc.fileType.toUpperCase()}</VDSBadge> : undefined}
                meta={doc.tags?.length ? <div className="flex min-w-0 items-center gap-1.5"><Tag className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-3)" }} /><span className="truncate text-[10px]" style={{ color: "var(--text-3)" }}>{doc.tags.slice(0, 3).join(" · ")}</span></div> : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </VDSCard>
  );
}
