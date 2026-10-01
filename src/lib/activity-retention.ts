import type { Prisma } from "@prisma/client";

// Activity log retention (pruned daily by /api/cron/prune-activity).
//
// "audit" events are kept for a year: deletions and archiving, money
// (invoices, payments), billing, system-admin actions, team and role
// changes, AI data-consent changes, and account/auth security events.
// Everything else (routine creates/edits, views, AI usage) for 30 days.
//
// Every name below is emitted somewhere in src/ (enforced by
// tests/unit/activity-retention.test.ts), so the list cannot silently drift
// from what the app actually logs.

export const ACTIVITY_RETENTION_DAYS = {
  audit: 365,
  default: 30,
} as const;

export const AUDIT_ACTIVITY_TYPES = [
  // Deletions and archiving
  "CASE_DELETED",
  "CLIENT_DELETED",
  "CLIENT_ARCHIVED",
  "CLIENT_RESTORED",
  "INVOICE_DELETED",
  "PAYMENT_DELETED",
  "DOCUMENT_DELETED",
  "TASK_DELETED",
  "APPOINTMENT_DELETED",

  // Money
  "INVOICE_CREATED",
  "INVOICE_UPDATED",
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",

  // Billing
  "BILLING_PLAN_CHANGED",

  // Office data requests (export, deletion)
  "DATA_EXPORTED",
  "DOCUMENT_FILE_EXPORTED",
  "OFFICE_DELETION_REQUESTED",

  // Team and roles
  "TEAM_MEMBER_UPDATED",
  "TEAM_MEMBER_DISABLED",
  "TEAM_INVITATION_SENT",
  "TEAM_INVITATION_REVOKED",
  "TEAM_INVITATION_ACCEPTED",

  // Office data-processing consent
  "AI_ENABLED",
  "AI_DISABLED",

  // Account and auth security
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "SUSPICIOUS_LOGIN",
  "TWO_FACTOR_FAILED",
  "TWO_FACTOR_ENABLED",
  "TWO_FACTOR_DISABLED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "SESSION_REVOKED",
  "SESSIONS_REVOKED",
  "ACCOUNT_EMAIL_CHANGED",
  "AI_PROMPT_INJECTION_BLOCKED",
] as const;

// Families logged with a dynamic suffix, e.g. SYSTEM_ADMIN_SUBSCRIPTION_END_NOW.
export const AUDIT_ACTIVITY_TYPE_PREFIXES = ["SYSTEM_ADMIN_"] as const;

const AUDIT_TYPES = new Set<string>(AUDIT_ACTIVITY_TYPES);

export function isAuditActivityType(type: string) {
  return (
    AUDIT_TYPES.has(type) ||
    AUDIT_ACTIVITY_TYPE_PREFIXES.some((prefix) => type.startsWith(prefix))
  );
}

export function auditActivityWhere(): Prisma.ActivityWhereInput {
  return {
    OR: [
      { type: { in: [...AUDIT_ACTIVITY_TYPES] } },
      ...AUDIT_ACTIVITY_TYPE_PREFIXES.map((prefix) => ({
        type: { startsWith: prefix },
      })),
    ],
  };
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function getActivityRetentionCutoffs() {
  return {
    auditCutoff: daysAgo(ACTIVITY_RETENTION_DAYS.audit),
    defaultCutoff: daysAgo(ACTIVITY_RETENTION_DAYS.default),
  };
}
