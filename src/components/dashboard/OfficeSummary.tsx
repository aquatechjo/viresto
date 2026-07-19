"use client";

import { motion } from "framer-motion";
import { BriefcaseBusiness, CheckCircle2, CircleDollarSign, Users } from "lucide-react";
import { AnimatedCounter, Stagger, staggerItem } from "@/components/motion";
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
    <div className="card min-w-0 p-4 sm:p-5">
      <SectionHeader title={labels.title} subtitle={labels.subtitle} isRtl={isRtl} />
      <Stagger className="grid grid-cols-2 gap-3" stagger={0.05}>
        <motion.div variants={staggerItem} className="rounded-2xl border p-3.5" style={{ borderColor: "var(--border)" }}>
          <Users className="h-4 w-4 text-teal-700 dark:text-teal-200" />
          <p className="mt-3 text-xs font-bold" style={{ color: "var(--text-3)" }}>{labels.clients}</p>
          <p className="mt-1 text-xl font-black" style={{ color: "var(--text)" }}><AnimatedCounter value={clientCount} /></p>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-3)" }}>+<AnimatedCounter value={newClientsThisMonth} /> {labels.thisMonth}</p>
        </motion.div>
        <motion.div variants={staggerItem} className="rounded-2xl border p-3.5" style={{ borderColor: "var(--border)" }}>
          <BriefcaseBusiness className="h-4 w-4 text-teal-700 dark:text-teal-200" />
          <p className="mt-3 text-xs font-bold" style={{ color: "var(--text-3)" }}>{labels.totalCases}</p>
          <p className="mt-1 text-xl font-black" style={{ color: "var(--text)" }}><AnimatedCounter value={totalCasesCount} /></p>
        </motion.div>
        <motion.div variants={staggerItem} className="rounded-2xl border p-3.5" style={{ borderColor: "var(--border)" }}>
          <CheckCircle2 className="h-4 w-4 text-teal-700 dark:text-teal-200" />
          <p className="mt-3 text-xs font-bold" style={{ color: "var(--text-3)" }}>{labels.resolvedCases}</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="text-xl font-black" style={{ color: "var(--text)" }}><AnimatedCounter value={resolvedCasesCount} /></p>
            <span className="text-[10px] font-bold" style={{ color: "var(--text-3)" }}><AnimatedCounter value={resolvedCaseRate} />%</span>
          </div>
        </motion.div>
        {canViewFinance && (
          <motion.div variants={staggerItem} className="rounded-2xl border p-3.5" style={{ borderColor: "var(--border)" }}>
            <CircleDollarSign className="h-4 w-4 text-teal-700 dark:text-teal-200" />
            <p className="mt-3 text-xs font-bold" style={{ color: "var(--text-3)" }}>{labels.monthlyRevenue}</p>
            <p className="mt-1 truncate text-base font-black" style={{ color: "var(--sidebar)" }}>{monthlyRevenue}</p>
          </motion.div>
        )}
      </Stagger>
      {canViewFinance && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--green-soft)" }}>
          <div><p className="text-xs font-bold" style={{ color: "var(--text-3)" }}>{labels.totalRevenue}</p><p className="mt-1 text-lg font-black" style={{ color: "var(--sidebar)" }}>{totalRevenue}</p></div>
          <CircleDollarSign className="h-6 w-6 text-teal-700 dark:text-teal-200" />
        </div>
      )}
    </div>
  );
}
