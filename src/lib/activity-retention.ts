export const ACTIVITY_RETENTION_DAYS = {
  security: 365,
  default: 180,
} as const

export const SECURITY_ACTIVITY_TYPES = [
  'LOGIN_SUCCESS',
  'SUSPICIOUS_LOGIN',
  'LOGIN_FAILED',

  'USER_LOGIN',
  'USER_LOGOUT',

  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'PASSWORD_RESET_REQUEST',

  '2FA_ENABLED',
  '2FA_DISABLED',
  'TWO_FACTOR_ENABLED',
  'TWO_FACTOR_DISABLED',

  'SESSION_REVOKED',
  'SESSIONS_REVOKED',

  'USER_CREATED',
  'USER_UPDATED',
  'USER_ACTIVATED',
  'USER_DEACTIVATED',

  'TENANT_SUSPENDED',
  'TENANT_ACTIVATED',

  'BILLING_STATUS_CHANGED',
  'PLAN_CHANGED',
] as const

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export function getActivityRetentionCutoffs() {
  return {
    securityCutoff: daysAgo(ACTIVITY_RETENTION_DAYS.security),
    defaultCutoff: daysAgo(ACTIVITY_RETENTION_DAYS.default),
  }
}