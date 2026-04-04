import { TYPE_COLORS, WORKOUT_TYPES, ZONE_COLORS, normalizeIntensityZone, parseDistanceValue } from '../utils'

function formatWeekRange(monday, sunday) {
  return `${monday.getDate()}.${monday.getMonth() + 1}–${sunday.getDate()}.${sunday.getMonth() + 1}`
}

function formatWeeklyDistance(workouts) {
  const total = workouts.reduce((sum, workout) => {
    const distance = parseDistanceValue(workout.distance)
    return distance === null ? sum : sum + distance
  }, 0)

  if (total <= 0) return 'Ingen km'

  const rounded = Number.isInteger(total) ? total : total.toFixed(1)
  return `${rounded} km`
}

function getWorkoutColors(workout) {
  const zone = normalizeIntensityZone(workout.type, workout.intensityZone)
  if (zone) {
    return ZONE_COLORS[zone]
  }

  return TYPE_COLORS[workout.type] || TYPE_COLORS.annet
}

function getWorkoutLabel(workout) {
  return WORKOUT_TYPES.find(type => type.value === workout.type)?.label || workout.type
}

export default function BirdsEyeOverview({ weeks, workoutsByWeekKey, selectedWeekKey, onSelectWeek }) {
  return (
    <section className="birds-eye-panel">
      <div className="birds-eye-header">
        <div>
          <h2 className="birds-eye-title">8 ukers oversikt</h2>
          <p className="birds-eye-subtitle">Småruter per økt med km og farge for intensitet/type</p>
        </div>
        <div className="birds-eye-legend">
          <span className="legend-item"><span className="legend-dot zone-2" /> Rolig</span>
          <span className="legend-item"><span className="legend-dot zone-4" /> Hardt</span>
          <span className="legend-item"><span className="legend-dot type-strength" /> Styrke</span>
        </div>
      </div>

      <div className="birds-eye-grid">
        {weeks.map(weekEntry => {
          const workouts = workoutsByWeekKey[weekEntry.key] || []
          const isSelected = weekEntry.key === selectedWeekKey

          return (
            <button
              key={weekEntry.key}
              type="button"
              className={`birds-eye-week${isSelected ? ' selected' : ''}`}
              onClick={() => onSelectWeek(weekEntry.week, weekEntry.year)}
            >
              <div className="birds-eye-week-header">
                <span className="birds-eye-week-label">Uke {weekEntry.week}</span>
                <span className="birds-eye-week-range">{formatWeekRange(weekEntry.monday, weekEntry.sunday)}</span>
              </div>

              <div className="birds-eye-week-meta">
                <span>{workouts.length} økter</span>
                <span>{formatWeeklyDistance(workouts)}</span>
              </div>

              <div className="birds-eye-workouts">
                {workouts.length > 0 ? workouts.map(workout => {
                  const colors = getWorkoutColors(workout)
                  const distanceLabel = workout.distance ? String(workout.distance).replace(/\s*km/i, '') : ''

                  return (
                    <div
                      key={workout.id}
                      className={`birds-eye-tile${workout.completed ? ' completed' : ''}`}
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                      title={`${workout.title} · ${getWorkoutLabel(workout)}${workout.distance ? ` · ${workout.distance}` : ''}`}
                    >
                      <span className="birds-eye-tile-distance">{distanceLabel || '•'}</span>
                    </div>
                  )
                }) : (
                  <div className="birds-eye-empty">Ingen økter</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
