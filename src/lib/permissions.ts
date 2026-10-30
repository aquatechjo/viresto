// The single source of who may do what in an office. API routes check a
// permission with requirePermission (api-auth.ts) and access-control.ts
// scopes queries with hasPermission; nothing else compares role names.
// Routes every office member may use (own notifications, search, the
// dashboard, settings read) call requireAuth and scope their data instead.

export type UserRole = "ADMIN" | "LAWYER" | "STAFF";

export const USER_ROLES: readonly UserRole[] = ["ADMIN", "LAWYER", "STAFF"];

export type AppPermission =
  // Cases. Without case.read.all a user sees only the cases they lead, are
  // a member of, or hold a task or appointment in (access-control.ts).
  | "case.read"
  | "case.read.all"
  | "case.create"
  | "case.update"
  | "case.delete"
  | "case.lead" // may be chosen as a case's lead lawyer
  | "case.team.manage" // change any case's team; a lead changes their own
  // Clients. Without client.read.all, the clients of the cases above.
  | "client.read"
  | "client.read.all"
  | "client.create"
  | "client.update"
  | "client.delete"
  | "client.contact.read" // email, phone, national id, address
  // Appointments and tasks. Without *.read.all, the user's own ones and
  // those on cases they can see.
  | "appointment.read"
  | "appointment.read.all"
  | "appointment.create"
  | "appointment.update"
  | "appointment.update.others" // edit appointments assigned to others
  | "appointment.assign.any" // assign to anyone, not only oneself
  | "appointment.delete"
  | "task.read"
  | "task.read.all"
  | "task.create"
  | "task.update"
  | "task.update.others" // update tasks assigned to others
  | "task.assign.any" // assign to anyone, not only oneself
  | "task.edit.details" // change more than the status
  | "task.delete"
  // Documents, scoped by the case they belong to.
  | "document.read"
  | "document.upload"
  | "document.delete"
  | "document.summarize"
  // Finance. finance.read shows invoices, payments and finance figures;
  // without finance.read.all, only those of the user's cases and clients.
  | "finance.read"
  | "finance.read.all"
  | "invoice.create"
  | "invoice.update"
  | "invoice.delete"
  | "payment.create"
  | "payment.update"
  | "payment.cancel.paid" // cancel a payment already collected
  | "payment.delete"
  | "reports.read"
  // Office.
  | "activity.read.all" // everyone's activity, not only one's own
  | "team.manage"
  | "billing.manage"
  | "settings.manage"
  | "office.data.manage"; // office data export and deletion requests

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<AppPermission>> = {
  ADMIN: new Set<AppPermission>([
    "case.read",
    "case.read.all",
    "case.create",
    "case.update",
    "case.delete",
    "case.lead",
    "case.team.manage",
    "client.read",
    "client.read.all",
    "client.create",
    "client.update",
    "client.delete",
    "client.contact.read",
    "appointment.read",
    "appointment.read.all",
    "appointment.create",
    "appointment.update",
    "appointment.update.others",
    "appointment.assign.any",
    "appointment.delete",
    "task.read",
    "task.read.all",
    "task.create",
    "task.update",
    "task.update.others",
    "task.assign.any",
    "task.edit.details",
    "task.delete",
    "document.read",
    "document.upload",
    "document.delete",
    "document.summarize",
    "finance.read",
    "finance.read.all",
    "invoice.create",
    "invoice.update",
    "invoice.delete",
    "payment.create",
    "payment.update",
    "payment.cancel.paid",
    "payment.delete",
    "reports.read",
    "activity.read.all",
    "team.manage",
    "billing.manage",
    "settings.manage",
    "office.data.manage",
  ]),
  LAWYER: new Set<AppPermission>([
    "case.read",
    "case.create",
    "case.update",
    "case.lead",
    "client.read",
    "client.create",
    "client.update",
    "client.contact.read",
    "appointment.read",
    "appointment.create",
    "appointment.update",
    "appointment.update.others",
    "appointment.assign.any",
    "appointment.delete",
    "task.read",
    "task.create",
    "task.update",
    "task.update.others",
    "task.assign.any",
    "task.edit.details",
    "task.delete",
    "document.read",
    "document.upload",
    "document.delete",
    "document.summarize",
    "finance.read",
    "invoice.create",
    "invoice.update",
    "payment.create",
    "payment.update",
    "reports.read",
  ]),
  STAFF: new Set<AppPermission>([
    "case.read",
    "client.read",
    "appointment.read",
    "appointment.create",
    "appointment.update",
    "task.read",
    "task.create",
    "task.update",
    "document.read",
    "document.upload",
  ]),
};

export function hasPermission(role: UserRole, permission: AppPermission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** The roles holding a permission, for role filters in Prisma queries. */
export function rolesWithPermission(permission: AppPermission): UserRole[] {
  return USER_ROLES.filter((role) => hasPermission(role, permission));
}

/**
 * Changing a case's lead lawyer or members: whoever may manage every case
 * team, or the lead of that case. Other lawyers on it edit everything else.
 */
export function canChangeCaseTeam(
  user: { role: UserRole; userId: string },
  caseLeadLawyerId: string | null,
) {
  return (
    hasPermission(user.role, "case.team.manage") ||
    (hasPermission(user.role, "case.update") &&
      user.userId === caseLeadLawyerId)
  );
}
