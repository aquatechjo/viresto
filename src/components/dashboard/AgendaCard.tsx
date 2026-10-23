"use client";

import { Fragment, type ComponentType } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  Flag,
  Gavel,
  ListTodo,
  Phone,
  UserRound,
  Users,
} from "lucide-react";
import { vds, type VDSTone } from "@/components/ui/vds";
import type { Locale } from "@/lib/i18n";
import type { AgendaItem, AgendaKind } from "@/lib/dashboard/types";
import { pluralize } from "@/lib/plural";
import DashboardCard, { CompactEmpty } from "./DashboardCard";
import { AGENDA_KIND_LABELS, PLURALS, type DashboardText } from "./dashboard-text";
import { dayDiff, formatTime, formatWeekday } from "./format";

const KIND_STYLE: Record<AgendaKind, { icon: ComponentType<{ className?: string }>; tone: VDSTone }> = {
  COURT_SESSION: { icon: Gavel, tone: "gold" },
  MEETING: { icon: Users, tone: "blue" },
  PHONE_CALL: { icon: Phone, tone: "cyan" },
  DEADLINE: { icon: Flag, tone: "red" },
  OTHER: { icon: CalendarDays, tone: "slate" },
  TASK: { icon: ListTodo, tone: "purple" },
};

interface AgendaCardProps {
  items: AgendaItem[];
  total: number;
  locale: Locale;
  isRtl: boolean;
  timeZone: string;
  nowIso: string;
  t: DashboardText;
}

export default function AgendaCard({ items, total, locale, isRtl, timeZone, nowIso, t }: AgendaCardProps) {
  const dayLabel = (day: string, at: string) => {
    const diff = dayDiff(at, nowIso, timeZone);
    if (diff === 0) return t.today;
    if (diff === 1) return t.tomorrow;
    return formatWeekday(day, locale, timeZone);
  };

  const hidden = total - items.length;

  return (
    <DashboardCard
      title={t.agenda}
      icon={<CalendarRange className="h-4 w-4" />}
      tone="gold"
      isRtl={isRtl}
      href="/dashboard/appointments"
      linkLabel={t.viewAll}
    >
      {items.length === 0 ? (
        <CompactEmpty
          icon={<CalendarDays className="h-6 w-6" />}
          title={t.agendaEmpty}
          href="/dashboard/appointments"
          actionLabel={t.addAppointmentAction}
        />
      ) : (
        <ol className="min-w-0 space-y-1">
          {items.map((item, index) => {
            const style = KIND_STYLE[item.kind];
            const tone = vds.tone[style.tone];
            const Icon = style.icon;
            const newDay = index === 0 || items[index - 1].day !== item.day;

            return (
              <Fragment key={item.id}>
                {newDay && (
                  <li
                    className={`px-1 text-[11px] font-black ${index === 0 ? "" : "pt-2"}`}
                    style={{ color: "var(--text-3)" }}
                  >
                    <bdi>{dayLabel(item.day, item.at)}</bdi>
                  </li>
                )}
                <li
                  className="flex min-h-[48px] min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-black/[.03] dark:hover:bg-white/[.04]"
                >
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                    style={{ color: tone.fg, background: tone.soft, borderColor: tone.border }}
                    title={AGENDA_KIND_LABELS[locale][item.kind]}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className="w-16 shrink-0 text-xs font-black tabular-nums"
                    style={{ color: "var(--accent-text)" }}
                  >
                    <bdi>{item.hasTime ? formatTime(item.at, locale, timeZone) : t.allDay}</bdi>
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={item.kind === "TASK" ? "/dashboard/tasks" : "/dashboard/appointments"}
                      className="block truncate text-[13px] font-bold hover:underline"
                      style={{ color: "var(--text)" }}
                    >
                      <span className="sr-only">{AGENDA_KIND_LABELS[locale][item.kind]}: </span>
                      <bdi>{item.title}</bdi>
                    </Link>
                    {(item.case || item.client || item.location) && (
                      <div className="flex min-w-0 items-center gap-3 text-[11px]" style={{ color: "var(--text-3)" }}>
                        {item.case && (
                          <Link
                            href={`/dashboard/cases/${item.case.publicId}`}
                            className="inline-flex min-w-0 max-w-[60%] shrink-0 items-center gap-1 hover:underline"
                          >
                            <BriefcaseBusiness className="h-3 w-3 shrink-0" />
                            <bdi className="truncate" dir={item.case.caseNumber ? "ltr" : "auto"}>
                              {item.case.caseNumber ?? item.case.title}
                            </bdi>
                          </Link>
                        )}
                        {item.client && (
                          <Link
                            href={`/dashboard/clients/${item.client.publicId}`}
                            className="inline-flex min-w-0 items-center gap-1 hover:underline"
                          >
                            <UserRound className="h-3 w-3 shrink-0" />
                            <bdi className="truncate">{item.client.name}</bdi>
                          </Link>
                        )}
                        {!item.client && item.location && (
                          <bdi className="truncate md:hidden">{item.location}</bdi>
                        )}
                      </div>
                    )}
                  </div>
                  <span
                    className="hidden max-w-[35%] shrink-0 truncate rounded-lg px-2 py-1 text-[11px] font-semibold md:block"
                    style={{ color: "var(--text-3)", background: "var(--surface-2)" }}
                    title={item.location ?? undefined}
                  >
                    <bdi>{item.location ?? AGENDA_KIND_LABELS[locale][item.kind]}</bdi>
                  </span>
                </li>
              </Fragment>
            );
          })}
          {hidden > 0 && (
            <li className="px-1 pt-1 text-[11px] font-bold" style={{ color: "var(--text-3)" }}>
              <Link href="/dashboard/appointments" className="hover:underline">
                <bdi>{pluralize(locale, hidden, PLURALS.moreItems)}</bdi>
              </Link>
            </li>
          )}
        </ol>
      )}
    </DashboardCard>
  );
}
