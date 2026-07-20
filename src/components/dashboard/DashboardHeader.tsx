"use client";

import Link from "next/link";
import {
  CalendarPlus,
  CheckCircle2,
  FilePlus2,
  FileUp,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { motion } from "framer-motion";
import { SlideUp, Stagger, staggerItem } from "@/components/motion";

type RefreshStatus = "idle" | "success" | "error";

interface DashboardHeaderProps {
  greeting: string;
  greetingName: string;
  summaryText: string;
  canViewFinance: boolean;

  lastUpdatedLabel: string;
  refreshLabel: string;
  refreshingLabel: string;
  refreshSuccessLabel: string;
  refreshErrorLabel: string;
  refreshStatus: RefreshStatus;
  isRefreshing: boolean;
  onRefresh: () => void;

  labels: {
    badge: string;
    quickActions: string;
    addClient: string;
    addCase: string;
    addAppointment: string;
    createInvoice: string;
    uploadDocument: string;
  };
}

export default function DashboardHeader({
  greeting,
  greetingName,
  summaryText,
  canViewFinance,
  lastUpdatedLabel,
  refreshLabel,
  refreshingLabel,
  refreshSuccessLabel,
  refreshErrorLabel,
  refreshStatus,
  isRefreshing,
  onRefresh,
  labels,
}: DashboardHeaderProps) {
  return (
    <SlideUp>
      <section
        className="relative min-w-0 overflow-hidden rounded-[24px] border p-4 sm:p-5"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 58%, var(--sidebar-dark) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 20px 55px rgba(15, 61, 62, 0.20)",
        }}
      >
        <div
          className="absolute -end-16 -top-20 h-48 w-48 rounded-full"
          style={{ background: "rgba(184, 115, 51, 0.17)" }}
        />

        <div
          className="absolute -bottom-24 start-1/4 h-52 w-52 rounded-full"
          style={{ background: "rgba(255, 255, 255, 0.06)" }}
        />

        <div className="relative z-10 space-y-5">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black text-white sm:text-xs"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {labels.badge}
              </div>

              <h1 className="mt-3 text-xl font-black leading-relaxed text-white sm:text-2xl">
                {greeting}
                {greetingName ? `، ${greetingName}` : ""}
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
                {summaryText}
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:max-w-[420px] lg:justify-end">
              <div
                className="flex min-h-10 min-w-0 items-center gap-2 rounded-xl border px-3"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.16)",
                }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />

                <span className="truncate text-[11px] font-bold text-white/75 sm:text-xs">
                  {lastUpdatedLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  borderColor: "rgba(255,255,255,0.20)",
                }}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />

                {isRefreshing ? refreshingLabel : refreshLabel}
              </button>

              <div
                aria-live="polite"
                className="min-h-5 basis-full text-[11px] font-bold lg:text-end"
              >
                {refreshStatus === "success" && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {refreshSuccessLabel}
                  </span>
                )}

                {refreshStatus === "error" && (
                  <span className="inline-flex items-center gap-1.5 text-amber-300">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {refreshErrorLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-xs font-black text-white/70">
              {labels.quickActions}
            </p>

            <Stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              <motion.div variants={staggerItem}>
                <Link
                  href="/dashboard/clients"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                  style={{
                    background: "rgba(255,255,255,0.10)",
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  {labels.addClient}
                </Link>
              </motion.div>

              <motion.div variants={staggerItem}>
                <Link
                  href="/dashboard/cases"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition hover:brightness-105"
                  style={{
                    background: "var(--gold)",
                    color: "#102d2e",
                  }}
                >
                  <FilePlus2 className="h-4 w-4" />
                  {labels.addCase}
                </Link>
              </motion.div>

              <motion.div variants={staggerItem}>
                <Link
                  href="/dashboard/appointments"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                  style={{
                    background: "rgba(255,255,255,0.10)",
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  <CalendarPlus className="h-4 w-4" />
                  {labels.addAppointment}
                </Link>
              </motion.div>

              <motion.div variants={staggerItem}>
                <Link
                  href="/dashboard/documents"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                  style={{
                    background: "rgba(255,255,255,0.10)",
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  <FileUp className="h-4 w-4" />
                  {labels.uploadDocument}
                </Link>
              </motion.div>

              {canViewFinance && (
                <motion.div variants={staggerItem}>
                  <Link
                    href="/dashboard/invoices"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                    style={{
                      background: "rgba(255,255,255,0.10)",
                      borderColor: "rgba(255,255,255,0.18)",
                    }}
                  >
                    <ReceiptText className="h-4 w-4" />
                    {labels.createInvoice}
                  </Link>
                </motion.div>
              )}
            </Stagger>
          </div>
        </div>
      </section>
    </SlideUp>
  );
}