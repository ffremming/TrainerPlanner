import { TYPE_COLORS, WORKOUT_TYPES, parseDistanceValue } from '../utils'

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
  return TYPE_COLORS[workout.type] || TYPE_COLORS.annet
}

function getWorkoutLabel(workout) {
  return WORKOUT_TYPES.find(type => type.value === workout.type)?.label || workout.type
}

function formatWorkoutDistance(distance) {
  const parsed = parseDistanceValue(distance)
  if (parsed === null) return '–'

  const rounded = Number.isInteger(parsed) ? parsed : parsed.toFixed(1)
  return `${rounded} km`
}

export default function BirdsEyeOverview({ weeks, workoutsByWeekKey, selectedWeekKey, onSelectWeek }) {
  return (
    <section className="birds-eye-panel" id="birds-eye-overview">
      <div className="birds-eye-grid">
        {weeks.map(weekEntry => {
          const workouts = workoutsByWeekKey[weekEntry.key] || []
          const isSelected = weekEntry.key === selectedWeekKey
          const weeklyDistance = formatWeeklyDistance(workouts)

          return (
            <button
              key={weekEntry.key}
              type="button"
              className={`birds-eye-week${isSelected ? ' selected' : ''}`}
              onClick={() => onSelectWeek(weekEntry.week, weekEntry.year)}
              aria-label={`Uke ${weekEntry.week}, ${weeklyDistance}`}
            >
              <div className="birds-eye-workouts">
                {workouts.length > 0 ? workouts.map(workout => {
                  const colors = getWorkoutColors(workout)
                  const distanceLabel = formatWorkoutDistance(workout.distance)

                  return (
                    <div
                      key={workout.id}
                      className={`birds-eye-workout${workout.completed ? ' completed' : ''}`}
                      title={`${workout.title} · ${getWorkoutLabel(workout)}${workout.distance ? ` · ${workout.distance}` : ''}`}
                    >
                      <span
                        className="birds-eye-tile"
                        style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        aria-hidden="true"
                      />
                      <span className="birds-eye-tile-distance">{distanceLabel}</span>
                    </div>
                  )
                }) : (
                  <div className="birds-eye-empty" aria-hidden="true" />
                )}
              </div>

              <span className="birds-eye-week-distance">{weeklyDistance}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
