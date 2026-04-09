export default function WorkoutLayoutToggle({ value = 'list', onChange, compact = false }) {
  return (
    <div className={`layout-toggle${compact ? ' compact' : ''}`} role="tablist" aria-label="Velg visning av økter">
      <button
        type="button"
        className={`layout-toggle-btn${value === 'calendar' ? ' active' : ''}`}
        onClick={() => onChange('calendar')}
      >
        Kalender
      </button>
      <button
        type="button"
        className={`layout-toggle-btn${value === 'list' ? ' active' : ''}`}
        onClick={() => onChange('list')}
      >
        Liste
      </button>
    </div>
  )
}
