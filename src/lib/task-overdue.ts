import { zonedDayStart } from "@/lib/datetime";

// A task's dueDate is a date and time (typed in Amman time). A task is
// overdue when it is still open and its due time is before the start of
// today in Amman: a task due today, at any hour, is not overdue yet. The
// dashboard counts overdue tasks the same way.

export const CLOSED_TASK_STATUSES = ["COMPLETED", "CANCELLED"] as const;

/** For queries: open tasks due before this instant are overdue. */
export function overdueTaskBefore(now: Date = new Date()) {
  return zonedDayStart(now);
}

export function isTaskOverdue(
  task: { status: string; dueDate?: string | Date | null },
  now: Date = new Date(),
) {
  if (!task.dueDate) return false;
  if ((CLOSED_TASK_STATUSES as readonly string[]).includes(task.status)) return false;

  const due = new Date(task.dueDate);
  return !Number.isNaN(due.getTime()) && due < overdueTaskBefore(now);
}
