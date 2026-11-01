"use client";

import type { ComponentType, ReactNode } from "react";
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
import { PageHeader, PageHeaderAction } from "@/components/page";

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
    <PageHeader
      dir={dir}
      eyebrow={<bdi dir={dir}>{dateLabel}</bdi>}
      title={title}
      description={<bdi dir={dir}>{summary}</bdi>}
      actionsLabel={labels.quickActions}
      actions={
        <>
          {actions.map(({ href, label, icon, primary }) => (
            <PageHeaderAction key={href} href={href} label={label} icon={icon} primary={primary} />
          ))}

          <PageHeaderAction
            iconOnly
            label={isRefreshing ? labels.refreshing : labels.refresh}
            onClick={onRefresh}
            disabled={isRefreshing}
            icon={
              refreshStatus === "success"
                ? CheckCircle2
                : refreshStatus === "error"
                  ? TriangleAlert
                  : RefreshCw
            }
            iconClassName={
              refreshStatus === "success"
                ? "text-emerald-300"
                : refreshStatus === "error"
                  ? "text-amber-300"
                  : isRefreshing
                    ? "animate-spin"
                    : ""
            }
          />
          <span aria-live="polite" className="sr-only">
            {refreshStatus === "success" ? labels.refreshSuccess : refreshStatus === "error" ? labels.refreshError : ""}
          </span>
        </>
      }
    />
  );
}
