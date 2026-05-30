export type UserRole = 'ADMIN' | 'LAWYER' | 'STAFF'

export function hasRole(userRole: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(userRole)
}

export function canManageBilling(role: UserRole) {
  return role === 'ADMIN'
}

export function canManageUsers(role: UserRole) {
  return role === 'ADMIN'
}

export function canManageCases(role: UserRole) {
  return role === 'ADMIN' || role === 'LAWYER'
}

export function canManageClients(role: UserRole) {
  return role === 'ADMIN' || role === 'LAWYER'
}

export function canViewDocuments(role: UserRole) {
  return role === 'ADMIN' || role === 'LAWYER' || role === 'STAFF'
}