import { useState, useEffect } from 'react'
import {
  getAllUsers,
  updateUserRole,
  addRelationship,
  removeRelationship,
  onAllUsersSnapshot,
  onRelationshipsSnapshot,
} from '../userService'
import { compareUsersByRole, getUserRoles, hasRole, ROLE_LABELS, ROLE_OPTIONS } from '../roles'
import SystemIcon from './SystemIcon'

export default function UserManagement({ currentUser, onClose }) {
  const [users, setUsers] = useState([])
  const [relationships, setRelationships] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [assigningCoach, setAssigningCoach] = useState(false)

  useEffect(() => {
    const unsubUsers = onAllUsersSnapshot(allUsers => {
      setUsers(allUsers)
      setLoading(false)
    })
    const unsubRels = onRelationshipsSnapshot(setRelationships)
    return () => { unsubUsers(); unsubRels() }
  }, [])

  // Keep selectedUser in sync
  useEffect(() => {
    if (!selectedUser) return
    const fresh = users.find(u => u.uid === selectedUser.uid)
    if (fresh) setSelectedUser(fresh)
  }, [users])

  async function handleRoleToggle(user, role) {
    const currentRoles = getUserRoles(user)
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter(currentRole => currentRole !== role)
      : [...currentRoles, role]

    if (nextRoles.length === 0) {
      window.alert('En bruker må ha minst én rolle.')
      return
    }

    if (user.uid === currentUser.uid && !nextRoles.includes('superadmin')) {
      if (!window.confirm('Er du sikker på at du vil endre din egen rolle? Du kan miste admin-tilgang.')) {
        return
      }
    }

    await updateUserRole(user.uid, nextRoles)
  }

  async function handleAddRelationship(coachId, athleteId) {
    await addRelationship(coachId, athleteId)
    setAssigningCoach(false)
  }

  async function handleRemoveRelationship(coachId, athleteId) {
    if (!window.confirm('Fjerne denne trener-utøver-koblingen?')) return
    await removeRelationship(coachId, athleteId)
  }

  const coaches = users.filter(u => hasRole(u, 'coach'))
  const athletes = users.filter(u => hasRole(u, 'athlete'))

  function getCoachesForAthlete(athleteId) {
    const coachIds = relationships
      .filter(r => r.athleteId === athleteId)
      .map(r => r.coachId)
    return users.filter(u => coachIds.includes(u.uid))
  }

  function getAthletesForCoach(coachId) {
    const athleteIds = relationships
      .filter(r => r.coachId === coachId)
      .map(r => r.athleteId)
    return users.filter(u => athleteIds.includes(u.uid))
  }

  // ─── User Detail View ───
  if (selectedUser) {
    const selectedRoles = getUserRoles(selectedUser)
    const isCoach = hasRole(selectedUser, 'coach')
    const isAthlete = hasRole(selectedUser, 'athlete')
    const coachAthletes = isCoach ? getAthletesForCoach(selectedUser.uid) : []
    const athleteCoaches = isAthlete ? getCoachesForAthlete(selectedUser.uid) : []
    const unassignedAthletes = isCoach
      ? athletes.filter(a => !coachAthletes.some(ca => ca.uid === a.uid))
      : []
    const unassignedCoaches = isAthlete
      ? coaches.filter(c => !athleteCoaches.some(ac => ac.uid === c.uid))
      : []

    return (
      <div className="admin-dashboard user-management">
        <header className="admin-header">
          <button className="admin-back-btn" onClick={() => { setSelectedUser(null); setAssigningCoach(false) }}>
            ‹ Tilbake
          </button>
          <div className="admin-header-copy">
            <span className="brand-eyebrow">User Management</span>
            <span className="admin-header-title">{selectedUser.displayName}</span>
          </div>
          <div style={{ width: 72 }} />
        </header>

        <div className="admin-scroll-area" style={{ padding: '1rem' }}>
          <div className="user-detail-card">
            <div className="user-detail-row">
              <span className="user-detail-label">E-post</span>
              <span>{selectedUser.email}</span>
            </div>
            <div className="user-detail-row">
              <span className="user-detail-label">Roller</span>
              <div className="role-select role-checkbox-group">
                {ROLE_OPTIONS.map(role => (
                  <label key={role} className="role-checkbox-option">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => handleRoleToggle(selectedUser, role)}
                    />
                    <span>{ROLE_LABELS[role]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Coach's athletes */}
          {isCoach && (
            <div className="relationship-section">
              <h3 className="relationship-title">Utøvere ({coachAthletes.length})</h3>
              {coachAthletes.length === 0 ? (
                <div className="empty-state-small">Ingen utøvere tildelt ennå</div>
              ) : (
                <div className="relationship-list">
                  {coachAthletes.map(athlete => (
                    <div key={athlete.uid} className="relationship-item">
                      <div className="relationship-info">
                        <span className="relationship-name">{athlete.displayName}</span>
                        <span className="relationship-email">{athlete.email}</span>
                      </div>
                      <button
                        className="btn-remove-rel"
                        onClick={() => handleRemoveRelationship(selectedUser.uid, athlete.uid)}
                        title="Fjern kobling"
                      >
                        <SystemIcon name="unassign" className="button-icon" />
                        Fjern
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unassignedAthletes.length > 0 && (
                assigningCoach ? (
                  <div className="assign-section">
                    <h4 className="assign-title">Legg til utøver</h4>
                    <div className="assign-list">
                      {unassignedAthletes.map(athlete => (
                        <button
                          key={athlete.uid}
                          className="btn-assign"
                          onClick={() => handleAddRelationship(selectedUser.uid, athlete.uid)}
                        >
                          + {athlete.displayName}
                        </button>
                      ))}
                    </div>
                    <button className="btn-cancel-small" onClick={() => setAssigningCoach(false)}>
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <button className="btn-add-rel" onClick={() => setAssigningCoach(true)}>
                    + Legg til utøver
                  </button>
                )
              )}
            </div>
          )}

          {/* Athlete's coaches */}
          {isAthlete && (
            <div className="relationship-section">
              <h3 className="relationship-title">Trenere ({athleteCoaches.length})</h3>
              {athleteCoaches.length === 0 ? (
                <div className="empty-state-small">Ingen trener tildelt ennå</div>
              ) : (
                <div className="relationship-list">
                  {athleteCoaches.map(coach => (
                    <div key={coach.uid} className="relationship-item">
                      <div className="relationship-info">
                        <span className="relationship-name">{coach.displayName}</span>
                        <span className="relationship-email">{coach.email}</span>
                      </div>
                      <button
                        className="btn-remove-rel"
                        onClick={() => handleRemoveRelationship(coach.uid, selectedUser.uid)}
                        title="Fjern kobling"
                      >
                        <SystemIcon name="unassign" className="button-icon" />
                        Fjern
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unassignedCoaches.length > 0 && (
                assigningCoach ? (
                  <div className="assign-section">
                    <h4 className="assign-title">Legg til trener</h4>
                    <div className="assign-list">
                      {unassignedCoaches.map(coach => (
                        <button
                          key={coach.uid}
                          className="btn-assign"
                          onClick={() => handleAddRelationship(coach.uid, selectedUser.uid)}
                        >
                          + {coach.displayName}
                        </button>
                      ))}
                    </div>
                    <button className="btn-cancel-small" onClick={() => setAssigningCoach(false)}>
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <button className="btn-add-rel" onClick={() => setAssigningCoach(true)}>
                    + Legg til trener
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── User List View ───
  return (
    <div className="admin-dashboard user-management">
      <header className="admin-header">
        <button className="admin-back-btn" onClick={onClose}>‹ Tilbake</button>
        <div className="admin-header-copy">
          <span className="brand-eyebrow">Training Planner</span>
          <span className="admin-header-title">Brukere</span>
        </div>
        <div style={{ width: 72 }} />
      </header>

      <div className="admin-scroll-area">
        <div className="user-management-info">
          <p>Nye brukere registrerer seg selv og får rollen &laquo;Utøver&raquo;. Du kan kombinere roller og tildele trenere her.</p>
        </div>

        {loading ? (
          <div className="empty-state">Laster brukere...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">Ingen brukere funnet</div>
        ) : (
          <div className="user-list">
            {users
              .sort((a, b) => {
                const ro = compareUsersByRole(a, b)
                return ro !== 0 ? ro : (a.displayName || '').localeCompare(b.displayName || '')
              })
              .map(u => (
                <div
                  key={u.uid}
                  className="user-card"
                  onClick={() => setSelectedUser(u)}
                >
                  <div className="user-card-left">
                    <div className="user-avatar">
                      {(u.displayName || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="user-card-info">
                      <span className="user-card-name">{u.displayName || 'Uten navn'}</span>
                      <span className="user-card-email">{u.email}</span>
                    </div>
                  </div>
                  <div className="role-badge-list">
                    {getUserRoles(u).map(role => (
                      <span key={role} className={`role-badge role-${role}`}>
                        {ROLE_LABELS[role] || role}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
