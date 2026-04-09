import { useEffect, useMemo, useState } from 'react'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  ACTIVITY_TAGS,
  ACTIVITY_TAG_MAP,
  LOAD_TAG_MAP,
  ZONE_COLORS,
  TYPE_COLORS,
  TYPE_ICONS,
  compareWorkoutsBySchedule,
  estimateMechanicalLoad,
  estimateWorkoutDuration,
  estimateWorkoutLoad,
  formatIntensityZoneLabel,
  formatDurationLabel,
  formatKmValue,
  formatWorkoutSchedule,
  formatWorkoutTime,
  getAdjacentWeek,
  getWorkoutDistance,
  getWeekKey,
  isHardWorkout,
  groupWorkoutsByWeekday,
  normalizeIntensityZones,
} from '../utils'
import ActivityIcon from './ActivityIcon'
import BirdsEyeOverview from './BirdsEyeOverview'
import SystemIcon from './SystemIcon'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const builderChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 14,
        boxWidth: 10,
        font: { size: 11, weight: '600' },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11, weight: '600' } },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148, 163, 184, 0.18)' },
      ticks: { font: { size: 11 } },
    },
  },
}

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 12,
        boxWidth: 10,
        font: { size: 11, weight: '600' },
      },
    },
  },
}

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 12,
        boxWidth: 10,
        font: { size: 11, weight: '600' },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11, weight: '600' } },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148, 163, 184, 0.18)' },
      ticks: { font: { size: 11 } },
    },
    y1: {
      beginAtZero: true,
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: { font: { size: 11 } },
    },
  },
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function averageLastValues(values, count, endIndexInclusive) {
  const start = Math.max(0, endIndexInclusive - count + 1)
  const slice = values.slice(start, endIndexInclusive + 1)
  return average(slice)
}

function safeDivide(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0
  return a / b
}

