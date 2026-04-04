import { ZONE_COLORS, TYPE_COLORS, TYPE_ICONS, normalizeIntensityZone } from '../utils'

export default function WorkoutCard({ workout, index, onClick, onToggleComplete }) {
  const zone = normalizeIntensityZone(workout.type, workout.intensityZone)
  const zoneColors = ZONE_COLORS[zone]
  const colors = TYPE_COLORS[workout.type] || TYPE_COLORS.annet
  const icon = TYPE_ICONS[workout.type] || '📋'

  function handleCheck(e) {
    e.stopPropagation()
    onToggleComplete(workout)
  }

  return (
    <div
      className={`workout-card${workout.completed ? ' completed' : ''}`}
      style={{ backgroundColor: colors.bg, borderLeftColor: colors.border }}
      onClick={() => onClick(workout)}
    >
      <div className="card-left">
        <span className="card-index">{index + 1}</span>
        <span className="card-icon">{icon}</span>
        <div className="card-info">
          <span className="card-title">{workout.title}</span>
          {workout.description && (
            <span className="card-desc">{workout.description}</span>
          )}
        </div>
      </div>
      <div className="card-right">
        {zone && (
          <span
            className="zone-badge"
            style={{ backgroundColor: zoneColors.border, color: zoneColors.text }}
          >
            {zoneColors.label}
          </span>
        )}
        <button
          className={`check-btn${workout.completed ? ' checked' : ''}`}
          onClick={handleCheck}
          title={workout.completed ? 'Marker som ikke gjort' : 'Marker som gjort'}
        >
          {workout.completed ? '✓' : '○'}
        </button>
      </div>
    </div>
  )
}
