import { useState } from 'react'
import { WORKOUT_TYPES, getAllowedIntensityZones, hasIntensityZone, normalizeIntensityZones } from '../utils'

export default function AddFromTemplate({ template, initialDate, onSave, onClose }) {
  const [form, setForm] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    type: template.type,
    title: template.title,
    description: template.description || '',
    distance: template.distance || '',
    sessionDetails: template.sessionDetails || '',
    warmup: template.warmup || '',
    cooldown: template.cooldown || '',
    exercises: template.exercises || '',
    rest: template.rest || '',
    notes: template.notes || '',
    intensityZone: normalizeIntensityZones(template.type, template.intensityZone),
  })

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setType(type) {
    setForm(f => ({
      ...f,
      type,
      intensityZone: normalizeIntensityZones(type, f.intensityZone),
    }))
  }

  function toggleIntensityZone(zone) {
    const currentZones = normalizeIntensityZones(form.type, form.intensityZone)
    const nextZones = currentZones.includes(zone)
      ? (currentZones.length > 1 ? currentZones.filter(currentZone => currentZone !== zone) : currentZones)
      : [...currentZones, zone].sort((a, b) => a - b)

    set('intensityZone', nextZones)
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ ...form, intensityZone: normalizeIntensityZones(form.type, form.intensityZone) })
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const showIntensityZone = hasIntensityZone(form.type)
  const allowedZones = getAllowedIntensityZones(form.type)

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
            <select value={form.type} onChange={e => setType(e.target.value)}>
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

          {showIntensityZone && (
            <label>
              Intensitetssone
              <div className="field-hint">Velg en eller flere soner</div>
              <div className="zone-picker">
                {allowedZones.map(z => (
                  <button
                    key={z}
                    type="button"
                    className={`zone-btn zone-btn-${z}${normalizeIntensityZones(form.type, form.intensityZone).includes(z) ? ' active' : ''}`}
                    onClick={() => toggleIntensityZone(z)}
                  >
                    Sone {z}
                  </button>
                ))}
              </div>
            </label>
          )}

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
