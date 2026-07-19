"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { Stagger, staggerItem } from "@/components/motion";
import EmptyState from "./EmptyState";
import SectionHeader from "./SectionHeader";

interface AppointmentItem {
  id: string;
  title: string;
  startTime: string;
  location?: string | null;
  type: string;
  client?: { name: string } | null;
  case?: { title: string } | null;
}

interface TodayAppointmentsProps {
  appointments: AppointmentItem[];
  locale: Locale;
  isRtl: boolean;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  emptyTitle: string;
  actionLabel: string;
}

const TENANT_TIME_ZONE = "Asia/Amman";
const TYPE_COLOR: Record<string, string> = {
  COURT_SESSION: "var(--sidebar)",
  MEETING: "#2563eb",
  PHONE_CALL: "var(--gold)",
  DEADLINE: "#dc2626",
  OTHER: "var(--text-3)",
};

function formatAppointmentTime(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-US", {
    timeZone: TENANT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export default function TodayAppointments(props: TodayAppointmentsProps) {
  const { appointments, locale, isRtl, title, subtitle, viewAllLabel, emptyTitle, actionLabel } = props;
  return (
    <div className="card h-fit min-w-0 p-4 sm:p-5">
      <SectionHeader title={title} subtitle={subtitle} href="/dashboard/appointments" linkLabel={viewAllLabel} isRtl={isRtl} />
      {!appointments.length ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={emptyTitle} href="/dashboard/appointments" actionLabel={actionLabel} />
      ) : (
        <Stagger className="space-y-3" stagger={0.045}>
          {appointments.slice(0, 5).map((appointment) => (
            <motion.div key={appointment.id} variants={staggerItem} className="min-w-0">
              <Link href="/dashboard/appointments" className="group flex min-w-0 gap-3 rounded-2xl border p-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" style={{ borderColor: "var(--border)" }}>
              <div className="w-1 shrink-0 self-stretch rounded-full" style={{ background: TYPE_COLOR[appointment.type] ?? "var(--text-3)", minHeight: 52 }} />
              <div className="flex h-11 min-w-[68px] shrink-0 items-center justify-center rounded-xl px-2 text-sm font-black" style={{ background: "var(--green-soft)", color: "var(--sidebar)" }}>
                {formatAppointmentTime(appointment.startTime, locale)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black" style={{ color: "var(--text)" }}>{appointment.title}</p>
                <p className="mt-1 truncate text-xs" style={{ color: "var(--text-3)" }}>{appointment.client?.name ?? appointment.case?.title ?? appointment.location ?? "—"}</p>
              </div>
              {isRtl ? <ArrowLeft className="mt-1 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" /> : <ArrowRight className="mt-1 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />}
              </Link>
            </motion.div>
          ))}
        </Stagger>
      )}
    </div>
  );
}
