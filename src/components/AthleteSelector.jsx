import { hasRole } from '../roles'

export default function AthleteSelector({ athletes, selectedAthleteId, onSelect, currentUserProfile, hideLabel = false }) {
  if (!athletes || athletes.length === 0) return null
  const visibleAthletes = hasRole(currentUserProfile, 'superadmin')
    ? athletes.filter(a => a.uid !== currentUserProfile.uid)
    : athletes

  return (
    <div className="athlete-selector">
      {!hideLabel && <label className="athlete-selector-label">Utøver:</label>}
      <select
        className="athlete-dropdown"
        value={selectedAthleteId || ''}
        onChange={e => onSelect(e.target.value)}
      >
        {hasRole(currentUserProfile, 'superadmin') && (
          <option value={currentUserProfile.uid}>
            {currentUserProfile.displayName} (meg)
          </option>
        )}
        {visibleAthletes.map(a => (
          <option key={a.uid} value={a.uid}>
            {a.uid === currentUserProfile.uid ? `${a.displayName} (meg)` : a.displayName}
          </option>
        ))}
      </select>
    </div>
  )
}
