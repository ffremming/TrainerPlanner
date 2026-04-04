import { ZONE_COLORS, ZONE_INFO, TYPE_ICONS, WORKOUT_TYPES, formatDate } from '../utils'

export default function WorkoutDetail({ workout, onClose, isAdmin, onDelete, onToggleComplete }) {
  if (!workout) return null

  const zone = workout.intensityZone || 1
  const colors = ZONE_COLORS[zone]
  const zoneInfo = ZONE_INFO[zone]
  const icon = TYPE_ICONS[workout.type] || '📋'
  const typeLabel = WORKOUT_TYPES.find(t => t.value === workout.type)?.label || workout.type

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal" style={{ borderTop: `4px solid ${colors.border}` }}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <span className="modal-icon">{icon}</span>
          <div>
            <div className="modal-date">{formatDate(workout.date)}</div>
            <div className="modal-title">{workout.title}</div>
            <div className="modal-type">{typeLabel}</div>
          </div>
        </div>

        {workout.description && (
          <div className="modal-section">
            <div className="section-label">Treningsøkt</div>
            <div className="section-content workout-desc">{workout.description}</div>
          </div>
        )}

        {workout.warmup && (
          <div className="modal-section">
            <div className="section-label">Oppvarming</div>
            <div className="section-content">{workout.warmup}</div>
          </div>
        )}

        {workout.cooldown && (
          <div className="modal-section">
            <div className="section-label">Nedkjøling</div>
            <div className="section-content">{workout.cooldown}</div>
          </div>
        )}

        {workout.notes && (
          <div className="modal-section">
            <div className="section-label">Notater</div>
            <div className="section-content">{workout.notes}</div>
          </div>
        )}

        <div className="modal-section zone-section" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
          <div className="section-label" style={{ color: colors.text }}>
            {colors.label} — {zoneInfo.rpe}
          </div>
          <div className="zone-stats">
            <span>❤️ {zoneInfo.hr} bpm</span>
            <span>💬 {zoneInfo.breathing}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className={`btn-complete${workout.completed ? ' done' : ''}`}
            onClick={() => onToggleComplete(workout)}
          >
            {workout.completed ? '✓ Fullført!' : 'Marker som fullført'}
          </button>
          {isAdmin && (
            <button className="btn-delete" onClick={() => onDelete(workout)}>
              Slett
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
