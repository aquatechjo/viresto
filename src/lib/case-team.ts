import { hasPermission, type UserRole } from "@/lib/permissions";

// Who is on a case: one lead lawyer plus members. The lead is never also
// stored as a member, so every list returned here leaves the lead out.

function membersWithoutLead(memberIds: Iterable<string>, leadLawyerId: string) {
  return Array.from(new Set(memberIds)).filter((id) => id !== leadLawyerId);
}

/**
 * Members of a new case. An office admin picks the team freely; anyone else
 * who creates a case stays on it, as a member when someone else leads it.
 */
export function caseMembersForCreate(input: {
  actor: { role: UserRole; userId: string };
  leadLawyerId: string;
  memberIds: string[] | undefined;
}) {
  const members = new Set(input.memberIds ?? []);

  if (!hasPermission(input.actor.role, "case.team.manage")) {
    members.add(input.actor.userId);
  }

  return membersWithoutLead(members, input.leadLawyerId);
}

/**
 * Whether an edit really changes a case's team. The edit forms always send
 * the lead and members back, so their presence alone is not a change.
 * memberIds undefined means the edit leaves the members as they are.
 */
export function isCaseTeamChange(
  current: { leadLawyerId: string | null; memberIds: string[] },
  next: { leadLawyerId: string; memberIds: string[] | undefined },
) {
  if (next.leadLawyerId !== current.leadLawyerId) return true;
  if (next.memberIds === undefined) return false;

  const currentMembers = new Set(
    membersWithoutLead(current.memberIds, current.leadLawyerId ?? ""),
  );
  const nextMembers = membersWithoutLead(next.memberIds, next.leadLawyerId);

  return (
    nextMembers.length !== currentMembers.size ||
    nextMembers.some((id) => !currentMembers.has(id))
  );
}

/**
 * Members after an edit, or undefined when the members stay as they are.
 * A lead who hands the case to someone else stays on it as a member, so
 * they keep their access.
 */
export function caseMembersAfterEdit(
  current: { leadLawyerId: string | null; memberIds: string[] },
  next: { leadLawyerId: string; memberIds: string[] | undefined },
) {
  const previousLead = current.leadLawyerId;
  const leadHandedOver = previousLead !== null && previousLead !== next.leadLawyerId;

  if (next.memberIds === undefined && !leadHandedOver) return undefined;

  const members = new Set(next.memberIds ?? current.memberIds);
  if (leadHandedOver) members.add(previousLead);

  return membersWithoutLead(members, next.leadLawyerId);
}
