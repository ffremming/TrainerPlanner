import { TYPE_COLORS, WORKOUT_TYPES, formatKmValue, getAdjacentWeek, getWeeklyDistance, getWeeklyProgressionTarget, getWeeklyProgressionTargets, parseDistanceValue } from '../utils'

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
  const weeklyTargets = getWeeklyProgressionTargets(weeks)
  const chartPoints = weeks.map(weekEntry => {
    const workouts = workoutsByWeekKey[weekEntry.key] || []
    return {
      key: weekEntry.key,
      label: `Uke ${weekEntry.week}`,
      planned: getWeeklyDistance(workouts),
      target: weeklyTargets.get(weekEntry.key) || 0,
      isSelected: weekEntry.key === selectedWeekKey,
    }
  })

  return (
    <section className="birds-eye-panel" id="birds-eye-overview">
      <div className="birds-eye-summary">
        <div>
          <h2 className="birds-eye-title">Mengdeoversikt</h2>
          <p className="birds-eye-subtitle">Planlagte kilometer mot ukentlig target. Forankret til 17 km i uke 13, 2026, med 7% progresjon per uke.</p>
        </div>
        <div className="birds-eye-legend" aria-label="Forklaring">
          <span className="birds-eye-legend-item">
            <span className="birds-eye-legend-dot planned" aria-hidden="true" />
            Planlagt
          </span>
          <span className="birds-eye-legend-item">
            <span className="birds-eye-legend-dot target" aria-hidden="true" />
            Target
          </span>
        </div>
      </div>

      <WeeklyKmChart points={chartPoints} />

      <div className="birds-eye-grid">
        {weeks.map(weekEntry => {
          const workouts = workoutsByWeekKey[weekEntry.key] || []
          const isSelected = weekEntry.key === selectedWeekKey
          const weeklyDistance = getWeeklyDistance(workouts)
          const targetDistance = weeklyTargets.get(weekEntry.key) || 0

          return (
            <button
              key={weekEntry.key}
              type="button"
              className={`birds-eye-week${isSelected ? ' selected' : ''}`}
              onClick={() => onSelectWeek(weekEntry.week, weekEntry.year)}
              aria-label={`Uke ${weekEntry.week}, ${formatKmValue(weeklyDistance)} planlagt, ${formatKmValue(targetDistance)} target`}
            >
              <div className="birds-eye-week-meta">
                <span className="birds-eye-week-label">Uke {weekEntry.week}</span>
                <span className="birds-eye-week-target">Target {formatKmValue(targetDistance)}</span>
              </div>
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

              <span className="birds-eye-week-distance">{formatKmValue(weeklyDistance)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function WeeklyKmChart({ points }) {
  if (points.length === 0) return null

  const width = 640
  const height = 220
  const padding = { top: 20, right: 14, bottom: 34, left: 38 }
  const lastPoint = points[points.length - 1]
  let cursor = {
    week: Number(lastPoint.key.split('-')[1]),
    year: Number(lastPoint.key.split('-')[0]),
  }
  const futureTargets = []

  for (let index = 0; index < 8; index += 1) {
    cursor = getAdjacentWeek(cursor.week, cursor.year, 1)
    futureTargets.push(getWeeklyProgressionTarget(cursor.week, cursor.year))
  }

  const visibleMax = Math.max(...points.flatMap(point => [point.planned, point.target]), 1)
  const horizonMax = Math.max(...futureTargets, visibleMax)
  const maxValue = Math.max(visibleMax * 1.12, horizonMax * 1.04, 20)
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const getX = index => {
    if (points.length === 1) return padding.left + innerWidth / 2
    return padding.left + (innerWidth * index) / (points.length - 1)
  }
  const getY = value => padding.top + innerHeight - (value / maxValue) * innerHeight

  const makePath = key => points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point[key])}`)
    .join(' ')

  return (
    <div className="birds-eye-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="birds-eye-chart-svg" role="img" aria-label="Planlagte kilometer mot target">
        {[0, 0.5, 1].map(fraction => {
          const value = Number((maxValue * fraction).toFixed(1))
          const y = getY(value)
          return (
            <g key={fraction}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                className="birds-eye-chart-grid"
              />
              <text x={8} y={y + 4} className="birds-eye-chart-axis-label">
                {value}
              </text>
            </g>
          )
        })}

        <path d={makePath('target')} className="birds-eye-chart-line target" />
        <path d={makePath('planned')} className="birds-eye-chart-line planned" />

        {points.map((point, index) => (
          <g key={point.key}>
            <circle
              cx={getX(index)}
              cy={getY(point.target)}
              r={point.isSelected ? 4.5 : 3.5}
              className="birds-eye-chart-point target"
            />
            <circle
              cx={getX(index)}
              cy={getY(point.planned)}
              r={point.isSelected ? 5 : 4}
              className={`birds-eye-chart-point planned${point.isSelected ? ' selected' : ''}`}
            />
            <text x={getX(index)} y={height - 10} textAnchor="middle" className="birds-eye-chart-week-label">
              {point.label.replace('Uke ', 'U')}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
