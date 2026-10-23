"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  CheckCircle2,
  FilePlus2,
  FileUp,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
  UserPlus,
} from "lucide-react";

type RefreshStatus = "idle" | "success" | "error";

interface DashboardHeaderProps {
  title: ReactNode;
  dir: "rtl" | "ltr";
  dateLabel: string;
  summary: string;
  canViewFinance: boolean;
  isRefreshing: boolean;
  refreshStatus: RefreshStatus;
  onRefresh: () => void;
  labels: {
    quickActions: string;
    addClient: string;
    addCase: string;
    addAppointment: string;
    createInvoice: string;
    uploadDocument: string;
    refresh: string;
    refreshing: string;
    refreshSuccess: string;
    refreshError: string;
  };
}

type QuickAction = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  primary?: boolean;
};

export default function DashboardHeader({
  title,
  dir,
  dateLabel,
  summary,
  canViewFinance,
  isRefreshing,
  refreshStatus,
  onRefresh,
  labels,
}: DashboardHeaderProps) {
  const actions: QuickAction[] = [
    { href: "/dashboard/cases", label: labels.addCase, icon: FilePlus2, primary: true },
    { href: "/dashboard/clients", label: labels.addClient, icon: UserPlus },
    { href: "/dashboard/appointments", label: labels.addAppointment, icon: CalendarPlus },
    { href: "/dashboard/documents", label: labels.uploadDocument, icon: FileUp },
    ...(canViewFinance
      ? [{ href: "/dashboard/finance/invoices", label: labels.createInvoice, icon: ReceiptText }]
      : []),
  ];

  return (
    <section
      className="relative min-w-0 overflow-hidden rounded-[24px] border px-4 py-4 sm:px-5"
      style={{
        background:
          "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 58%, var(--sidebar-dark) 100%)",
        borderColor: "rgba(255,255,255,0.12)",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute -end-16 -top-24 h-48 w-48 rounded-full"
        style={{ background: "rgba(184, 115, 51, 0.17)" }}
      />

      <div className="relative flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-white/60 sm:text-xs">
            <bdi dir={dir}>{dateLabel}</bdi>
          </p>
          <h1 className="mt-1 truncate text-lg font-black text-white sm:text-xl">
            {title}
          </h1>
          <p className="mt-1 text-xs font-semibold leading-6 text-white/75 sm:text-sm">
            <bdi dir={dir}>{summary}</bdi>
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:justify-end" aria-label={labels.quickActions}>
          {actions.map(({ href, label, icon: Icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition ${
                primary ? "hover:brightness-110" : "border text-white hover:bg-white/15"
              }`}
              style={
                primary
                  ? { background: "var(--gold)", color: "#102d2e" }
                  : { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.16)" }
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title={isRefreshing ? labels.refreshing : labels.refresh}
            aria-label={isRefreshing ? labels.refreshing : labels.refresh}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.16)" }}
          >
            {refreshStatus === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : refreshStatus === "error" ? (
              <TriangleAlert className="h-4 w-4 text-amber-300" />
            ) : (
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            )}
          </button>
          <span aria-live="polite" className="sr-only">
            {refreshStatus === "success" ? labels.refreshSuccess : refreshStatus === "error" ? labels.refreshError : ""}
          </span>
        </div>
      </div>
    </section>
  );
}
