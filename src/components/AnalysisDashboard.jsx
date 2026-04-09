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
  ACTIVITY_TAG_MAP,
  ACTIVITY_TAGS,
  ZONE_COLORS,
  estimateMechanicalLoad,
  estimateWorkoutDuration,
  estimateWorkoutLoad,
  formatDurationLabel,
  formatKmValue,
  formatWorkoutSchedule,
  getWorkoutDistance,
  isHardWorkout,
  normalizeIntensityZones,
} from '../utils'
import ActivityIcon from './ActivityIcon'

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

const nowMarkerPlugin = {
  id: 'nowMarker',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const index = pluginOptions?.index
    if (!Number.isInteger(index)) return

    const xScale = chart.scales.x
    const yScale = chart.scales.y
    if (!xScale || !yScale) return

    const x = xScale.getPixelForValue(index)
    if (!Number.isFinite(x)) return

    const top = yScale.top + 20
    const bottom = yScale.bottom
    const ctx = chart.ctx

    ctx.save()
    ctx.strokeStyle = pluginOptions.color || '#38bdf8'
    ctx.fillStyle = pluginOptions.color || '#38bdf8'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(x, top + 18)
    ctx.lineTo(x, bottom)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x - 7, top + 12)
    ctx.lineTo(x + 7, top + 12)
    ctx.closePath()
    ctx.fill()

    ctx.font = '700 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(pluginOptions.label || 'Na', x, top - 4)
    ctx.restore()
  },
}

ChartJS.register(nowMarkerPlugin)

const RANGE_OPTIONS = [
  { value: 6, label: '6 uker' },
  { value: 12, label: '12 uker' },
  { value: 20, label: '20 uker' },
]

const METRIC_OPTIONS = [
  { value: 'load', label: 'Load', shortLabel: 'Load', color: '#f97316' },
  { value: 'duration', label: 'Tid', shortLabel: 'Tid', color: '#10b981' },
  { value: 'distance', label: 'Distanse', shortLabel: 'Km', color: '#2563eb' },
  { value: 'count', label: 'Økter', shortLabel: 'Økter', color: '#8b5cf6' },
]

function getWeekLabel(week) {
  return `Uke ${week.week}`
}

function clampWindowStart(nextStart, totalWeeks, range) {
  const maxStart = Math.max(0, totalWeeks - range)
  return Math.min(Math.max(0, nextStart), maxStart)
}

