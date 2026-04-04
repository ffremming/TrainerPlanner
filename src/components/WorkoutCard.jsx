import { ZONE_COLORS, TYPE_ICONS, formatDate } from '../utils'

export default function WorkoutCard({ workout, onClick, isAdmin, onToggleComplete }) {
  const zone = workout.intensityZone || 1
  const colors = ZONE_COLORS[zone]
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
        <span className="card-icon">{icon}</span>
        <div className="card-info">
          <span className="card-date">{formatDate(workout.date)}</span>
          <span className="card-title">{workout.title}</span>
          <span className="card-desc">{workout.description}</span>
        </div>
      </div>
      <div className="card-right">
        <span
          className="zone-badge"
          style={{ backgroundColor: colors.border, color: colors.text }}
        >
          {colors.label}
        </span>
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
