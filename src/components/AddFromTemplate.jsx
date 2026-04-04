import { useState } from 'react'
import { ZONE_COLORS, WORKOUT_TYPES } from '../utils'

export default function AddFromTemplate({ template, initialDate, onSave, onClose }) {
  const [form, setForm] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    type: template.type,
    title: template.title,
    description: template.description || '',
    warmup: template.warmup || '',
    cooldown: template.cooldown || '',
    notes: template.notes || '',
    intensityZone: template.intensityZone || 2,
  })

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ ...form, intensityZone: Number(form.intensityZone) })
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const colors = ZONE_COLORS[form.intensityZone]

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal add-modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title-h2">Legg til fra øktbank</h2>

        <form onSubmit={handleSubmit} className="add-form">
          <label>
            Dato
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              required
            />
          </label>

          <label>
            Type
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {WORKOUT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label>
            Tittel
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
            />
          </label>

          <label>
            Intensitetssone
            <div className="zone-picker">
              {[1, 2, 3, 4, 5].map(z => (
                <button
                  key={z}
                  type="button"
                  className={`zone-btn zone-btn-${z}${form.intensityZone === z ? ' active' : ''}`}
                  onClick={() => set('intensityZone', z)}
                >
                  Sone {z}
                </button>
              ))}
            </div>
          </label>

          <label>
            Beskrivelse / Økt
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={4}
            />
          </label>

          {(form.warmup !== undefined) && (
            <label>
              Oppvarming
              <input
                type="text"
                value={form.warmup}
                onChange={e => set('warmup', e.target.value)}
              />
            </label>
          )}

          {(form.cooldown !== undefined) && (
            <label>
              Nedkjøling
              <input
                type="text"
                value={form.cooldown}
                onChange={e => set('cooldown', e.target.value)}
              />
            </label>
          )}

          <label>
            Notater
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
            />
          </label>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Avbryt</button>
            <button type="submit" className="btn-save">Legg til i plan</button>
          </div>
        </form>
      </div>
    </div>
  )
}