function safeDivide(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0
  return a / b
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getStandardDeviation(values) {
  if (!values.length) return 0
  const mean = average(values)
  const variance = average(values.map(value => (value - mean) ** 2))
  return Math.sqrt(variance)
}

function sumLastValues(values, count, endIndexInclusive) {
  const start = Math.max(0, endIndexInclusive - count + 1)
  return values.slice(start, endIndexInclusive + 1).reduce((sum, value) => sum + value, 0)
}

function averageLastValues(values, count, endIndexInclusive) {
  const start = Math.max(0, endIndexInclusive - count + 1)
  const slice = values.slice(start, endIndexInclusive + 1)
  return average(slice)
}

function formatMetricValue(metric, value) {
  if (!Number.isFinite(value) || value <= 0) {
    return metric === 'distance' ? '0 km' : metric === 'duration' ? '0m' : '0'
  }

  if (metric === 'distance') return formatKmValue(value)
  if (metric === 'duration') return formatDurationLabel(Math.round(value))
  if (metric === 'count') return `${Math.round(value)} økter`
  return `${Math.round(value)}`
}

function formatDelta(value, suffix = '%') {
  if (!Number.isFinite(value)) return '0%'
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`
}

function formatScore(value) {
  if (!Number.isFinite(value) || value <= 0) return '0.0'
  return value.toFixed(1)
}

function getWeekMetricValue(week, metric) {
  if (metric === 'distance') return week.distance
  if (metric === 'duration') return week.duration
  if (metric === 'count') return week.count
  return week.load
}

function getMetricTooltip(metric) {
  if (metric === 'distance') return 'Kilometer per uke, aggregert pa tvers av alle relevante aktiviteter.'
  if (metric === 'duration') return 'Estimert total treningstid i analyseperioden.'
  if (metric === 'count') return 'Antall planlagte okter.'
  return 'Estimert treningsbelastning basert pa varighet og intensitet.'
}

function HeatCell({ week, weekdayIndex, weekdayLabel }) {
  const load = week.dailyLoads[weekdayIndex] || 0
  const duration = week.dailyDurations[weekdayIndex] || 0
  const intensity = Math.min(1, load / 220)
  const alpha = load > 0 ? 0.16 + intensity * 0.84 : 0.06

  return (
    <div
      className={`analysis-heatmap-cell${load > 0 ? ' active' : ''}`}
      title={`${weekdayLabel}: ${Math.round(load)} load · ${formatDurationLabel(duration)}`}
      style={{ background: `rgba(37, 99, 235, ${alpha})` }}
    >
      <span>{load > 0 ? Math.round(load) : ''}</span>
    </div>
  )
}

function TopWorkoutCard({ workout }) {
  const activity = ACTIVITY_TAG_MAP[workout.activityTag]

  return (
    <article className="analysis-top-workout">
      <div className="analysis-top-workout-icon" style={{ '--activity-color': activity?.color || '#64748b', '--activity-bg': activity?.bg || '#f1f5f9' }}>
        <ActivityIcon name={activity?.icon || 'annet'} className="analysis-top-workout-svg" />
      </div>
      <div className="analysis-top-workout-main">
        <div className="analysis-top-workout-head">
          <strong>{workout.title || 'Uten tittel'}</strong>
          <span className="analysis-chip neutral">{Math.round(workout.load)} load</span>
        </div>
        <div className="analysis-top-workout-meta">
          <span>{activity?.label || 'Aktivitet'}</span>
          <span>{formatWorkoutSchedule(workout, { includeWeekday: true, includeDate: true })}</span>
          <span>{formatDurationLabel(workout.duration)}</span>
          {workout.distance > 0 ? <span>{formatKmValue(workout.distance)}</span> : null}
        </div>
      </div>
    </article>
  )
}

export default function AnalysisDashboard({ weeks, workoutsByWeekKey, athleteName, currentWeek, currentYear }) {
  const [range, setRange] = useState(12)
  const [activeTagFilter, setActiveTagFilter] = useState(null)
  const [primaryMetric, setPrimaryMetric] = useState('load')
  const currentIndex = useMemo(
    () => weeks.findIndex(week => week.week === currentWeek && week.year === currentYear),
    [weeks, currentWeek, currentYear]
  )
  const [windowStart, setWindowStart] = useState(() => clampWindowStart(
    currentIndex === -1 ? 0 : currentIndex - Math.floor(12 / 2),
    weeks.length,
    12
  ))
  const maxWindowStart = Math.max(0, weeks.length - range)

  useEffect(() => {
    const centeredStart = clampWindowStart(
      currentIndex === -1 ? maxWindowStart : currentIndex - Math.floor(range / 2),
      weeks.length,
      range
    )

    setWindowStart(prev => {
      if (prev > maxWindowStart) return maxWindowStart
      if (currentIndex !== -1 && (currentIndex < prev || currentIndex >= prev + range)) {
        return centeredStart
      }
      return prev
    })
  }, [weeks.length, range, currentIndex, maxWindowStart])

  const visibleWeeks = useMemo(() => {
    return weeks.slice(windowStart, windowStart + range)
  }, [weeks, windowStart, range])

  const analysis = useMemo(() => {
    const weeklyStats = visibleWeeks.map(week => {
      let weekWorkouts = workoutsByWeekKey[week.key] || []

      if (activeTagFilter) {
        weekWorkouts = weekWorkouts.filter(workout => workout.activityTag === activeTagFilter)
      }

      const dailyLoads = Array(7).fill(0)
      const dailyDurations = Array(7).fill(0)
      const activityLoad = {}
      const activityDuration = {}
      const tags = {}
      const zones = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      const zoneLoads = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

      const workouts = weekWorkouts.map(workout => {
        const duration = estimateWorkoutDuration(workout)
        const load = estimateWorkoutLoad(workout)
        const distance = getWorkoutDistance(workout) || 0
        const mechanicalLoad = estimateMechanicalLoad(workout)
        const normalizedZones = normalizeIntensityZones(workout.type, workout.intensityZone)
        const weekdayIndex = Math.max(0, Math.min(6, Number(workout.weekday || 1) - 1))
        const activityTag = workout.activityTag || 'unknown'

        dailyLoads[weekdayIndex] += load
        dailyDurations[weekdayIndex] += duration
        tags[activityTag] = (tags[activityTag] || 0) + 1
        activityLoad[activityTag] = (activityLoad[activityTag] || 0) + load
        activityDuration[activityTag] = (activityDuration[activityTag] || 0) + duration

        if (normalizedZones.length > 0 && duration > 0) {
          const zoneShare = duration / normalizedZones.length
          const zoneLoadShare = load / normalizedZones.length
          normalizedZones.forEach(zone => {
            zones[zone] += zoneShare
            zoneLoads[zone] += zoneLoadShare
          })
        }

        return {
          ...workout,
          duration,
          load,
          distance,
          mechanicalLoad,
          normalizedZones,
          activityTag,
        }
      })

      const hardSessions = workouts.filter(isHardWorkout).length
      const duration = workouts.reduce((sum, workout) => sum + workout.duration, 0)
      const load = workouts.reduce((sum, workout) => sum + workout.load, 0)
      const mechanicalLoad = workouts.reduce((sum, workout) => sum + workout.mechanicalLoad, 0)
      const distance = workouts.reduce((sum, workout) => sum + workout.distance, 0)
      const longestSession = workouts.reduce((longest, workout) => {
        if (!longest || workout.duration > longest.duration) return workout
        return longest
      }, null)
      const workoutsWithForm = workouts.filter(workout => Number.isFinite(workout.formScore))
      const workoutsWithSurplus = workouts.filter(workout => Number.isFinite(workout.surplusScore))
      const averageFormScore = average(workoutsWithForm.map(workout => workout.formScore))
      const averageSurplusScore = average(workoutsWithSurplus.map(workout => workout.surplusScore))
      const readinessSubjectiveScore = average(
        [averageFormScore, averageSurplusScore].filter(score => Number.isFinite(score) && score > 0)
      )

      return {
        week,
        workouts,
        count: workouts.length,
        distance,
        duration,
        load,
        mechanicalLoad,
        hardSessions,
        easySessions: Math.max(0, workouts.length - hardSessions),
        zones,
        zoneLoads,
        tags,
        activityLoad,
        activityDuration,
        dailyLoads,
        dailyDurations,
        longestSession,
        averageFormScore,
        averageSurplusScore,
        readinessSubjectiveScore,
      }
    })

    const currentWeekIndex = weeklyStats.findIndex(week => week.week.week === currentWeek && week.week.year === currentYear)
    const focusWeekIndex = currentWeekIndex >= 0 ? currentWeekIndex : weeklyStats.length - 1
    const focusWeek = weeklyStats[focusWeekIndex] || null
    const hasData = weeklyStats.some(week => week.count > 0)
    const allWorkouts = weeklyStats.flatMap(week => week.workouts)
    const loadSeries = weeklyStats.map(week => week.load)

    const weeklyStatsWithSignals = weeklyStats.map((week, index) => {
      const acuteLoad = averageLastValues(loadSeries, 3, index)
      const chronicLoad = averageLastValues(loadSeries, 6, index)
      const readinessRatio = safeDivide(acuteLoad, chronicLoad)
      return {
        ...week,
        acuteLoad,
        chronicLoad,
        readinessRatio,
      }
    })

    const totals = weeklyStatsWithSignals.reduce((acc, week) => {
      acc.distance += week.distance
      acc.duration += week.duration
      acc.load += week.load
      acc.mechanicalLoad += week.mechanicalLoad
      acc.count += week.count
      acc.hardSessions += week.hardSessions
      return acc
    }, {
      distance: 0,
      duration: 0,
      load: 0,
      mechanicalLoad: 0,
      count: 0,
      hardSessions: 0,
    })

    const zoneTotals = weeklyStatsWithSignals.reduce((acc, week) => {
      Object.entries(week.zones).forEach(([zone, minutes]) => {
        acc[zone] = (acc[zone] || 0) + minutes
      })
      return acc
    }, {})

    const zoneLoadTotals = weeklyStatsWithSignals.reduce((acc, week) => {
      Object.entries(week.zoneLoads).forEach(([zone, load]) => {
        acc[zone] = (acc[zone] || 0) + load
      })
      return acc
    }, {})

    const activityTotals = weeklyStatsWithSignals.reduce((acc, week) => {
      Object.entries(week.activityLoad).forEach(([activityTag, load]) => {
        if (!acc[activityTag]) {
          acc[activityTag] = {
            load: 0,
            duration: 0,
            distance: 0,
            count: 0,
          }
        }
        acc[activityTag].load += load
      })

      Object.entries(week.activityDuration).forEach(([activityTag, duration]) => {
        if (!acc[activityTag]) {
          acc[activityTag] = {
            load: 0,
            duration: 0,
            distance: 0,
            count: 0,
          }
        }
        acc[activityTag].duration += duration
      })

      week.workouts.forEach(workout => {
        const activityTag = workout.activityTag || 'unknown'
        if (!acc[activityTag]) {
          acc[activityTag] = {
            load: 0,
            duration: 0,
            distance: 0,
            count: 0,
          }
        }
        acc[activityTag].distance += workout.distance
        acc[activityTag].count += 1
      })

      return acc
    }, {})

    const topActivityEntries = Object.entries(activityTotals)
      .sort(([, a], [, b]) => b.load - a.load)
      .slice(0, 5)

    const peakWeek = weeklyStatsWithSignals.reduce((best, week) => {
      if (!best || getWeekMetricValue(week, primaryMetric) > getWeekMetricValue(best, primaryMetric)) {
        return week
      }
      return best
    }, null)

    const recentIndex = Math.max(0, weeklyStatsWithSignals.length - 1)
    const recentValue = sumLastValues(
      weeklyStatsWithSignals.map(week => getWeekMetricValue(week, primaryMetric)),
      3,
      recentIndex
    )
    const previousValue = sumLastValues(
      weeklyStatsWithSignals.map(week => getWeekMetricValue(week, primaryMetric)),
      3,
      Math.max(0, recentIndex - 3)
    )
    const trendDelta = previousValue > 0 ? ((recentValue - previousValue) / previousValue) * 100 : 0

    const focusDailyLoads = focusWeek?.dailyLoads || []
    const monotony = (() => {
      const activeDays = focusDailyLoads.filter(value => value > 0)
      if (activeDays.length < 2) return 0
      return safeDivide(average(activeDays), getStandardDeviation(activeDays))
    })()

    const strain = focusWeek ? Math.round(focusWeek.load * monotony) : 0
    const density = totals.duration > 0 ? Math.round((totals.load / totals.duration) * 60) : 0
    const consistencyScore = weeklyStatsWithSignals.length > 0
      ? Math.round((weeklyStatsWithSignals.filter(week => week.count >= 3).length / weeklyStatsWithSignals.length) * 100)
      : 0
    const weeksWithSubjectiveData = weeklyStatsWithSignals.filter(
      week => week.averageFormScore > 0 || week.averageSurplusScore > 0
    )
    const formTrendScore = average(weeksWithSubjectiveData.map(week => week.averageFormScore))
    const surplusTrendScore = average(weeksWithSubjectiveData.map(week => week.averageSurplusScore))

    const topWorkouts = allWorkouts
      .slice()
      .sort((a, b) => b.load - a.load)
      .slice(0, 5)

    return {
      weeklyStats: weeklyStatsWithSignals,
      focusWeek,
      hasData,
      totals,
      zoneTotals,
      zoneLoadTotals,
      topActivityEntries,
      peakWeek,
      trendDelta,
      monotony,
      strain,
      density,
      consistencyScore,
      formTrendScore,
      surplusTrendScore,
      topWorkouts,
    }
  }, [visibleWeeks, workoutsByWeekKey, activeTagFilter, currentWeek, currentYear, primaryMetric])

  const {
    weeklyStats,
    focusWeek,
    hasData,
    totals,
    zoneTotals,
    zoneLoadTotals,
    topActivityEntries,
    peakWeek,
    trendDelta,
    monotony,
    strain,
    density,
    consistencyScore,
    formTrendScore,
    surplusTrendScore,
    topWorkouts,
  } = analysis

  const labels = weeklyStats.map(({ week }) => getWeekLabel(week))
  const selectedMetricMeta = METRIC_OPTIONS.find(option => option.value === primaryMetric) || METRIC_OPTIONS[0]
  const visibleStartWeek = visibleWeeks[0] || null
  const visibleEndWeek = visibleWeeks[visibleWeeks.length - 1] || null
  const isCurrentWeekVisible = currentIndex >= windowStart && currentIndex < windowStart + range
  const timelineProgress = maxWindowStart > 0 ? Math.round((windowStart / maxWindowStart) * 100) : 0
  const currentVisibleIndex = isCurrentWeekVisible ? currentIndex - windowStart : null

  const performanceChartData = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: selectedMetricMeta.label,
        data: weeklyStats.map(week => Number(getWeekMetricValue(week, primaryMetric).toFixed(1))),
        backgroundColor: context => {
          const chart = context.chart
          const { chartArea } = chart
          if (!chartArea) return 'rgba(37, 99, 235, 0.75)'
          const gradient = chart.ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, 'rgba(15, 23, 42, 0.08)')
          gradient.addColorStop(0.15, `${selectedMetricMeta.color}88`)
          gradient.addColorStop(1, selectedMetricMeta.color)
          return gradient
        },
        borderRadius: 14,
        borderSkipped: false,
        order: 2,
      },
      {
        type: 'line',
        label: '3-ukers glidende snitt',
        data: weeklyStats.map((_, index) => Number(averageLastValues(
          weeklyStats.map(week => getWeekMetricValue(week, primaryMetric)),
          3,
          index
        ).toFixed(1))),
        borderColor: '#0f172a',
        pointBackgroundColor: '#0f172a',
        pointBorderWidth: 0,
        pointRadius: 3,
        tension: 0.34,
        order: 1,
      },
    ],
  }

  const balanceChartData = {
    labels,
    datasets: [
      {
        label: 'Ukesload',
        data: weeklyStats.map(week => week.load),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.16)',
        fill: true,
        tension: 0.32,
        pointRadius: 3,
      },
      {
        label: 'Akutt (3 uker)',
        data: weeklyStats.map(week => Number(week.acuteLoad.toFixed(1))),
        borderColor: '#2563eb',
        tension: 0.28,
        pointRadius: 2,
      },
      {
        label: 'Kronisk (6 uker)',
        data: weeklyStats.map(week => Number(week.chronicLoad.toFixed(1))),
        borderColor: '#16a34a',
        tension: 0.28,
        pointRadius: 2,
      },
      {
        label: 'Akutt/kronisk',
        data: weeklyStats.map(week => Number(week.readinessRatio.toFixed(2))),
        borderColor: '#7c3aed',
        backgroundColor: '#7c3aed',
        pointRadius: 2,
        borderDash: [6, 6],
        yAxisID: 'y1',
        tension: 0.22,
      },
    ],
  }

  const activityStackChartData = {
    labels,
    datasets: ACTIVITY_TAGS.map(tag => ({
      label: tag.label,
      data: weeklyStats.map(week => Math.round((week.activityLoad[tag.value] || 0) * 10) / 10),
      backgroundColor: tag.color,
      borderRadius: 8,
      borderSkipped: false,
      stack: 'activity',
    })).filter(dataset => dataset.data.some(value => value > 0)),
  }

  const zoneDurationChartData = {
    labels: Object.entries(zoneTotals)
      .filter(([, minutes]) => minutes > 0)
      .map(([zone]) => `Sone ${zone}`),
    datasets: [{
      data: Object.entries(zoneTotals)
        .filter(([, minutes]) => minutes > 0)
        .map(([, minutes]) => Math.round(minutes)),
      backgroundColor: Object.entries(zoneTotals)
        .filter(([, minutes]) => minutes > 0)
        .map(([zone]) => ZONE_COLORS[zone]?.border || '#94a3b8'),
      borderWidth: 0,
      hoverOffset: 10,
    }],
  }

  const zoneLoadChartData = {
    labels: Object.entries(zoneLoadTotals)
      .filter(([, load]) => load > 0)
      .map(([zone]) => `Sone ${zone}`),
    datasets: [{
      data: Object.entries(zoneLoadTotals)
        .filter(([, load]) => load > 0)
        .map(([, load]) => Math.round(load)),
      backgroundColor: Object.entries(zoneLoadTotals)
        .filter(([, load]) => load > 0)
        .map(([zone]) => ZONE_COLORS[zone]?.border || '#94a3b8'),
      borderWidth: 0,
      hoverOffset: 10,
    }],
  }

  const activityShareChartData = {
    labels: topActivityEntries.map(([activityTag]) => ACTIVITY_TAG_MAP[activityTag]?.label || 'Annet'),
    datasets: [{
      data: topActivityEntries.map(([, stats]) => Math.round(stats.load)),
      backgroundColor: topActivityEntries.map(([activityTag]) => ACTIVITY_TAG_MAP[activityTag]?.color || '#94a3b8'),
      borderWidth: 0,
      hoverOffset: 10,
    }],
  }

  const subjectiveChartData = {
    labels,
    datasets: [
      {
        label: 'Form',
        data: weeklyStats.map(week => Number(week.averageFormScore.toFixed(2))),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.14)',
        tension: 0.3,
        pointRadius: 3,
      },
      {
        label: 'Overskudd',
        data: weeklyStats.map(week => Number(week.averageSurplusScore.toFixed(2))),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.14)',
        tension: 0.3,
        pointRadius: 3,
      },
      {
        label: 'Subjektiv race readiness',
        data: weeklyStats.map(week => Number(week.readinessSubjectiveScore.toFixed(2))),
        borderColor: '#7c3aed',
        backgroundColor: '#7c3aed',
        borderDash: [6, 6],
        tension: 0.24,
        pointRadius: 2,
      },
    ],
  }

  const performanceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          boxWidth: 10,
          font: { size: 11, weight: '600' },
        },
      },
      tooltip: {
        intersect: false,
        mode: 'index',
      },
      nowMarker: {
        index: currentVisibleIndex,
        label: 'Na',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11, weight: '700' } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
    },
  }

  const balanceOptions = {
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
          padding: 16,
          boxWidth: 10,
          font: { size: 11, weight: '600' },
        },
      },
      nowMarker: {
        index: currentVisibleIndex,
        label: 'Na',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11, weight: '700' } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y1: {
        position: 'right',
        min: 0,
        grid: { drawOnChartArea: false },
        ticks: { color: '#7c3aed', font: { size: 11, weight: '700' } },
      },
    },
  }

  const subjectiveOptions = {
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
          padding: 16,
          boxWidth: 10,
          font: { size: 11, weight: '600' },
        },
      },
      nowMarker: {
        index: currentVisibleIndex,
        label: 'Na',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11, weight: '700' } },
      },
      y: {
        min: 1,
        max: 10,
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
    },
  }

  const stackedOptions = {
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
      tooltip: {
        callbacks: {
          label: context => `${context.dataset.label}: ${Math.round(context.parsed.y)} load`,
        },
      },
      nowMarker: {
        index: currentVisibleIndex,
        label: 'Na',
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11, weight: '700' } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: { color: '#64748b', font: { size: 11 } },
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
          padding: 14,
          boxWidth: 10,
          font: { size: 11, weight: '600' },
        },
      },
      tooltip: {
        callbacks: {
          label: context => `${context.label}: ${context.raw}`,
        },
      },
    },
    cutout: '64%',
  }

  return (
    <section className="analysis-dashboard analysis-dashboard-advanced">
      <div className="analysis-hero">
        <div className="analysis-hero-copy">
          <span className="analysis-eyebrow">Performance Lab</span>
          <h2 className="analysis-title">Analyse</h2>
          <p className="analysis-subtitle">
            {athleteName ? `${athleteName} · ` : ''}
            Multi-aktivitet analyse med fokus pa volum, belastning, readiness, frekvens og soneprofil.
          </p>
        </div>

        <div className="analysis-control-stack">
          <div className="analysis-range-selector">
            {RANGE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`range-btn${range === option.value ? ' active' : ''}`}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="analysis-metric-toggle" role="tablist" aria-label="Velg primarmetrikk">
            {METRIC_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`analysis-metric-btn${primaryMetric === option.value ? ' active' : ''}`}
                onClick={() => setPrimaryMetric(option.value)}
                style={{ '--metric-color': option.color }}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>

          <div className="analysis-timeline-shell">
            <div className="analysis-window-nav">
              <button
                type="button"
                className="analysis-window-btn"
                onClick={() => setWindowStart(prev => clampWindowStart(prev - Math.max(1, Math.floor(range / 2)), weeks.length, range))}
                disabled={windowStart <= 0}
                aria-label="Flytt analysevindu bakover"
              >
                &#8249;
              </button>
              <div className="analysis-window-meta">
                <span className="analysis-window-kicker">Tidsvindu</span>
                <strong>
                  {visibleStartWeek ? getWeekLabel(visibleStartWeek) : 'Ingen data'}
                  {visibleEndWeek ? ` - ${getWeekLabel(visibleEndWeek)}` : ''}
                </strong>
                <span>
                  {isCurrentWeekVisible ? 'Navaerende uke er i vinduet' : 'Scroller du her kan du lese tidligere blokker og perioder framover'}
                </span>
              </div>
              <button
                type="button"
                className="analysis-window-btn"
                onClick={() => setWindowStart(prev => clampWindowStart(prev + Math.max(1, Math.floor(range / 2)), weeks.length, range))}
                disabled={windowStart >= maxWindowStart}
                aria-label="Flytt analysevindu fremover"
              >
                &#8250;
              </button>
            </div>

            <div className="analysis-window-slider-wrap">
              <label className="analysis-window-slider">
                <div className="analysis-window-slider-head">
                  <span>Historikk</span>
                  <span>{timelineProgress}% gjennom perioden</span>
                  <span>Framtid</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={String(maxWindowStart)}
                  step="1"
                  value={windowStart}
                  onChange={event => setWindowStart(Number(event.target.value))}
                />
              </label>

              <button
                type="button"
                className="analysis-window-reset"
                onClick={() => setWindowStart(clampWindowStart(currentIndex - Math.floor(range / 2), weeks.length, range))}
                disabled={currentIndex === -1}
              >
                Sentrer pa na
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="analysis-tag-filter">
        <button
          type="button"
          className={`tag-filter-btn${!activeTagFilter ? ' active' : ''}`}
          onClick={() => setActiveTagFilter(null)}
        >
          Alle aktiviteter
        </button>
        {ACTIVITY_TAGS.map(tag => (
          <button
            key={tag.value}
            type="button"
            className={`tag-filter-btn${activeTagFilter === tag.value ? ' active' : ''}`}
            style={{ '--tag-color': tag.color, '--tag-bg': tag.bg }}
            onClick={() => setActiveTagFilter(activeTagFilter === tag.value ? null : tag.value)}
          >
            <span className="activity-tag-icon" aria-hidden="true">
              <ActivityIcon name={tag.icon} className="tag-icon-svg" />
            </span>
            <span>{tag.label}</span>
          </button>
        ))}
      </div>

      {!hasData ? (
        <div className="analysis-empty">
          <div className="empty-icon">AN</div>
          <div>Ingen okter i valgt analyseperiode.</div>
        </div>
      ) : (
        <>
          <div className="analysis-summary analysis-summary-rich">
            <article className="summary-card highlight">
              <span className="summary-label">{selectedMetricMeta.label}</span>
              <strong className="summary-value">{formatMetricValue(primaryMetric, totals[primaryMetric] || 0)}</strong>
              <span className="summary-footnote">{getMetricTooltip(primaryMetric)}</span>
            </article>

            <article className="summary-card">
              <span className="summary-label">Trend siste 3 uker</span>
              <strong className={`summary-value ${trendDelta >= 0 ? 'positive' : 'negative'}`}>{formatDelta(trendDelta)}</strong>
              <span className="summary-footnote">Sammenlignet med de tre foregaende ukene.</span>
            </article>

            <article className="summary-card">
              <span className="summary-label">Readiness ratio</span>
              <strong className="summary-value">{focusWeek?.readinessRatio ? focusWeek.readinessRatio.toFixed(2) : '0.00'}</strong>
              <span className="summary-footnote">Akutt / kronisk load. Rundt 0.8-1.3 er ofte robust.</span>
            </article>

            <article className="summary-card">
              <span className="summary-label">Tetthet</span>
              <strong className="summary-value">{density}</strong>
              <span className="summary-footnote">Load per time. Hoy verdi betyr mye kvalitet per time.</span>
            </article>

            <article className="summary-card">
              <span className="summary-label">Monotoni</span>
              <strong className="summary-value">{monotony ? monotony.toFixed(2) : '0.00'}</strong>
              <span className="summary-footnote">Lite variasjon dag til dag gir hoyere monotoni.</span>
            </article>

            <article className="summary-card">
              <span className="summary-label">Konsistens</span>
              <strong className="summary-value">{consistencyScore}%</strong>
              <span className="summary-footnote">Andel uker med minst tre okter.</span>
            </article>

            <article className="summary-card">
              <span className="summary-label">Formsnitt</span>
              <strong className="summary-value">{formatScore(formTrendScore)}</strong>
              <span className="summary-footnote">Snitt av subjektiv form per okt i dette vinduet.</span>
            </article>

            <article className="summary-card">
              <span className="summary-label">Overskuddssnitt</span>
              <strong className="summary-value">{formatScore(surplusTrendScore)}</strong>
              <span className="summary-footnote">Snitt av opplevd overskudd, nyttig inn mot konkurranse.</span>
            </article>
          </div>

          <div className="analysis-insight-grid">
            <article className="analysis-insight-card emphasis">
              <div className="analysis-section-heading">
                <span className="analysis-section-kicker">Fokusuke</span>
                <h3>Uke {focusWeek?.week.week}</h3>
              </div>
              <div className="analysis-focus-metrics">
                <div>
                  <span>Load</span>
                  <strong>{Math.round(focusWeek?.load || 0)}</strong>
                </div>
                <div>
                  <span>Tid</span>
                  <strong>{formatDurationLabel(Math.round(focusWeek?.duration || 0))}</strong>
                </div>
                <div>
                  <span>Distanse</span>
                  <strong>{formatKmValue(focusWeek?.distance || 0)}</strong>
                </div>
                <div>
                  <span>Harde okter</span>
                  <strong>{focusWeek?.hardSessions || 0}</strong>
                </div>
              </div>
              <div className="analysis-focus-annotations">
                <span className="analysis-chip">Strain {strain}</span>
                <span className="analysis-chip neutral">Mekanisk load {Math.round(focusWeek?.mechanicalLoad || 0)}</span>
                {focusWeek?.longestSession ? (
                  <span className="analysis-chip neutral">
                    Lengste okt {formatDurationLabel(focusWeek.longestSession.duration)}
                  </span>
                ) : null}
                <span className="analysis-chip neutral">
                  Form {formatScore(focusWeek?.averageFormScore || 0)} / Overskudd {formatScore(focusWeek?.averageSurplusScore || 0)}
                </span>
              </div>
            </article>

            <article className="analysis-insight-card">
              <div className="analysis-section-heading">
                <span className="analysis-section-kicker">Peak week</span>
                <h3>{peakWeek ? `${getWeekLabel(peakWeek.week)}` : 'Ingen data'}</h3>
              </div>
              <p className="analysis-panel-copy">
                Toppuke pa valgt metrikk med {peakWeek ? formatMetricValue(primaryMetric, getWeekMetricValue(peakWeek, primaryMetric)) : '0'}.
              </p>
              <div className="analysis-mini-stats">
                <div>
                  <span>Load</span>
                  <strong>{Math.round(peakWeek?.load || 0)}</strong>
                </div>
                <div>
                  <span>Tid</span>
                  <strong>{formatDurationLabel(Math.round(peakWeek?.duration || 0))}</strong>
                </div>
                <div>
                  <span>Harde</span>
                  <strong>{peakWeek?.hardSessions || 0}</strong>
                </div>
              </div>
            </article>

            <article className="analysis-insight-card">
              <div className="analysis-section-heading">
                <span className="analysis-section-kicker">Aktivitetssignatur</span>
                <h3>Hvor belastningen kommer fra</h3>
              </div>
              <div className="analysis-activity-list">
                {topActivityEntries.length > 0 ? topActivityEntries.map(([activityTag, stats]) => {
                  const activity = ACTIVITY_TAG_MAP[activityTag]
                  const loadShare = totals.load > 0 ? Math.round((stats.load / totals.load) * 100) : 0
                  return (
                    <div key={activityTag} className="analysis-activity-row">
                      <div className="analysis-activity-meta">
                        <span className="analysis-activity-badge" style={{ '--activity-color': activity?.color || '#64748b', '--activity-bg': activity?.bg || '#f1f5f9' }}>
                          <ActivityIcon name={activity?.icon || 'annet'} className="analysis-activity-svg" />
                        </span>
                        <div>
                          <strong>{activity?.label || 'Annet'}</strong>
                          <span>{stats.count} okter · {formatDurationLabel(Math.round(stats.duration))}</span>
                        </div>
                      </div>
                      <div className="analysis-activity-values">
                        <strong>{loadShare}%</strong>
                        <span>{Math.round(stats.load)} load</span>
                      </div>
                    </div>
                  )
                }) : <div className="chart-empty">Ingen aktivitetsdata</div>}
              </div>
            </article>
          </div>

          <div className="analysis-chart-grid analysis-chart-grid-advanced">
            <div className="analysis-chart-card wide feature">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Performance trend</h3>
                  <p className="chart-caption">Bytt mellom load, tid, distanse og frekvens for a lese periodiseringen fra flere vinkler.</p>
                </div>
              </div>
              <div className="chart-container xl">
                <Bar data={performanceChartData} options={performanceOptions} />
              </div>
            </div>

            <div className="analysis-chart-card wide">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Load balance</h3>
                  <p className="chart-caption">Akutt og kronisk last med ratio-linje for a spotte topper, blokkperioder og behov for avlastning.</p>
                </div>
              </div>
              <div className="chart-container xl">
                <Line data={balanceChartData} options={balanceOptions} />
              </div>
            </div>

            <div className="analysis-chart-card wide">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Form og overskudd</h3>
                  <p className="chart-caption">Subjektive scorer per uke for a lese om utoveren faktisk blir skarpere inn mot konkuranser.</p>
                </div>
              </div>
              <div className="chart-container xl">
                <Line data={subjectiveChartData} options={subjectiveOptions} />
              </div>
            </div>

            <div className="analysis-chart-card wide">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Aktivitetsmiks per uke</h3>
                  <p className="chart-caption">Stablede load-barer viser hvordan ulike idretter bygger totalbelastningen.</p>
                </div>
              </div>
              <div className="chart-container xl">
                {activityStackChartData.datasets.length > 0
                  ? <Bar data={activityStackChartData} options={stackedOptions} />
                  : <div className="chart-empty">Ingen aktivitetsdata</div>}
              </div>
            </div>

            <div className="analysis-chart-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Sonefordeling tid</h3>
                  <p className="chart-caption">Estimert tidsbruk per sone, fordelt fra oktenes varighet og intensitetsprofil.</p>
                </div>
              </div>
              <div className="chart-container doughnut">
                {zoneDurationChartData.datasets[0].data.length > 0
                  ? <Doughnut data={zoneDurationChartData} options={doughnutOptions} />
                  : <div className="chart-empty">Ingen sonedata</div>}
              </div>
            </div>

            <div className="analysis-chart-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Sonefordeling load</h3>
                  <p className="chart-caption">Belastning splittet per sone, nyttig nar hoyintensiv jobb driver mer stress enn minuttene antyder.</p>
                </div>
              </div>
              <div className="chart-container doughnut">
                {zoneLoadChartData.datasets[0].data.length > 0
                  ? <Doughnut data={zoneLoadChartData} options={doughnutOptions} />
                  : <div className="chart-empty">Ingen sonedata</div>}
              </div>
            </div>

            <div className="analysis-chart-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Load share</h3>
                  <p className="chart-caption">Aktiviteter rangert etter hvor mye de faktisk bidrar til total treningsstress.</p>
                </div>
              </div>
              <div className="chart-container doughnut">
                {activityShareChartData.datasets[0].data.length > 0
                  ? <Doughnut data={activityShareChartData} options={doughnutOptions} />
                  : <div className="chart-empty">Ingen aktivitetsdata</div>}
              </div>
            </div>
          </div>

          <div className="analysis-bottom-grid">
            <article className="analysis-surface-card">
              <div className="analysis-section-heading">
                <span className="analysis-section-kicker">Ukerytme</span>
                <h3>Load heatmap</h3>
              </div>
              <p className="analysis-panel-copy">
                En rask lesning av hvor belastningen lander i uka. Morkere felt betyr hardere dager.
              </p>
              <div className="analysis-heatmap">
                <div className="analysis-heatmap-header">
                  <span>Uke</span>
                  {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lor', 'Son'].map(day => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                {weeklyStats.map(week => (
                  <div key={week.week.key} className="analysis-heatmap-row">
                    <span className="analysis-heatmap-week">{getWeekLabel(week.week)}</span>
                    {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lor', 'Son'].map((day, index) => (
                      <HeatCell key={`${week.week.key}-${day}`} week={week} weekdayIndex={index} weekdayLabel={day} />
                    ))}
                  </div>
                ))}
              </div>
            </article>

            <article className="analysis-surface-card">
              <div className="analysis-section-heading">
                <span className="analysis-section-kicker">Nokkelokter</span>
                <h3>Toppbelastning</h3>
              </div>
              <p className="analysis-panel-copy">
                Oktliste sortert pa estimert load for a finne de mest krevende stimulusene i blokka.
              </p>
              <div className="analysis-top-workouts">
                {topWorkouts.length > 0
                  ? topWorkouts.map(workout => <TopWorkoutCard key={workout.id} workout={workout} />)
                  : <div className="chart-empty">Ingen okter i perioden</div>}
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  )
}
