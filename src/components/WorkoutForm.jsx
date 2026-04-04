import { WORKOUT_TYPES, TEMPLATE_CATEGORIES } from '../utils'

export default function WorkoutForm({ value, onChange, showCategory = false }) {
  function set(key, val) {
    onChange({ ...value, [key]: val })
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
        <select value={value.type || 'rolig'} onChange={e => set('type', e.target.value)}>
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

      <label>
        Intensitetssone
        <div className="zone-picker">
          {[1, 2, 3, 4, 5].map(z => (
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

      <label>
        Beskrivelse / Økt
        <textarea
          placeholder="F.eks. 4 x 1km @ 11.5 km/t, 5:15 pace, 2 min pause"
          value={value.description || ''}
          onChange={e => set('description', e.target.value)}
          rows={4}
        />
      </label>

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
