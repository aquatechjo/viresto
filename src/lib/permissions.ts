export type UserRole = "ADMIN" | "LAWYER" | "STAFF";

export type AppPermission =
  | "case.read.all"
  | "case.read.assigned"
  | "case.manage"
  | "case.team.manage"
  | "client.manage"
  | "document.read"
  | "finance.read"
  | "finance.write"
  | "reports.read"
  | "billing.manage"
  | "team.manage";

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<AppPermission>> = {
  ADMIN: new Set<AppPermission>([
    "case.read.all",
    "case.manage",
    "case.team.manage",
    "client.manage",
    "document.read",
    "finance.read",
    "finance.write",
    "reports.read",
    "billing.manage",
    "team.manage",
  ]),
  LAWYER: new Set<AppPermission>([
    "case.read.assigned",
    "case.manage",
    "client.manage",
    "document.read",
    "finance.read",
    "finance.write",
    "reports.read",
  ]),
  STAFF: new Set<AppPermission>([
    "case.read.assigned",
    "document.read",
  ]),
};

export function hasRole(userRole: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(userRole);
}

export function hasPermission(role: UserRole, permission: AppPermission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function canReadFinance(role: UserRole) {
  return hasPermission(role, "finance.read");
}

export function canWriteFinance(role: UserRole) {
  return hasPermission(role, "finance.write");
}

export function canManageCaseTeam(role: UserRole) {
  return hasPermission(role, "case.team.manage");
}

/**
 * Changing a case's lead lawyer or members: an office admin, or the lawyer
 * who leads that case. Other lawyers on the case edit everything else.
 */
export function canChangeCaseTeam(
  user: { role: UserRole; userId: string },
  caseLeadLawyerId: string | null,
) {
  return (
    canManageCaseTeam(user.role) ||
    (canManageCases(user.role) && user.userId === caseLeadLawyerId)
  );
}

export function canManageBilling(role: UserRole) {
  return hasPermission(role, "billing.manage");
}

export function canManageUsers(role: UserRole) {
  return hasPermission(role, "team.manage");
}

export function canManageCases(role: UserRole) {
  return hasPermission(role, "case.manage");
}

export function canManageClients(role: UserRole) {
  return hasPermission(role, "client.manage");
}

export function canViewDocuments(role: UserRole) {
  return hasPermission(role, "document.read");
}
