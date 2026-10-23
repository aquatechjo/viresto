// Pure helpers behind the dashboard loader: no database, no clock of
// their own, so they are unit-tested directly.

import { DateTime } from "luxon";
import type {
  AgendaItem,
  AgendaKind,
  AgingBuckets,
  CaseRef,
  ClientRef,
  CourtLevel,
  MonthTotals,
} from "@/lib/dashboard/types";

/** The last `count` months in the office time zone, oldest first ("2026-05"). */
export function lastMonthKeys(now: Date, timeZone: string, count: number) {
  const current = DateTime.fromJSDate(now).setZone(timeZone).startOf("month");
  return Array.from({ length: count }, (_, index) =>
    current.minus({ months: count - 1 - index }).toFormat("yyyy-MM"),
  );
}

export function monthKey(date: Date, timeZone: string) {
  return DateTime.fromJSDate(date).setZone(timeZone).toFormat("yyyy-MM");
}

export function dayKey(date: Date, timeZone: string) {
  return DateTime.fromJSDate(date).setZone(timeZone).toFormat("yyyy-MM-dd");
}

/** Invoiced (by issue date) and collected (by payment date) per month. */
export function monthlyTotals(
  months: string[],
  invoices: Array<{ issueDate: Date; total: number }>,
  payments: Array<{ paidAt: Date | null; amount: number }>,
  timeZone: string,
): MonthTotals[] {
  const totals = new Map(months.map((month) => [month, { month, invoiced: 0, collected: 0 }]));

  for (const invoice of invoices) {
    const bucket = totals.get(monthKey(invoice.issueDate, timeZone));
    if (bucket) bucket.invoiced += invoice.total;
  }

  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const bucket = totals.get(monthKey(payment.paidAt, timeZone));
    if (bucket) bucket.collected += payment.amount;
  }

  return months.map((month) => {
    const bucket = totals.get(month)!;
    return { month, invoiced: roundMoney(bucket.invoiced), collected: roundMoney(bucket.collected) };
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Outstanding balances by days since the invoice was issued. */
export function agingBuckets(
  invoices: Array<{ issueDate: Date; outstanding: number }>,
  now: Date,
): AgingBuckets {
  const buckets: AgingBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };

  for (const invoice of invoices) {
    if (invoice.outstanding <= 0) continue;
    const age = Math.max(0, Math.floor((now.getTime() - invoice.issueDate.getTime()) / DAY_MS));
    const key: keyof AgingBuckets =
      age <= 30 ? "d0_30" : age <= 60 ? "d31_60" : age <= 90 ? "d61_90" : "d90_plus";
    buckets[key] += invoice.outstanding;
  }

  return {
    d0_30: roundMoney(buckets.d0_30),
    d31_60: roundMoney(buckets.d31_60),
    d61_90: roundMoney(buckets.d61_90),
    d90_plus: roundMoney(buckets.d90_plus),
  };
}

/** Month-over-month change in percent, or null when there is no base. */
export function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Jordanian court degrees, read from the free-text court name (cases have
// no type column). Checked in order, the first match wins.
const COURT_LEVEL_PATTERNS: Array<[CourtLevel, RegExp]> = [
  ["CASSATION", /تمييز|cassation|supreme/i],
  ["APPEAL", /استئناف|appeal/i],
  ["SHARIA", /شرعي|sharia|religious/i],
  ["ADMINISTRATIVE", /إداري|اداري|administrative/i],
  ["MAGISTRATE", /صلح|magistrate/i],
  ["FIRST_INSTANCE", /بداية|first instance/i],
  ["CRIMINAL", /جنايات|criminal|felon/i],
];

export function courtLevel(court: string | null | undefined): CourtLevel {
  const name = court?.trim();
  if (!name) return "UNSPECIFIED";
  return COURT_LEVEL_PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? "OTHER";
}

/** Case counts per court level, largest first, at most `limit` rows. */
export function casesByCourtLevel(
  groups: Array<{ court: string | null; count: number }>,
  limit = 5,
) {
  const counts = new Map<CourtLevel, number>();
  for (const group of groups) {
    const level = courtLevel(group.court);
    counts.set(level, (counts.get(level) ?? 0) + group.count);
  }

  return [...counts.entries()]
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

type AgendaAppointment = {
  id: string;
  title: string;
  type: string;
  startTime: Date;
  location: string | null;
  case: CaseRef | null;
  client: ClientRef | null;
};

type AgendaTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  case: CaseRef | null;
  client: ClientRef | null;
};

const APPOINTMENT_KINDS = new Set<AgendaKind>(["COURT_SESSION", "MEETING", "PHONE_CALL", "DEADLINE", "OTHER"]);

/** Appointments and task deadlines in one timeline, earliest first. */
export function buildAgenda(
  appointments: AgendaAppointment[],
  tasks: AgendaTask[],
  timeZone: string,
): AgendaItem[] {
  const items: Array<AgendaItem & { sortAt: number }> = [];

  for (const appointment of appointments) {
    const kind = APPOINTMENT_KINDS.has(appointment.type as AgendaKind)
      ? (appointment.type as AgendaKind)
      : "OTHER";
    items.push({
      id: `appointment-${appointment.id}`,
      kind,
      title: appointment.title,
      at: appointment.startTime.toISOString(),
      day: dayKey(appointment.startTime, timeZone),
      hasTime: true,
      location: appointment.location,
      case: appointment.case,
      client: appointment.client,
      sortAt: appointment.startTime.getTime(),
    });
  }

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const local = DateTime.fromJSDate(task.dueDate).setZone(timeZone);
    const hasTime = local.hour !== 0 || local.minute !== 0;
    items.push({
      id: `task-${task.id}`,
      kind: "TASK",
      title: task.title,
      at: task.dueDate.toISOString(),
      day: local.toFormat("yyyy-MM-dd"),
      hasTime,
      location: null,
      case: task.case,
      client: task.client,
      // A date-only deadline sorts at the end of its day.
      sortAt: hasTime ? task.dueDate.getTime() : local.endOf("day").toMillis(),
    });
  }

  return items
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ sortAt: _sortAt, ...item }) => item);
}

function roundMoney(value: number) {
  return Math.round(value * 1000) / 1000;
}
