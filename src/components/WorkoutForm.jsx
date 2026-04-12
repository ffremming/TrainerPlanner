import {
  WORKOUT_TYPES,
  TEMPLATE_CATEGORIES,
  ACTIVITY_TAGS,
  LOAD_TAGS,
  WEEKDAY_OPTIONS,
  getDefaultCooldown,
  getDefaultLoadTag,
  getDefaultWarmup,
  getAllowedIntensityZones,
  getDefaultIntensityZones,
  hasIntensityZone,
  normalizeIntensityZones,
} from '../utils'
import ActivityIcon from './ActivityIcon'

export default function WorkoutForm({ value, onChange, showCategory = false, showScheduleFields = false }) {
  const isStrengthWorkout = value.type === 'styrke' || value.type === 'molle'
  const isRunningWorkout = ['interval', 'terskel', 'rolig', 'molle'].includes(value.type)
  const showIntensityZone = hasIntensityZone(value.type)
  const allowedZones = getAllowedIntensityZones(value.type)

  function set(key, val) {
    onChange({ ...value, [key]: val })
  }

  function setActivityTag(activityTag) {
    const nextActivityTag = value.activityTag === activityTag ? '' : activityTag
    onChange({
      ...value,
      activityTag: nextActivityTag,
      warmup: value.warmup || getDefaultWarmup(value.type, nextActivityTag),
      cooldown: value.cooldown || getDefaultCooldown(value.type, nextActivityTag),
    })
  }

  function setType(type) {
    const intensityZone = normalizeIntensityZones(type, value.intensityZone ?? getDefaultIntensityZones(type))
    onChange({
      ...value,
      type,
      intensityZone,
      loadTag: getDefaultLoadTag(type, intensityZone),
      warmup: value.warmup || getDefaultWarmup(type, value.activityTag),
      cooldown: value.cooldown || getDefaultCooldown(type, value.activityTag),
    })
  }

  function toggleIntensityZone(zone) {
    const currentZones = normalizeIntensityZones(value.type, value.intensityZone)
    const nextZones = currentZones.includes(zone)
      ? (currentZones.length > 1 ? currentZones.filter(currentZone => currentZone !== zone) : currentZones)
      : [...currentZones, zone].sort((a, b) => a - b)

    set('intensityZone', nextZones)
  }

  return (
    <div className="add-form">
      <div className="form-intro">
        <span className="section-eyebrow">Workout setup</span>
        <p className="form-intro-text">Definer okttype, aktivitet og detaljer i et konsistent oppsett.</p>
      </div>

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
        Aktivitet
        <div className="activity-tag-picker">
          {ACTIVITY_TAGS.map(tag => (
            <button
              key={tag.value}
              type="button"
              className={`activity-tag-btn${value.activityTag === tag.value ? ' active' : ''}`}
              style={{
                '--tag-color': tag.color,
                '--tag-bg': tag.bg,
              }}
              onClick={() => setActivityTag(tag.value)}
            >
              <span className="activity-tag-icon"><ActivityIcon name={tag.icon} className="tag-icon-svg" /></span>
              <span>{tag.label}</span>
            </button>
          ))}
        </div>
      </label>

      <label>
        Type
        <select value={value.type || 'rolig'} onChange={e => setType(e.target.value)}>
          {WORKOUT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      {showScheduleFields && (
        <div className="date-time-row">
          <label>
            Fast dag
            <select
              value={value.weekday || ''}
              onChange={e => set('weekday', Number(e.target.value))}
              required
            >
              <option value="">Velg dag</option>
              {WEEKDAY_OPTIONS.map(day => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </label>
          <label>
            Klokkeslett
            <input
              type="time"
              value={value.time || ''}
              onChange={e => set('time', e.target.value)}
            />
          </label>
        </div>
      )}

      {showScheduleFields && (
        <div className="field-hint">Du kan legge flere økter på samme dag. Tid brukes for rekkefølge hvis den er satt.</div>
      )}

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
          <div className="field-hint">Velg en eller flere soner</div>
          <div className="zone-picker">
            {allowedZones.map(z => (
              <button
                key={z}
                type="button"
                className={`zone-btn zone-btn-${z}${normalizeIntensityZones(value.type, value.intensityZone).includes(z) ? ' active' : ''}`}
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
        <select value={value.loadTag || getDefaultLoadTag(value.type, value.intensityZone)} onChange={e => set('loadTag', e.target.value)}>
          {LOAD_TAGS.map(tag => (
            <option key={tag.value} value={tag.value}>{tag.label}</option>
          ))}
        </select>
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
          value={value.warmup || getDefaultWarmup(value.type, value.activityTag)}
          onChange={e => set('warmup', e.target.value)}
        />
      </label>

      <label>
        Nedkjøling
        <input
          type="text"
          placeholder="F.eks. 1 km rolig"
          value={value.cooldown || getDefaultCooldown(value.type, value.activityTag)}
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
