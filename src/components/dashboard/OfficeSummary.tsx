"use client";

import { motion } from "framer-motion";
import { BriefcaseBusiness, CheckCircle2, CircleDollarSign, Users } from "lucide-react";
import { AnimatedCounter, Stagger, staggerItem } from "@/components/motion";
import { VDSBadge, VDSCard, VDSProgressRing, VDSStat } from "@/components/ui/vds";
import SectionHeader from "./SectionHeader";

interface OfficeSummaryProps {
  isRtl: boolean;
  canViewFinance: boolean;
  clientCount: number;
  newClientsThisMonth: number;
  totalCasesCount: number;
  resolvedCasesCount: number;
  resolvedCaseRate: number;
  monthlyRevenue: string;
  totalRevenue: string;
  labels: {
    title: string; subtitle: string; clients: string; thisMonth: string;
    totalCases: string; resolvedCases: string; monthlyRevenue: string; totalRevenue: string;
  };
}

export default function OfficeSummary(props: OfficeSummaryProps) {
  const { isRtl, canViewFinance, clientCount, newClientsThisMonth, totalCasesCount, resolvedCasesCount, resolvedCaseRate, monthlyRevenue, totalRevenue, labels } = props;

  return (
    <VDSCard>
      <SectionHeader title={labels.title} subtitle={labels.subtitle} isRtl={isRtl} />

      <div className="mb-3 flex items-center justify-between gap-4 rounded-[20px] border p-3.5" style={{ borderColor: "var(--border)", background: "var(--green-soft)" }}>
        <div className="min-w-0">
          <p className="text-xs font-bold" style={{ color: "var(--text-3)" }}>{labels.resolvedCases}</p>
          <p className="mt-1 text-xl font-black" style={{ color: "var(--text)" }}>
            <AnimatedCounter value={resolvedCasesCount} /> / <AnimatedCounter value={totalCasesCount} />
          </p>
          <VDSBadge tone="emerald" className="mt-2">{Math.round(resolvedCaseRate)}%</VDSBadge>
        </div>
        <VDSProgressRing value={resolvedCaseRate} tone="emerald" />
      </div>

      <Stagger className="grid grid-cols-2 gap-3" stagger={0.05}>
        <motion.div variants={staggerItem}>
          <VDSStat label={labels.clients} value={clientCount} icon={<Users className="h-4 w-4" />} tone="blue" meta={<span style={{ color: "var(--text-3)" }}>+<AnimatedCounter value={newClientsThisMonth} /> {labels.thisMonth}</span>} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <VDSStat label={labels.totalCases} value={totalCasesCount} icon={<BriefcaseBusiness className="h-4 w-4" />} tone="teal" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <VDSStat label={labels.resolvedCases} value={resolvedCasesCount} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" meta={<span style={{ color: "var(--text-3)" }}>{Math.round(resolvedCaseRate)}%</span>} />
        </motion.div>
        {canViewFinance ? (
          <motion.div variants={staggerItem}>
            <VDSStat label={labels.monthlyRevenue} value={monthlyRevenue} icon={<CircleDollarSign className="h-4 w-4" />} tone="gold" />
          </motion.div>
        ) : null}
      </Stagger>

      {canViewFinance ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[20px] border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: "var(--text-3)" }}>{labels.totalRevenue}</p>
            <p className="mt-1 truncate text-lg font-black" style={{ color: "var(--sidebar)" }}>{totalRevenue}</p>
          </div>
          <CircleDollarSign className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-300" />
        </div>
      ) : null}
    </VDSCard>
  );
}
