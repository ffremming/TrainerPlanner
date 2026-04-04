import { useState } from 'react'
import { ZONE_COLORS, ZONE_INFO, TYPE_ICONS, WORKOUT_TYPES } from '../utils'
import WorkoutForm from './WorkoutForm'

export default function WorkoutDetail({ workout, onClose, isAdmin, onDelete, onToggleComplete, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...workout })

  if (!workout) return null

  const zone = workout.intensityZone || 1
  const colors = ZONE_COLORS[zone]
  const zoneInfo = ZONE_INFO[zone]
  const icon = TYPE_ICONS[workout.type] || '📋'
  const typeLabel = WORKOUT_TYPES.find(t => t.value === workout.type)?.label || workout.type

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleSave(e) {
    e.preventDefault()
    onEdit(form)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="modal-backdrop" onClick={handleBackdrop}>
        <div className="modal add-modal">
          <button className="modal-close" onClick={() => setEditing(false)}>✕</button>
          <h2 className="modal-title-h2">Rediger økt</h2>
          <form onSubmit={handleSave}>
            <WorkoutForm value={form} onChange={setForm} />
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn-cancel" onClick={() => setEditing(false)}>Avbryt</button>
              <button type="submit" className="btn-save">Lagre</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal" style={{ borderTop: `4px solid ${colors.border}` }}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <span className="modal-icon">{icon}</span>
          <div>
            <div className="modal-title">{workout.title}</div>
            <div className="modal-type">{typeLabel}</div>
          </div>
        </div>

        {workout.description && (
          <div className="modal-section">
            <div className="section-label">Treningsøkt</div>
            <div className="section-content workout-desc" style={{ whiteSpace: 'pre-line' }}>{workout.description}</div>
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
            <div className="section-content" style={{ whiteSpace: 'pre-line' }}>{workout.notes}</div>
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
            <button className="btn-edit" onClick={() => setEditing(true)}>✏️</button>
          )}
          {isAdmin && (
            <button className="btn-delete" onClick={() => onDelete(workout)}>🗑</button>
          )}
        </div>
      </div>
    </div>
  )
}
