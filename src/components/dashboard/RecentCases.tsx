"use client";

import { BriefcaseBusiness, UserRound } from "lucide-react";
import { VDSCard, VDSResourceCard } from "@/components/ui/vds";
import EmptyState from "./EmptyState";
import SectionHeader from "./SectionHeader";

interface CaseItem { id: string; publicId?: number; title: string; caseNumber?: string | null; status: string; client?: { name: string } | null; }
interface RecentCasesProps {
  cases: CaseItem[]; isRtl: boolean; statusLabels: Record<string, string>;
  statusBadgeClasses: Record<string, string>; defaultStatusBadgeClass: string;
  labels: { title: string; subtitle: string; viewAll: string; empty: string; addCase: string; noClient: string; };
}

export default function RecentCases({ cases, isRtl, statusLabels, statusBadgeClasses, defaultStatusBadgeClass, labels }: RecentCasesProps) {
  return (
    <VDSCard>
      <SectionHeader title={labels.title} subtitle={labels.subtitle} href="/dashboard/cases" linkLabel={labels.viewAll} isRtl={isRtl} />
      {cases.length === 0 ? (
        <EmptyState icon={<BriefcaseBusiness className="h-5 w-5" />} title={labels.empty} href="/dashboard/cases" actionLabel={labels.addCase} />
      ) : (
        <div className="stagger grid min-w-0 gap-3 md:grid-cols-2">
          {cases.map((caseItem) => (
            <div key={caseItem.id}>
              <VDSResourceCard
                href={`/dashboard/cases/${caseItem.publicId ?? caseItem.id}`}
                title={caseItem.title}
                subtitle={caseItem.client?.name ?? labels.noClient}
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                tone="teal"
                isRtl={isRtl}
                badge={<span className={statusBadgeClasses[caseItem.status] ?? defaultStatusBadgeClass}>{statusLabels[caseItem.status] ?? caseItem.status}</span>}
                meta={<div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-3)" }}><UserRound className="h-3.5 w-3.5" /><span className="font-mono">#{caseItem.caseNumber?.split("/").pop() ?? caseItem.id.slice(-4)}</span></div>}
              />
            </div>
          ))}
        </div>
      )}
    </VDSCard>
  );
}
