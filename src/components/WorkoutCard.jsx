import {
  ACTIVITY_TAG_MAP,
  LOAD_TAG_MAP,
  ZONE_COLORS,
  TYPE_COLORS,
  TYPE_ICONS,
  formatWorkoutSchedule,
  getIntensityZoneLabel,
  normalizeIntensityZone,
} from '../utils'
import ActivityIcon from './ActivityIcon'

export default function WorkoutCard({
  workout,
  index,
  indexLabel,
  showSchedule = true,
  slotLayout = false,
  onClick,
  onToggleComplete,
}) {
  const zone = normalizeIntensityZone(workout.type, workout.intensityZone)
  const zoneColors = zone ? ZONE_COLORS[zone] : null
  const zoneLabel = getIntensityZoneLabel(workout)
  const colors = TYPE_COLORS[workout.type] || TYPE_COLORS.annet
  const icon = TYPE_ICONS[workout.type] || 'AN'
  const activityTag = workout.activityTag ? ACTIVITY_TAG_MAP[workout.activityTag] : null
  const loadTag = workout.loadTag ? LOAD_TAG_MAP[workout.loadTag] : null
  const scheduleLabel = formatWorkoutSchedule(workout)

  function handleCheck(e) {
    e.stopPropagation()
    onToggleComplete(workout)
  }

  return (
    <div
      className={`workout-card${workout.completed ? ' completed' : ''}${slotLayout ? ' slot-layout' : ''}`}
      style={{ backgroundColor: colors.bg, borderLeftColor: colors.border }}
      onClick={() => onClick(workout)}
    >
      <div className="card-left">
        {indexLabel && <span className="card-index">{indexLabel}</span>}
        <span className="card-icon"><ActivityIcon name={icon} className="ui-icon" /></span>
        <div className="card-info">
          {showSchedule && scheduleLabel && <span className="card-date">{scheduleLabel}</span>}
          <span className="card-title">{workout.title}</span>
          {workout.description && (
            <span className="card-desc">{workout.description}</span>
          )}
          {activityTag && (
            <span
              className="activity-tag-pill compact"
              style={{ '--tag-color': activityTag.color, '--tag-bg': activityTag.bg }}
            >
              <span className="activity-tag-icon" aria-hidden="true"><ActivityIcon name={activityTag.icon} className="tag-icon-svg" /></span>
              <span>{activityTag.label}</span>
            </span>
          )}
          {loadTag && (
            <span
              className="load-tag-pill compact"
              style={{ '--load-color': loadTag.color, '--load-bg': loadTag.bg }}
            >
              <span>{loadTag.label}</span>
            </span>
          )}
        </div>
      </div>
      <div className="card-right">
        {zone && zoneLabel && (
          <span
            className="zone-badge"
            style={{ backgroundColor: zoneColors.border, color: zoneColors.text }}
          >
            {zoneLabel}
          </span>
        )}
        <button
          className={`check-btn${workout.completed ? ' checked' : ''}`}
          onClick={handleCheck}
          title={workout.completed ? 'Marker som ikke gjort' : 'Marker som gjort'}
        >
          {workout.completed ? 'OK' : ''}
        </button>
      </div>
    </div>
  )
}
