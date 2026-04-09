export const ROLE_LABELS = {
  superadmin: 'Superadmin',
  coach: 'Trener',
  athlete: 'Utøver',
}

export const ROLE_OPTIONS = ['athlete', 'coach', 'superadmin']

const ROLE_PRIORITY = {
  superadmin: 0,
  coach: 1,
  athlete: 2,
}

export function getUserRoles(user) {
  if (!user) return []

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return [...new Set(user.roles.filter(Boolean))]
  }

  return user.role ? [user.role] : []
}

export function hasRole(user, role) {
  return getUserRoles(user).includes(role)
}

export function getPrimaryRole(user) {
  const roles = getUserRoles(user)
  return [...roles].sort((a, b) => (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99))[0] || 'athlete'
}

export function getRoleLabels(user) {
  return getUserRoles(user).map(role => ROLE_LABELS[role] || role)
}

export function compareUsersByRole(a, b) {
  const roleA = getPrimaryRole(a)
  const roleB = getPrimaryRole(b)
  return (ROLE_PRIORITY[roleA] ?? 99) - (ROLE_PRIORITY[roleB] ?? 99)
}
