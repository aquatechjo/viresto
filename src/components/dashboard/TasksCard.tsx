"use client";

import Link from "next/link";
import { CheckCircle2, ListTodo } from "lucide-react";
import { VDSBadge, type VDSTone } from "@/components/ui/vds";
import type { Locale } from "@/lib/i18n";
import type { DashboardTask, TaskPriority } from "@/lib/dashboard/types";
import DashboardCard, { CompactEmpty } from "./DashboardCard";
import { PRIORITY_LABELS, type DashboardText } from "./dashboard-text";
import { dayDiff, formatShortDate } from "./format";

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  URGENT: "#ef4444",
  HIGH: "#f59e0b",
  MEDIUM: "#3b82f6",
  LOW: "#94a3b8",
};

interface TasksCardProps {
  tasks: DashboardTask[];
  locale: Locale;
  isRtl: boolean;
  timeZone: string;
  nowIso: string;
  t: DashboardText;
}

export default function TasksCard({ tasks, locale, isRtl, timeZone, nowIso, t }: TasksCardProps) {
  const due = (iso: string): { label: string; tone: VDSTone } => {
    const diff = dayDiff(iso, nowIso, timeZone);
    if (diff < 0) return { label: t.overdue, tone: "red" };
    if (diff === 0) return { label: t.dueToday, tone: "gold" };
    if (diff === 1) return { label: t.dueTomorrow, tone: "blue" };
    return { label: formatShortDate(iso, locale, timeZone), tone: "slate" };
  };

  return (
    <DashboardCard
      title={t.tasks}
      icon={<ListTodo className="h-4 w-4" />}
      tone="purple"
      isRtl={isRtl}
      href="/dashboard/tasks"
      linkLabel={t.viewAll}
    >
      {tasks.length === 0 ? (
        <CompactEmpty
          icon={<CheckCircle2 className="h-6 w-6" />}
          title={t.tasksEmpty}
          href="/dashboard/tasks"
          actionLabel={t.addTaskAction}
        />
      ) : (
        <ul className="min-w-0 divide-y" style={{ borderColor: "var(--border)" }}>
          {tasks.map((task) => {
            const badge = due(task.dueDate);
            return (
              <li key={task.id} className="flex min-h-[52px] min-w-0 items-center gap-2.5 py-2" style={{ borderColor: "var(--border)" }}>
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: PRIORITY_COLOR[task.priority] }}
                  title={PRIORITY_LABELS[locale][task.priority]}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href="/dashboard/tasks"
                    className="block truncate text-[13px] font-bold hover:underline"
                    style={{ color: "var(--text)" }}
                  >
                    <bdi>{task.title}</bdi>
                  </Link>
                  <p className="truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                    {PRIORITY_LABELS[locale][task.priority]}
                    {task.case && (
                      <>
                        {" · "}
                        <Link href={`/dashboard/cases/${task.case.publicId}`} className="hover:underline">
                          <bdi dir={task.case.caseNumber ? "ltr" : "auto"}>
                            {task.case.caseNumber ?? task.case.title}
                          </bdi>
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <VDSBadge tone={badge.tone} className="shrink-0 whitespace-nowrap">
                  <bdi>{badge.label}</bdi>
                </VDSBadge>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
