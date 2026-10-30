import { hasPermission, type UserRole } from "@/lib/permissions";

// Who receives a financial reminder (invoice due or overdue, payment):
// only users who may read finance (finance.read), never anyone else on
// the case. Pure so the rule is tested without a database.

export type FinancialCaseRecipients = {
  leadLawyer: { id: string; isActive: boolean; role: UserRole } | null;
  members: Array<{ userId: string; user: { isActive: boolean; role: UserRole } }>;
} | null;

export function uniqueIds(ids: Array<string | null | undefined>) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export function financialRecipients(
  caseItem: FinancialCaseRecipients,
  adminIds: string[],
) {
  const lead = caseItem?.leadLawyer;

  return uniqueIds([
    ...adminIds,
    lead?.isActive && hasPermission(lead.role, "finance.read") ? lead.id : null,
    ...(caseItem?.members ?? [])
      .filter(
        (member) =>
          member.user.isActive && hasPermission(member.user.role, "finance.read"),
      )
      .map((member) => member.userId),
  ]);
}
