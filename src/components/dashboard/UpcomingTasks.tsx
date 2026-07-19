"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ListTodo } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { Stagger, staggerItem } from "@/components/motion";
import EmptyState from "./EmptyState";
import SectionHeader from "./SectionHeader";

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

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  HIGH: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  MEDIUM: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  LOW: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

function formatDate(date: string, locale: Locale) {
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-JO" : "en-US");
}
function isPastDate(date?: string | null) { return !!date && new Date(date).getTime() < Date.now(); }
function isTodayDate(date?: string | null) {
  if (!date) return false;
  const value = new Date(date); const today = new Date();
  return value.getFullYear() === today.getFullYear() && value.getMonth() === today.getMonth() && value.getDate() === today.getDate();
}

export default function UpcomingTasks(props: UpcomingTasksProps) {
  const { tasks, locale, isRtl, priorityLabels, title, subtitle, viewAllLabel, emptyTitle, actionLabel, overdueLabel, todayLabel } = props;
  return (
    <div className="card h-fit min-w-0 p-4 sm:p-5">
      <SectionHeader title={title} subtitle={subtitle} href="/dashboard/tasks" linkLabel={viewAllLabel} isRtl={isRtl} />
      {!tasks.length ? (
        <EmptyState icon={<ListTodo className="h-5 w-5" />} title={emptyTitle} href="/dashboard/tasks" actionLabel={actionLabel} />
      ) : (
        <Stagger className="space-y-3" stagger={0.045}>
          {tasks.slice(0, 5).map((task) => {
            const overdue = isPastDate(task.dueDate) && !isTodayDate(task.dueDate);
            const dueToday = isTodayDate(task.dueDate);
            return (
              <motion.div key={task.id} variants={staggerItem} className="min-w-0">
                <Link href="/dashboard/tasks" className="group flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" style={{ borderColor: "var(--border)" }}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overdue ? "bg-red-500/15 text-red-600 dark:text-red-300" : "bg-teal-500/15 text-teal-700 dark:bg-teal-300/10 dark:text-teal-200"}`}>
                  {overdue ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black" style={{ color: "var(--text)" }}>{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.MEDIUM}`}>{priorityLabels[task.priority] ?? task.priority}</span>
                    {task.dueDate && <span className="text-[11px]" style={{ color: overdue ? "#dc2626" : "var(--text-3)" }}>{overdue ? overdueLabel : dueToday ? todayLabel : formatDate(task.dueDate, locale)}</span>}
                  </div>
                </div>
                {isRtl ? <ArrowLeft className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" /> : <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />}
                </Link>
              </motion.div>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
