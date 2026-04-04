import {
  WORKOUT_TYPES,
  TEMPLATE_CATEGORIES,
  getAllowedIntensityZones,
  getDefaultIntensityZone,
  hasIntensityZone,
  normalizeIntensityZone,
} from '../utils'

export default function WorkoutForm({ value, onChange, showCategory = false }) {
  const isStrengthWorkout = value.type === 'styrke' || value.type === 'molle'
  const isRunningWorkout = ['interval', 'terskel', 'rolig', 'molle'].includes(value.type)
  const showIntensityZone = hasIntensityZone(value.type)
  const allowedZones = getAllowedIntensityZones(value.type)

  function set(key, val) {
    onChange({ ...value, [key]: val })
  }

  function setType(type) {
    onChange({
      ...value,
      type,
      intensityZone: normalizeIntensityZone(type, value.intensityZone ?? getDefaultIntensityZone(type)),
    })
  }

  return (
    <div className="add-form">
      {showCategory && (
        <label>
          Kategori
          <select value={value.category || ''} onChange={e => set('category', e.target.value)}>
            <option value="">Velg kategori</option>
            {TEMPLATE_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        Type
        <select value={value.type || 'rolig'} onChange={e => setType(e.target.value)}>
          {WORKOUT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      <label>
        Tittel *
        <input
          type="text"
          placeholder="F.eks. Rolig jogg"
          value={value.title || ''}
          onChange={e => set('title', e.target.value)}
          required
        />
      </label>

      {showIntensityZone && (
        <label>
          Intensitetssone
          <div className="zone-picker">
            {allowedZones.map(z => (
              <button
                key={z}
                type="button"
                className={`zone-btn zone-btn-${z}${value.intensityZone === z ? ' active' : ''}`}
                onClick={() => set('intensityZone', z)}
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
          placeholder="F.eks. 4 x 1km @ 11.5 km/t, 5:15 pace, 2 min pause"
          value={value.description || ''}
          onChange={e => set('description', e.target.value)}
          rows={4}
        />
      </label>

      {isRunningWorkout && (
        <>
          <label>
            Antall km
            <input
              type="text"
              placeholder="F.eks. 8 km"
              value={value.distance || ''}
              onChange={e => set('distance', e.target.value)}
            />
          </label>

          <label>
            Hva skal gjøres
            <textarea
              placeholder="F.eks. 4 x 1 km i sone 4 med 2 min pause mellom dragene"
              value={value.sessionDetails || ''}
              onChange={e => set('sessionDetails', e.target.value)}
              rows={3}
            />
          </label>
        </>
      )}

      <label>
        Oppvarming
        <input
          type="text"
          placeholder="F.eks. 2 km rolig"
          value={value.warmup || ''}
          onChange={e => set('warmup', e.target.value)}
        />
      </label>

      <label>
        Nedkjøling
        <input
          type="text"
          placeholder="F.eks. 1 km rolig"
          value={value.cooldown || ''}
          onChange={e => set('cooldown', e.target.value)}
        />
      </label>

      {isStrengthWorkout && (
        <>
          <label>
            Øvelser
            <textarea
              placeholder={'Én øvelse per linje\nF.eks. Knebøy 3 x 8'}
              value={value.exercises || ''}
              onChange={e => set('exercises', e.target.value)}
              rows={6}
            />
          </label>

          <label>
            Pause mellom sett
            <input
              type="text"
              placeholder="F.eks. 60-90 sek"
              value={value.rest || ''}
              onChange={e => set('rest', e.target.value)}
            />
          </label>
        </>
      )}

      <label>
        Notater
        <textarea
          placeholder="Tips, fokuspunkter, utstyr..."
          value={value.notes || ''}
          onChange={e => set('notes', e.target.value)}
          rows={2}
        />
      </label>
    </div>
  )
}
