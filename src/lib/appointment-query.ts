import type { Prisma } from "@prisma/client";

interface AppointmentListFilters {
  userId: string;
  assignedToId?: string;
  includeArchivedClients: boolean;
  from?: Date | null;
  to?: Date | null;
}

/**
 * The requested part of GET /api/appointments (access rules are added by
 * buildAppointmentAccessWhere). Every condition goes into one AND list: the
 * archived-client rule and the date range used to be two `AND` keys in the
 * same object, so the range silently replaced the archive rule.
 */
export function appointmentListWhere({
  userId,
  assignedToId = "",
  includeArchivedClients,
  from,
  to,
}: AppointmentListFilters): Prisma.AppointmentWhereInput {
  const conditions: Prisma.AppointmentWhereInput[] = [];

  if (assignedToId === "me") conditions.push({ assignedToId: userId });
  else if (assignedToId) conditions.push({ assignedToId });

  if (!includeArchivedClients) {
    conditions.push(
      { OR: [{ clientId: null }, { client: { archivedAt: null } }] },
      { OR: [{ caseId: null }, { case: { client: { archivedAt: null } } }] },
    );
  }

  if (to) conditions.push({ startTime: { lt: to } });
  if (from) {
    // Overlapping the range: ends after it starts, or (no end) starts in it.
    conditions.push({
      OR: [{ endTime: { gt: from } }, { endTime: null, startTime: { gte: from } }],
    });
  }

  return conditions.length ? { AND: conditions } : {};
}
