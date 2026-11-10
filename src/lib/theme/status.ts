// Which color family (tone) each status takes, the same everywhere: app
// badges, the dashboard, printouts and exports (color plan, approved
// 2026-11-07). The tone colors themselves are in tokens.ts and, for the
// app, the --tone-* custom properties of globals.css.

export type StatusTone = "green" | "amber" | "blue" | "red" | "gray";

export const STATUS_TONES = {
  invoice: {
    DRAFT: "gray",
    UNPAID: "amber",
    PARTIALLY_PAID: "blue",
    PAID: "green",
    OVERDUE: "red",
    CANCELLED: "gray",
  },
  payment: {
    PAID: "green",
    PENDING: "amber",
    OVERDUE: "red",
    CANCELLED: "gray",
  },
  case: {
    OPEN: "green",
    IN_PROGRESS: "blue",
    CLOSED: "gray",
    ARCHIVED: "gray",
  },
  appointment: {
    SCHEDULED: "blue",
    COMPLETED: "green",
    CANCELLED: "gray",
  },
  task: {
    TODO: "gray",
    IN_PROGRESS: "blue",
    BLOCKED: "amber",
    COMPLETED: "green",
    CANCELLED: "gray",
  },
  priority: {
    URGENT: "red",
    HIGH: "amber",
    MEDIUM: "blue",
    LOW: "gray",
  },
  user: {
    ACTIVE: "green",
    INACTIVE: "gray",
    SUSPENDED: "red",
  },
} as const satisfies Record<string, Record<string, StatusTone>>;

export type StatusKind = keyof typeof STATUS_TONES;

export function statusTone(kind: StatusKind, status: string | null | undefined): StatusTone {
  const tones = STATUS_TONES[kind] as Record<string, StatusTone>;
  return (status && tones[status]) || "gray";
}

/** The badge classes for a status: "badge badge-<tone>". */
export function statusBadgeClass(kind: StatusKind, status: string | null | undefined) {
  return `badge badge-${statusTone(kind, status)}`;
}

/** A chart mark (bar, arc, dot) in a status's tone: --chart-<tone>, per theme. */
export function statusChartColor(kind: StatusKind, status: string | null | undefined) {
  return `var(--chart-${statusTone(kind, status)})`;
}

/**
 * Inline style for a status chip that is not a .badge (custom padding or
 * shape): the same tone colors, from the CSS custom properties.
 */
export function statusToneStyle(tone: StatusTone) {
  return {
    background: `var(--tone-${tone}-bg)`,
    color: `var(--tone-${tone}-fg)`,
    borderColor: `var(--tone-${tone}-border)`,
  };
}
