import { useEffect, useState } from 'react'
import { ZONE_COLORS, ZONE_INFO, TYPE_COLORS, TYPE_ICONS, WORKOUT_TYPES, normalizeIntensityZone } from '../utils'
import WorkoutForm from './WorkoutForm'
import IntensityScaleModal from './IntensityScaleModal'

export default function WorkoutDetail({ workout, onClose, isAdmin, onDelete, onToggleComplete, onEdit, onSaveComment }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(workout ? { ...workout } : {})
  const [showScale, setShowScale] = useState(false)
  const [commentDraft, setCommentDraft] = useState(workout?.userComment || '')
  const [commentSaving, setCommentSaving] = useState(false)

  useEffect(() => {
    if (!workout) return
    setForm({ ...workout })
    setCommentDraft(workout.userComment || '')
  }, [workout])

  if (!workout) return null

  const zone = normalizeIntensityZone(workout.type, workout.intensityZone)
  const colors = ZONE_COLORS[zone]
  const zoneInfo = ZONE_INFO[zone]
  const typeColors = TYPE_COLORS[workout.type] || TYPE_COLORS.annet
  const icon = TYPE_ICONS[workout.type] || '📋'
  const typeLabel = WORKOUT_TYPES.find(t => t.value === workout.type)?.label || workout.type
  const isStrengthWorkout = workout.type === 'styrke' || workout.type === 'molle'
  const isRunningWorkout = ['interval', 'terskel', 'rolig', 'molle'].includes(workout.type)
  const exerciseLines = (workout.exercises || workout.description || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const runningDetails = workout.sessionDetails || workout.description

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleSave(e) {
    e.preventDefault()
    onEdit(form)
    setEditing(false)
  }

  async function handleSaveComment() {
    if (commentSaving) return
    setCommentSaving(true)
    try {
      await onSaveComment(workout, commentDraft.trim())
    } finally {
      setCommentSaving(false)
    }
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
      <div className="modal" style={{ borderTop: `4px solid ${zone ? colors.border : typeColors.border}` }}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <span className="modal-icon">{icon}</span>
          <div>
            <div className="modal-title">{workout.title}</div>
            <div className="modal-type">{typeLabel}</div>
          </div>
        </div>

        {isRunningWorkout && (
          <>
            {workout.distance && (
              <div className="modal-section">
                <div className="section-label">Antall km</div>
                <div className="section-content">{workout.distance}</div>
              </div>
            )}

            {runningDetails && (
              <div className="modal-section">
                <div className="section-label">Hva skal gjøres</div>
                <div className="section-content workout-desc" style={{ whiteSpace: 'pre-line' }}>
                  {runningDetails}
                </div>
              </div>
            )}
          </>
        )}

        {!isRunningWorkout && workout.description && (!isStrengthWorkout || workout.exercises) && (
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

        {isStrengthWorkout && exerciseLines.length > 0 && (
          <div className="modal-section">
            <div className="section-label">Øvelser</div>
            <ul className="detail-list">
              {exerciseLines.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {isStrengthWorkout && workout.rest && (
          <div className="modal-section">
            <div className="section-label">Pause</div>
            <div className="section-content">{workout.rest}</div>
          </div>
        )}

        {workout.notes && (
          <div className="modal-section">
            <div className="section-label">Notater</div>
            <div className="section-content" style={{ whiteSpace: 'pre-line' }}>{workout.notes}</div>
          </div>
        )}

        <div className="modal-section">
          <div className="section-label">Kommentar på økten</div>
          <textarea
            className="workout-comment-input"
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value)}
            placeholder="Skriv hvordan økten gikk, dagsform, justeringer eller annet du vil følge opp."
            rows={4}
          />
          <div className="comment-actions">
            <button
              className="btn-save-comment"
              onClick={handleSaveComment}
              disabled={commentSaving || commentDraft.trim() === (workout.userComment || '').trim()}
            >
              {commentSaving ? 'Lagrer...' : 'Lagre kommentar'}
            </button>
          </div>
        </div>

        {zone && (
          <div
            className="modal-section zone-section"
            style={{ backgroundColor: colors.bg, borderColor: colors.border, cursor: 'pointer' }}
            onClick={() => setShowScale(true)}
            title="Trykk for å se din intensitetsskala"
          >
            <div className="section-label" style={{ color: colors.text }}>
              {colors.label} — {zoneInfo.rpe}
            </div>
            <div className="zone-stats">
              <span>❤️ {zoneInfo.hr} bpm</span>
              <span>💬 {zoneInfo.breathing}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: colors.text, marginTop: '0.35rem', opacity: 0.7 }}>
              Trykk for å se full intensitetsskala
            </div>
          </div>
        )}

        {zone && showScale && <IntensityScaleModal onClose={() => setShowScale(false)} />}

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
