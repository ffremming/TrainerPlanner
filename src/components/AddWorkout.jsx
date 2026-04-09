import { useState } from 'react'
import {
  LOAD_TAGS,
  WORKOUT_TYPES,
  getAllowedIntensityZones,
  getDefaultCooldown,
  getDefaultIntensityZones,
  getDefaultLoadTag,
  getDefaultWarmup,
  hasIntensityZone,
  normalizeIntensityZones,
} from '../utils'
import SystemIcon from './SystemIcon'

const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  type: 'interval',
  title: '',
  description: '',
  distance: '',
  sessionDetails: '',
  warmup: getDefaultWarmup('interval'),
  cooldown: getDefaultCooldown('interval'),
  exercises: '',
  rest: '',
  notes: '',
  loadTag: getDefaultLoadTag('interval', getDefaultIntensityZones('interval')),
  intensityZone: getDefaultIntensityZones('interval'),
}

export default function AddWorkout({ onSave, onClose, initialDate }) {
  const [form, setForm] = useState({
    ...DEFAULT_FORM,
    date: initialDate || DEFAULT_FORM.date,
  })

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setType(type) {
    const intensityZone = normalizeIntensityZones(type, form.intensityZone)
    setForm(f => ({
      ...f,
      type,
      intensityZone,
      loadTag: getDefaultLoadTag(type, intensityZone),
      warmup: f.warmup || getDefaultWarmup(type),
      cooldown: f.cooldown || getDefaultCooldown(type),
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
    if (!form.title.trim() || !form.date) return
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
        <button className="modal-close" onClick={onClose}><SystemIcon name="close" className="system-icon" /></button>
        <h2 className="modal-title-h2">Legg til økt</h2>

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
              placeholder="F.eks. Rolig jogg"
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
            Load
            <select value={form.loadTag} onChange={e => set('loadTag', e.target.value)}>
              {LOAD_TAGS.map(tag => (
                <option key={tag.value} value={tag.value}>{tag.label}</option>
              ))}
            </select>
          </label>

          <label>
            Beskrivelse / Økt
            <textarea
              placeholder="F.eks. 4 x 1km @ 11.5 km/t, 5:15 pace, 2 min pause"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
            />
          </label>

          <label>
            Oppvarming
            <input
              type="text"
              placeholder="F.eks. 2 km rolig"
              value={form.warmup}
              onChange={e => set('warmup', e.target.value)}
              required
            />
          </label>

          <label>
            Nedkjøling
            <input
              type="text"
              placeholder="F.eks. 1 km rolig"
              value={form.cooldown}
              onChange={e => set('cooldown', e.target.value)}
              required
            />
          </label>

          <label>
            Notater (valgfritt)
            <textarea
              placeholder="Tips, fokuspunkter, utstyr..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
            />
          </label>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Avbryt</button>
            <button type="submit" className="btn-save">Lagre økt</button>
          </div>
        </form>
      </div>
    </div>
  )
}