function formatScore(value) {
  if (!Number.isFinite(value) || value <= 0) return '0.0'
  return value.toFixed(1)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export default function AdminPlanBuilder({
  currentWeek,
  currentYear,
  monday,
  sunday,
  isThisWeek,
  selectedAthleteName,
  workouts,
  loadingWorkouts,
  templates,
  loadingTemplates,
  overviewWeeks,
  overviewWorkoutsByWeekKey,
  loadingOverview,
  analysisWeeks,
  analysisWorkoutsByWeekKey,
  loadingAnalysis,
  onWeekChange,
  onSelectWorkout,
  onDeleteWorkout,
  onToggleComplete,
  onMoveWorkout,
  onMoveWorkoutByDrag,
  onAddTemplateToDay,
}) {
  const [dragState, setDragState] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [showOverview, setShowOverview] = useState(false)
  const [bankWindows, setBankWindows] = useState([])
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth : 1440
  ))
  const [paneWidths, setPaneWidths] = useState({ left: 260, middle: 320, right: 300 })
  const [activeResizer, setActiveResizer] = useState(null)

  const isDesktopBuilder = viewportWidth >= 1280
  const maxContainerWidth = Math.min(Math.max(viewportWidth - 24, 0), 1880)
  const availableDesktopWidth = Math.max(1180, maxContainerWidth - 32)
  const splitterWidth = 24
  const centerMinWidth = 780

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!activeResizer) return

    function handlePointerMove(event) {
      const deltaX = event.clientX - activeResizer.startX

      setPaneWidths(prev => {
        if (activeResizer.side === 'middle') {
          const maxMiddle = Math.max(
            260,
            availableDesktopWidth - prev.left - prev.right - splitterWidth * 3 - centerMinWidth
          )

          return {
            ...prev,
            middle: clamp(activeResizer.startWidth + deltaX, 260, maxMiddle),
          }
        }

        if (activeResizer.side === 'left') {
          const reservedMiddleWidth = bankWindows.length > 0 ? prev.middle + splitterWidth : 0
          const maxLeft = Math.max(
            220,
            availableDesktopWidth - prev.right - reservedMiddleWidth - splitterWidth * 2 - centerMinWidth
          )
          return {
            ...prev,
            left: clamp(activeResizer.startWidth + deltaX, 220, maxLeft),
          }
        }

        const reservedMiddleWidth = bankWindows.length > 0 ? prev.middle + splitterWidth : 0
        const maxRight = Math.max(
          240,
          availableDesktopWidth - prev.left - reservedMiddleWidth - splitterWidth * 2 - centerMinWidth
        )
        return {
          ...prev,
          right: clamp(activeResizer.startWidth - deltaX, 240, maxRight),
        }
      })
    }

    function handlePointerUp() {
      setActiveResizer(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [activeResizer, availableDesktopWidth, bankWindows.length])

  const extraWindowsWidth = bankWindows.length > 0 ? paneWidths.middle : 0
  const activeSplitterCount = bankWindows.length > 0 ? 3 : 2
  const desktopCenterWidth = availableDesktopWidth - paneWidths.left - paneWidths.right - splitterWidth * activeSplitterCount - extraWindowsWidth
  const builderLayoutStyle = isDesktopBuilder ? {
    gridTemplateColumns: bankWindows.length > 0
      ? `${paneWidths.left}px ${splitterWidth}px ${extraWindowsWidth}px ${splitterWidth}px minmax(${centerMinWidth}px, 1fr) ${splitterWidth}px ${paneWidths.right}px`
      : `${paneWidths.left}px ${splitterWidth}px minmax(${centerMinWidth}px, 1fr) ${splitterWidth}px ${paneWidths.right}px`,
    '--builder-side-font': paneWidths.left < 250 || paneWidths.middle < 290 || paneWidths.right < 280 ? '0.68rem' : '0.74rem',
    '--builder-side-title-font': paneWidths.left < 250 || paneWidths.middle < 290 || paneWidths.right < 280 ? '0.78rem' : '0.84rem',
    '--builder-calendar-day-font': desktopCenterWidth < 900 ? '0.68rem' : desktopCenterWidth < 1120 ? '0.72rem' : '0.78rem',
    '--builder-calendar-meta-font': desktopCenterWidth < 900 ? '0.58rem' : desktopCenterWidth < 1120 ? '0.6rem' : '0.62rem',
    '--builder-calendar-card-title-font': desktopCenterWidth < 900 ? '0.66rem' : desktopCenterWidth < 1120 ? '0.7rem' : '0.72rem',
    '--builder-calendar-support-font': desktopCenterWidth < 900 ? '0.56rem' : desktopCenterWidth < 1120 ? '0.58rem' : '0.6rem',
  } : undefined

  const selectedWeekKey = getWeekKey(currentWeek, currentYear)

  const groupedWorkouts = useMemo(() => (
    groupWorkoutsByWeekday([...workouts].sort(compareWorkoutsBySchedule))
  ), [workouts])

  const weekStats = useMemo(() => {
    const totalDuration = workouts.reduce((sum, workout) => sum + estimateWorkoutDuration(workout), 0)
    const totalLoad = workouts.reduce((sum, workout) => sum + estimateWorkoutLoad(workout), 0)
    const totalMechanicalLoad = workouts.reduce((sum, workout) => sum + estimateMechanicalLoad(workout), 0)
    const hardCount = workouts.filter(workout => isHardWorkout(workout)).length
    const easyCount = workouts.length - hardCount

    const distanceByActivity = ACTIVITY_TAGS.map(tag => {
      const total = workouts.reduce((sum, workout) => (
        workout.activityTag === tag.value ? sum + (getWorkoutDistance(workout) || 0) : sum
      ), 0)

      return { ...tag, total }
    }).filter(tag => tag.total > 0)

    return {
      totalDuration,
      totalLoad,
      totalMechanicalLoad,
      hardCount,
      easyCount,
      sessionCount: workouts.length,
      distanceByActivity,
    }
  }, [workouts])

  const dailyLoadChartData = useMemo(() => {
    const days = groupWorkoutsByWeekday(workouts)

    return {
      labels: days.map(day => day.shortLabel),
      datasets: [
        {
          label: 'Load',
          data: days.map(day => day.workouts.reduce((sum, workout) => sum + estimateWorkoutLoad(workout), 0)),
          backgroundColor: 'rgba(37, 99, 235, 0.82)',
          borderRadius: 10,
        },
        {
          label: 'Mekanisk load',
          data: days.map(day => day.workouts.reduce((sum, workout) => sum + estimateMechanicalLoad(workout), 0)),
          backgroundColor: 'rgba(14, 165, 233, 0.42)',
          borderRadius: 10,
        },
      ],
    }
  }, [workouts])

  const distanceDistributionChartData = useMemo(() => ({
    labels: weekStats.distanceByActivity.map(activity => activity.label),
    datasets: [{
      data: weekStats.distanceByActivity.map(activity => Number(activity.total.toFixed(1))),
      backgroundColor: weekStats.distanceByActivity.map(activity => activity.color),
      borderWidth: 0,
    }],
  }), [weekStats.distanceByActivity])

  const loadMixChartData = useMemo(() => {
    const hardLoad = workouts
      .filter(workout => isHardWorkout(workout))
      .reduce((sum, workout) => sum + estimateWorkoutLoad(workout), 0)
    const easyLoad = workouts
      .filter(workout => !isHardWorkout(workout))
      .reduce((sum, workout) => sum + estimateWorkoutLoad(workout), 0)

    return {
      labels: ['Hard belastning', 'Rolig belastning'],
      datasets: [{
        data: [hardLoad, easyLoad],
        backgroundColor: ['#f97316', '#22c55e'],
        borderWidth: 0,
      }],
    }
  }, [workouts])

  const performanceTrend = useMemo(() => {
    const weeklyStats = analysisWeeks.map(week => {
      const weekWorkouts = analysisWorkoutsByWeekKey[week.key] || []
      const distance = weekWorkouts.reduce((sum, workout) => sum + (getWorkoutDistance(workout) || 0), 0)
      const load = weekWorkouts.reduce((sum, workout) => sum + estimateWorkoutLoad(workout), 0)
      const workoutsWithForm = weekWorkouts.filter(workout => Number.isFinite(workout.formScore))
      const workoutsWithSurplus = weekWorkouts.filter(workout => Number.isFinite(workout.surplusScore))
      const averageFormScore = average(workoutsWithForm.map(workout => Number(workout.formScore)))
      const averageSurplusScore = average(workoutsWithSurplus.map(workout => Number(workout.surplusScore)))
      const readinessScore = average(
        [averageFormScore, averageSurplusScore].filter(score => Number.isFinite(score) && score > 0)
      )

      return {
        week,
        load,
        distance,
        averageFormScore,
        readinessScore,
      }
    })

    const loadSeries = weeklyStats.map(week => week.load)
    const weeksWithSignals = weeklyStats.map((week, index) => {
      const acuteLoad = averageLastValues(loadSeries, 3, index)
      const chronicLoad = averageLastValues(loadSeries, 6, index)
      const trainingReadiness = safeDivide(acuteLoad, chronicLoad)

      return {
        ...week,
        acuteLoad,
        trainingReadiness,
      }
    })

    const currentIndex = weeksWithSignals.findIndex(week => (
      week.week.week === currentWeek && week.week.year === currentYear
    ))

    return {
      currentIndex,
      weeklyStats: weeksWithSignals,
    }
  }, [analysisWeeks, analysisWorkoutsByWeekKey, currentWeek, currentYear])

  const trendChartData = useMemo(() => {
    const labels = performanceTrend.weeklyStats.map(entry => `Uke ${entry.week.week}`)

    return {
      labels,
      datasets: [
        {
          label: 'Acute load',
          data: performanceTrend.weeklyStats.map(week => Number(week.acuteLoad.toFixed(1))),
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.14)',
          fill: true,
          tension: 0.3,
          pointRadius: context => context.dataIndex === performanceTrend.currentIndex ? 4 : 2,
        },
        {
          label: 'Km',
          data: performanceTrend.weeklyStats.map(week => Number(week.distance.toFixed(1))),
          borderColor: '#2563eb',
          tension: 0.28,
          pointRadius: context => context.dataIndex === performanceTrend.currentIndex ? 4 : 2,
        },
        {
          label: 'Form',
          data: performanceTrend.weeklyStats.map(week => Number(week.averageFormScore.toFixed(1))),
          borderColor: '#10b981',
          tension: 0.28,
          pointRadius: context => context.dataIndex === performanceTrend.currentIndex ? 4 : 2,
          yAxisID: 'y1',
        },
        {
          label: 'Training readiness',
          data: performanceTrend.weeklyStats.map(week => Number(week.trainingReadiness.toFixed(2))),
          borderColor: '#7c3aed',
          borderDash: [6, 6],
          tension: 0.22,
          pointRadius: context => context.dataIndex === performanceTrend.currentIndex ? 4 : 2,
          yAxisID: 'y1',
        },
      ],
    }
  }, [performanceTrend])

  const focusTrendWeek = performanceTrend.weeklyStats[performanceTrend.currentIndex] || null

  function prevWeek() {
    const previous = getAdjacentWeek(currentWeek, currentYear, -1)
    onWeekChange(previous.week, previous.year)
  }

  function nextWeek() {
    const next = getAdjacentWeek(currentWeek, currentYear, 1)
    onWeekChange(next.week, next.year)
  }

  function handleTemplateDragStart(template) {
    setDragState({ kind: 'template', template })
    setDropTarget(null)
  }

  function handleWorkoutDragStart(workout) {
    setDragState({ kind: 'workout', workoutId: workout.id })
    setDropTarget({
      weekday: workout.weekday,
      beforeWorkoutId: workout.id,
    })
  }

  function handleDragEnd() {
    setDragState(null)
    setDropTarget(null)
  }

  function handleDropTargetChange(weekday, beforeWorkoutId = null) {
    if (!dragState) return
    setDropTarget({ weekday, beforeWorkoutId })
  }

  async function handleDrop(weekday, beforeWorkoutId = null) {
    if (!dragState) return

    const activeDrag = dragState
    setDragState(null)
    setDropTarget(null)

    if (activeDrag.kind === 'template') {
      await onAddTemplateToDay(activeDrag.template, weekday, beforeWorkoutId)
      return
    }

    await onMoveWorkoutByDrag(activeDrag.workoutId, weekday, beforeWorkoutId)
  }

  async function handleTrashDrop() {
    if (!dragState) return

    const activeDrag = dragState
    setDragState(null)
    setDropTarget(null)

    if (activeDrag.kind !== 'workout') return

    const draggedWorkout = workouts.find(workout => workout.id === activeDrag.workoutId)
    if (!draggedWorkout) return

    await onDeleteWorkout(draggedWorkout)
  }

  function handleAddBankWindow() {
    setBankWindows(prev => [
      ...prev,
      { id: `bank-window-${Date.now()}-${prev.length + 1}` },
    ])
  }

  function handleRemoveBankWindow(windowId) {
    setBankWindows(prev => prev.filter(window => window.id !== windowId))
  }

  return (
    <div className="admin-builder">
      {selectedAthleteName && (
        <div className="admin-athlete-banner">
          Planbygger for <strong>{selectedAthleteName}</strong>
        </div>
      )}

      <div className="admin-week-nav">
        <button className="nav-btn" onClick={prevWeek}>‹</button>
        <div className="week-info">
          <span className="week-label">
            Uke {currentWeek}
            {isThisWeek && <span className="this-week-dot" aria-hidden="true" />}
          </span>
          <span className="week-dates">
            {monday.getDate()}.{monday.getMonth() + 1} – {sunday.getDate()}.{sunday.getMonth() + 1}.{sunday.getFullYear()}
          </span>
        </div>
        <button className="nav-btn" onClick={nextWeek}>›</button>
        <button
          type="button"
          className={`nav-btn overview-nav-btn${showOverview ? ' active' : ''}`}
          onClick={() => setShowOverview(prev => !prev)}
          aria-expanded={showOverview}
          aria-controls="admin-builder-overview"
          title="Vis ukeoversikt"
        >
          <span className="overview-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      {showOverview && (
        loadingOverview ? (
          <div className="birds-eye-loading admin-overview-loading" id="admin-builder-overview">Laster mengdeoversikt...</div>
        ) : (
          <div className="admin-overview-wrap" id="admin-builder-overview">
            <BirdsEyeOverview
              weeks={overviewWeeks}
              workoutsByWeekKey={overviewWorkoutsByWeekKey}
              selectedWeekKey={selectedWeekKey}
              onSelectWeek={(week, year) => {
                onWeekChange(week, year)
                setShowOverview(false)
              }}
            />
          </div>
        )
      )}

      <div className={`admin-builder-layout${isDesktopBuilder ? ' is-resizable' : ''}${bankWindows.length > 0 ? ' has-extra-windows' : ''}`} style={builderLayoutStyle}>
        <aside className="admin-builder-panel admin-builder-bank">
          <div className="admin-builder-panel-head">
            <div><h2>Øktvelger</h2></div>
            <button type="button" className="builder-add-window-btn" onClick={handleAddBankWindow}>
              + Vindu
            </button>
          </div>

          {loadingTemplates ? (
            <div className="empty-state">Laster økter...</div>
          ) : (
            <div className="admin-builder-bank-grid">
              <BankPickerWindow
                isPrimary
                templates={templates}
                onDragStart={handleTemplateDragStart}
                onDragEnd={handleDragEnd}
                canRemove={false}
                onRemove={() => {}}
              />
            </div>
          )}
        </aside>

        {isDesktopBuilder && (
          <button
            type="button"
            className="builder-pane-resizer builder-pane-resizer-left"
            aria-label="Juster bredde mellom øktvelger og kalender"
            onPointerDown={event => {
              event.preventDefault()
              setActiveResizer({
                side: 'left',
                startX: event.clientX,
                startWidth: paneWidths.left,
              })
            }}
          />
        )}

        {bankWindows.length > 0 && (
          <aside className="admin-builder-panel admin-builder-extra-windows">
            <div className="admin-builder-panel-head">
              <div><h2>Vinduer</h2></div>
            </div>

            <div className="admin-builder-extra-windows-list">
              {bankWindows.map((window, index) => (
                <BankPickerWindow
                  key={window.id}
                  windowNumber={index + 2}
                  templates={templates}
                  onDragStart={handleTemplateDragStart}
                  onDragEnd={handleDragEnd}
                  canRemove
                  onRemove={() => handleRemoveBankWindow(window.id)}
                />
              ))}
            </div>
          </aside>
        )}

        {isDesktopBuilder && bankWindows.length > 0 && (
          <button
            type="button"
            className="builder-pane-resizer builder-pane-resizer-middle"
            aria-label="Juster bredde mellom aktivitetsvindu og kalender"
            onPointerDown={event => {
              event.preventDefault()
              setActiveResizer({
                side: 'middle',
                startX: event.clientX,
                startWidth: paneWidths.middle,
              })
            }}
          />
        )}

        <main className="admin-builder-panel admin-builder-calendar">
          <div className="admin-builder-panel-head">
            <div>
              <h2>Kalender</h2>
              <p>Slipp økter på ønsket dag. Eksisterende økter kan også dras mellom dager.</p>
            </div>
          </div>

          <div className="admin-builder-calendar-days">
            {loadingWorkouts ? (
              <div className="empty-state">Laster uke...</div>
            ) : (
              groupedWorkouts.map(day => (
                <section
                  key={day.value}
                  className={`program-day-section admin-program-day-section${dropTarget?.weekday === day.value ? ' drag-over' : ''}`}
                  onDragOver={event => {
                    event.preventDefault()
                    handleDropTargetChange(day.value)
                  }}
                  onDrop={async event => {
                    event.preventDefault()
                    await handleDrop(day.value)
                  }}
                >
                  <div className="program-day-header">
                    <div>
                      <h3 className="program-day-title">{day.label}</h3>
                      <div className="program-day-meta">
                        {day.workouts.length > 0 ? `${day.workouts.length} økt${day.workouts.length > 1 ? 'er' : ''}` : 'Ingen økter'}
                      </div>
                    </div>
                  </div>

                  <div className="program-day-slots admin-program-day-slots" style={{ '--slot-count': Math.max(2, day.workouts.length) }}>
                    {day.workouts.length === 0 ? (
                      <div
                        className={`program-day-empty-slot admin-program-day-empty-slot${dropTarget?.weekday === day.value && !dropTarget?.beforeWorkoutId ? ' drag-over' : ''}`}
                        onDragOver={event => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleDropTargetChange(day.value)
                        }}
                        onDrop={async event => {
                          event.preventDefault()
                          event.stopPropagation()
                          await handleDrop(day.value)
                        }}
                      >
                        Slipp økt her
                      </div>
                    ) : (
                      <>
                        {day.workouts.map((workout, index) => (
                          <BuilderWorkoutSlot
                            key={workout.id}
                            workout={workout}
                            index={index}
                            total={day.workouts.length}
                            isDragging={dragState?.kind === 'workout' && dragState.workoutId === workout.id}
                            isDropTarget={dropTarget?.weekday === day.value && dropTarget?.beforeWorkoutId === workout.id}
                            onClick={() => onSelectWorkout(workout)}
                            onMoveUp={() => onMoveWorkout(workout, -1)}
                            onMoveDown={() => onMoveWorkout(workout, 1)}
                            onDragStart={() => handleWorkoutDragStart(workout)}
                            onDragEnd={handleDragEnd}
                            onDragOver={event => {
                              event.preventDefault()
                              event.stopPropagation()
                              handleDropTargetChange(day.value, workout.id)
                            }}
                            onDrop={async event => {
                              event.preventDefault()
                              event.stopPropagation()
                              await handleDrop(day.value, workout.id)
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>

        {isDesktopBuilder && (
          <button
            type="button"
            className="builder-pane-resizer builder-pane-resizer-right"
            aria-label="Juster bredde mellom kalender og ukeoversikt"
            onPointerDown={event => {
              event.preventDefault()
              setActiveResizer({
                side: 'right',
                startX: event.clientX,
                startWidth: paneWidths.right,
              })
            }}
          />
        )}

        <aside className="admin-builder-panel admin-builder-insights">
          <div className="admin-builder-panel-head">
            <div>
              <h2>Ukeoversikt</h2>
              <p>Belastning og distanse oppdateres fortløpende.</p>
            </div>
          </div>

          <div className="builder-summary-grid">
            <MetricCard label="Økter" value={String(weekStats.sessionCount)} helper={`${weekStats.hardCount} harde / ${weekStats.easyCount} rolige`} />
            <MetricCard label="Tid" value={formatDurationLabel(weekStats.totalDuration)} helper="Estimert ut fra øktinnhold" />
            <MetricCard label="Load" value={String(weekStats.totalLoad)} helper="Tid vektet med intensitet" />
            <MetricCard label="Mekanisk load" value={String(weekStats.totalMechanicalLoad)} helper="Aktivitet, distanse og intensitet" />
          </div>

          <div className="builder-distance-panel">
            <div className="builder-section-title">Distanse per aktivitet</div>
            {weekStats.distanceByActivity.length === 0 ? (
              <div className="builder-empty-copy">Ingen distanse registrert ennå denne uken.</div>
            ) : (
              <div className="builder-distance-list">
                {weekStats.distanceByActivity.map(activity => (
                  <div key={activity.value} className="builder-distance-row">
                    <div className="builder-distance-label">
                      <span
                        className="activity-tag-pill compact"
                        style={{ '--tag-color': activity.color, '--tag-bg': activity.bg }}
                      >
                        <span className="activity-tag-icon" aria-hidden="true"><ActivityIcon name={activity.icon} className="tag-icon-svg" /></span>
                        <span>{activity.label}</span>
                      </span>
                    </div>
                    <strong>{formatKmValue(activity.total)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="builder-chart-card">
            <div className="builder-section-title">Belastning per dag</div>
            <div className="builder-chart-shell">
              <Bar data={dailyLoadChartData} options={builderChartOptions} />
            </div>
          </div>

          <div className="builder-chart-card">
            <div className="builder-section-title">Trend rundt valgt uke</div>
            <p className="builder-chart-copy">
              Viser noen uker før og etter med acute load, km, form og training readiness.
            </p>
            {loadingAnalysis ? (
              <div className="builder-empty-copy">Laster trend...</div>
            ) : (
              <>
                <div className="builder-trend-summary">
                  <span>Acute <strong>{Math.round(focusTrendWeek?.acuteLoad || 0)}</strong></span>
                  <span>Km <strong>{Number((focusTrendWeek?.distance || 0).toFixed(1))}</strong></span>
                  <span>Form <strong>{formatScore(focusTrendWeek?.averageFormScore || 0)}</strong></span>
                  <span>Readiness <strong>{Number((focusTrendWeek?.trainingReadiness || 0).toFixed(2))}</strong></span>
                </div>
                <div className="builder-chart-shell builder-chart-shell-tall">
                  <Line data={trendChartData} options={trendChartOptions} />
                </div>
              </>
            )}
          </div>

          <div className="builder-chart-card">
            <div className="builder-section-title">Belastningsmiks</div>
            {workouts.length === 0 ? (
              <div className="builder-empty-copy">Legg inn økter for å se fordeling.</div>
            ) : (
              <div className="builder-chart-shell">
                <Doughnut data={loadMixChartData} options={doughnutOptions} />
              </div>
            )}
          </div>

          <div className="builder-chart-card">
            <div className="builder-section-title">Distansefordeling</div>
            {weekStats.distanceByActivity.length === 0 ? (
              <div className="builder-empty-copy">Ingen distanse tilgjengelig for denne uken.</div>
            ) : (
              <div className="builder-chart-shell">
                <Doughnut data={distanceDistributionChartData} options={doughnutOptions} />
              </div>
            )}
          </div>

          <div className="builder-generator-card">
            <div className="builder-section-title">Automatisk generering</div>
            <p>Plassholder for automatisk generering av treningsplan. Denne kommer i neste iterasjon.</p>
            <button type="button" className="program-day-btn" disabled>
              Generer plan senere
            </button>
          </div>
        </aside>
      </div>

      {dragState && (
        <div
          className={`builder-trash-zone${dragState.kind === 'workout' ? ' visible' : ''}`}
          onDragOver={event => {
            if (dragState.kind !== 'workout') return
            event.preventDefault()
          }}
          onDrop={async event => {
            event.preventDefault()
            await handleTrashDrop()
          }}
        >
          <SystemIcon name="delete" className="system-icon" />
          <span>Slipp her for å slette økten</span>
        </div>
      )}
    </div>
  )
}

function SessionColumn({ title, subtitle, sessions, onDragStart, onDragEnd }) {
  return (
    <section className="builder-session-column">
      <div className="builder-session-column-head">
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>

      {sessions.length === 0 ? (
        <div className="builder-empty-copy">Ingen økter i denne kolonnen.</div>
      ) : (
        <div className="builder-session-list">
          {sessions.map(session => (
            <TemplateDragCard
              key={session.id}
              session={session}
              onDragStart={() => onDragStart(session)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BankPickerWindow({
  windowNumber,
  isPrimary = false,
  templates,
  onDragStart,
  onDragEnd,
  canRemove,
  onRemove,
}) {
  const [activeTagFilter, setActiveTagFilter] = useState(null)
  const [activeIntensityFilters, setActiveIntensityFilters] = useState([])

  const filteredTemplates = useMemo(() => (
    templates
      .filter(template => !activeTagFilter || template.activityTag === activeTagFilter)
      .filter(template => {
        if (activeIntensityFilters.length === 0) return true
        const zones = normalizeIntensityZones(template.type, template.intensityZone)
        return activeIntensityFilters.some(zone => zones.includes(zone))
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'nb'))
  ), [activeIntensityFilters, activeTagFilter, templates])

  const hardTemplates = useMemo(() => (
    filteredTemplates.filter(template => isHardWorkout(template))
  ), [filteredTemplates])

  const easyTemplates = useMemo(() => (
    filteredTemplates.filter(template => !isHardWorkout(template))
  ), [filteredTemplates])

  function toggleIntensityFilter(zone) {
    setActiveIntensityFilters(prev => (
      prev.includes(zone)
        ? prev.filter(currentZone => currentZone !== zone)
        : [...prev, zone].sort((a, b) => a - b)
    ))
  }

  return (
    <section className="builder-picker-window">
      {!isPrimary && (
        <div className="builder-session-column-head builder-bank-window-head">
          <div>
            <h3>Vindu {windowNumber}</h3>
            <span>{filteredTemplates.length} økter</span>
          </div>
          {canRemove ? <button type="button" className="builder-window-remove-btn" onClick={onRemove}>×</button> : <div />}
        </div>
      )}

      <div className="admin-tag-filter admin-builder-filter">
        <button
          type="button"
          className={`admin-tag-filter-btn${!activeTagFilter ? ' active' : ''}`}
          onClick={() => setActiveTagFilter(null)}
        >
          Alle aktiviteter
        </button>
        {ACTIVITY_TAGS.map(tag => (
          <button
            key={tag.value}
            type="button"
            className={`admin-tag-filter-btn${activeTagFilter === tag.value ? ' active' : ''}`}
            style={{ '--tag-color': tag.color, '--tag-bg': tag.bg }}
            onClick={() => setActiveTagFilter(activeTagFilter === tag.value ? null : tag.value)}
          >
            <span className="activity-tag-icon" aria-hidden="true"><ActivityIcon name={tag.icon} className="tag-icon-svg" /></span>
            <span>{tag.label}</span>
          </button>
        ))}
      </div>

      <div className="builder-intensity-filter">
        <button
          type="button"
          className={`admin-tag-filter-btn${activeIntensityFilters.length === 0 ? ' active' : ''}`}
          onClick={() => setActiveIntensityFilters([])}
        >
          Alle intensiteter
        </button>
        {[1, 2, 3, 4, 5].map(zone => {
          const colors = ZONE_COLORS[zone]
          return (
            <button
              key={zone}
              type="button"
              className={`zone-btn zone-btn-${zone}${activeIntensityFilters.includes(zone) ? ' active' : ''}`}
              onClick={() => toggleIntensityFilter(zone)}
              style={{ '--tag-color': colors.text, '--tag-bg': colors.bg }}
            >
              S{zone}
            </button>
          )
        })}
      </div>

      <div className="builder-picker-window-grid">
        <SessionColumn
          title="Hardøkter"
          subtitle={`${hardTemplates.length} økter`}
          sessions={hardTemplates}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <SessionColumn
          title="Rolige økter"
          subtitle={`${easyTemplates.length} økter`}
          sessions={easyTemplates}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </div>
    </section>
  )
}

function TemplateDragCard({ session, onDragStart, onDragEnd }) {
  const typeColors = TYPE_COLORS[session.type] || TYPE_COLORS.annet
  const icon = TYPE_ICONS[session.type] || 'AN'
  const loadTag = session.loadTag ? LOAD_TAG_MAP[session.loadTag] : null
  const intensityLabel = formatIntensityZoneLabel(normalizeIntensityZones(session.type, session.intensityZone))

  return (
    <div
      className="builder-session-card"
      style={{
        borderLeftColor: loadTag?.color || typeColors.border,
        background: loadTag?.bg || '#fff',
      }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="builder-session-card-top">
        <span className="card-icon"><ActivityIcon name={icon} className="ui-icon" /></span>
        <span className="drag-handle" title="Dra inn i kalender">⋮⋮</span>
      </div>
      <div className="admin-row-info">
        <span className="card-title">{session.title}</span>
        {intensityLabel && <span className="builder-intensity-chip">{intensityLabel}</span>}
      </div>
    </div>
  )
}

function BuilderWorkoutSlot({
  workout,
  index,
  total,
  isDragging,
  isDropTarget,
  onClick,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  const typeColors = TYPE_COLORS[workout.type] || TYPE_COLORS.annet
  const icon = TYPE_ICONS[workout.type] || 'AN'
  const loadTag = workout.loadTag ? LOAD_TAG_MAP[workout.loadTag] : null
  const scheduleLabel = formatWorkoutTime(workout) || formatWorkoutSchedule(workout, { includeWeekday: false })
  const intensityLabel = formatIntensityZoneLabel(normalizeIntensityZones(workout.type, workout.intensityZone))

  return (
    <div
      className={`admin-workout-slot${workout.completed ? ' completed' : ''}${isDragging ? ' dragging' : ''}${isDropTarget ? ' drag-over' : ''}`}
      style={{
        borderLeftColor: loadTag?.color || typeColors.border,
        background: loadTag?.bg || '#fff',
      }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="admin-slot-top">
        <span className="card-icon"><ActivityIcon name={icon} className="ui-icon" /></span>
        <div className="admin-slot-actions">
          <span className="drag-handle" title="Dra for å flytte">⋮⋮</span>
          <button className="reorder-btn" onClick={onMoveUp} disabled={index === 0} title="Flytt opp"><SystemIcon name="up" className="system-icon" /></button>
          <button className="reorder-btn" onClick={onMoveDown} disabled={index === total - 1} title="Flytt ned"><SystemIcon name="down" className="system-icon" /></button>
        </div>
      </div>

      <div className="admin-slot-main" onClick={onClick}>
        <div className="admin-row-info">
          {scheduleLabel && <span className="card-date">{scheduleLabel}</span>}
          <span className="card-title">{workout.title}</span>
          {intensityLabel && <span className="builder-intensity-chip">{intensityLabel}</span>}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, helper }) {
  return (
    <div className="builder-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  )
}
