"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, Flag, ListTodo, Zap } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { VDSBadge, VDSCard, VDSIcon, VDSSectionHeader, VDSTimeline, VDSTimelineItem, type VDSTone } from "@/components/ui/vds";
import EmptyState from "./EmptyState";

interface TaskItem {
  id: string;
  title: string;
  dueDate?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

interface UpcomingTasksProps {
  tasks: TaskItem[];
  locale: Locale;
  isRtl: boolean;
  priorityLabels: Record<string, string>;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  emptyTitle: string;
  actionLabel: string;
  overdueLabel: string;
  todayLabel: string;
}

const PRIORITY_CONFIG: Record<TaskItem["priority"], { tone: VDSTone; icon: typeof Circle }> = {
  URGENT: { tone: "purple", icon: Zap },
  HIGH: { tone: "red", icon: Flag },
  MEDIUM: { tone: "gold", icon: Circle },
  LOW: { tone: "emerald", icon: CheckCircle2 },
};

function formatDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function isPastDate(date?: string | null) {
  return !!date && new Date(date).getTime() < Date.now();
}

function isTodayDate(date?: string | null) {
  if (!date) return false;
  const value = new Date(date);
  const today = new Date();
  return value.getFullYear() === today.getFullYear() && value.getMonth() === today.getMonth() && value.getDate() === today.getDate();
}

export default function UpcomingTasks(props: UpcomingTasksProps) {
  const { tasks, locale, isRtl, priorityLabels, title, subtitle, viewAllLabel, emptyTitle, actionLabel, overdueLabel, todayLabel } = props;

  return (
    <VDSCard className="h-fit">
      <VDSSectionHeader
        title={title}
        subtitle={subtitle}
        href="/dashboard/tasks"
        linkLabel={viewAllLabel}
        isRtl={isRtl}
        icon={<ListTodo className="h-4 w-4" />}
        tone="purple"
      />

      {!tasks.length ? (
        <EmptyState icon={<ListTodo className="h-5 w-5" />} title={emptyTitle} href="/dashboard/tasks" actionLabel={actionLabel} />
      ) : (
        <VDSTimeline>
          {tasks.slice(0, 5).map((task, index) => {
            const overdue = isPastDate(task.dueDate) && !isTodayDate(task.dueDate);
            const dueToday = isTodayDate(task.dueDate);
            const config = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM;
            const Icon = overdue ? AlertTriangle : config.icon;
            const tone: VDSTone = overdue ? "red" : config.tone;

            return (
              <VDSTimelineItem key={task.id} isLast={index === Math.min(tasks.length, 5) - 1}>
                <Link href="/dashboard/tasks" className="group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-[20px] border p-3.5 transition duration-200 hover:-translate-y-0.5" style={{ borderColor: overdue ? "rgba(239,68,68,.24)" : "var(--border)", background: overdue ? "rgba(239,68,68,.04)" : "var(--card)" }}>
                  <VDSIcon tone={tone} size="lg"><Icon className="h-5 w-5" /></VDSIcon>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black" style={{ color: "var(--text)" }}>{task.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <VDSBadge tone={tone}>{priorityLabels[task.priority] ?? task.priority}</VDSBadge>
                      {task.dueDate && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: overdue ? "#dc2626" : "var(--text-3)" }}>
                          <CalendarClock className="h-3.5 w-3.5" />
                          {overdue ? overdueLabel : dueToday ? todayLabel : formatDate(task.dueDate, locale)}
                        </span>
                      )}
                    </div>
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
