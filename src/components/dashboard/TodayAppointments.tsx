"use client";

import Link from "next/link";
import { CalendarDays, Gavel, MapPin, MessageSquare, Phone, Users } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { VDSCard, VDSIcon, VDSSectionHeader, VDSTimeline, VDSTimelineItem, type VDSTone } from "@/components/ui/vds";
import EmptyState from "./EmptyState";

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
const TYPE_CONFIG: Record<string, { tone: VDSTone; icon: typeof CalendarDays }> = {
  COURT_SESSION: { tone: "teal", icon: Gavel },
  MEETING: { tone: "blue", icon: Users },
  PHONE_CALL: { tone: "gold", icon: Phone },
  DEADLINE: { tone: "red", icon: CalendarDays },
  OTHER: { tone: "slate", icon: MessageSquare },
};

function formatAppointmentTime(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-US", {
    timeZone: TENANT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export default function TodayAppointments(props: TodayAppointmentsProps) {
  const { appointments, locale, isRtl, title, subtitle, viewAllLabel, emptyTitle, actionLabel } = props;

  return (
    <VDSCard className="h-fit">
      <VDSSectionHeader
        title={title}
        subtitle={subtitle}
        href="/dashboard/appointments"
        linkLabel={viewAllLabel}
        isRtl={isRtl}
        icon={<CalendarDays className="h-4 w-4" />}
        tone="blue"
      />

      {!appointments.length ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={emptyTitle} href="/dashboard/appointments" actionLabel={actionLabel} />
      ) : (
        <VDSTimeline>
          {appointments.slice(0, 5).map((appointment, index) => {
            const config = TYPE_CONFIG[appointment.type] ?? TYPE_CONFIG.OTHER;
            const Icon = config.icon;
            const detail = appointment.client?.name ?? appointment.case?.title ?? appointment.location ?? "—";

            return (
              <VDSTimelineItem key={appointment.id} isLast={index === Math.min(appointments.length, 5) - 1}>
                <Link href="/dashboard/appointments" className="group flex min-w-0 items-center gap-3 rounded-[20px] border p-3.5 transition duration-200 hover:-translate-y-0.5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <VDSIcon tone={config.tone} size="lg"><Icon className="h-5 w-5" /></VDSIcon>
                  <div className="min-w-[82px] shrink-0 rounded-2xl border px-3 py-2 text-center" style={{ borderColor: "var(--border)", background: "var(--green-soft)" }}>
                    <time className="text-sm font-black" style={{ color: "var(--sidebar)" }}>{formatAppointmentTime(appointment.startTime, locale)}</time>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black" style={{ color: "var(--text)" }}>{appointment.title}</p>
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--text-3)" }}>{detail}</p>
                    {appointment.location && detail !== appointment.location && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text-3)" }}><MapPin className="h-3.5 w-3.5" />{appointment.location}</p>
                    )}
                  </div>
                </Link>
              </VDSTimelineItem>
            );
          })}
        </VDSTimeline>
      )}
    </VDSCard>
  );
}
