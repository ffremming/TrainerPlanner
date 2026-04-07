export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

export function getISOWeeksInYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28))
  return getWeekNumber(dec28)
}

export function getWeekDates(week, year) {
  const jan4 = new Date(year, 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const monday = new Date(startOfWeek1)
  monday.setDate(startOfWeek1.getDate() + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

export function getAdjacentWeek(week, year, direction) {
  if (direction < 0) {
    if (week === 1) {
      const previousYear = year - 1
      return { week: getISOWeeksInYear(previousYear), year: previousYear }
    }

    return { week: week - 1, year }
  }

  const weeksInYear = getISOWeeksInYear(year)
  if (week >= weeksInYear) {
    return { week: 1, year: year + 1 }
  }

  return { week: week + 1, year }
}

export function getWeekSequence(startWeek, startYear, count) {
  const weeks = []
  let cursor = { week: startWeek, year: startYear }

  for (let index = 0; index < count; index += 1) {
    const { monday, sunday } = getWeekDates(cursor.week, cursor.year)
    weeks.push({
      week: cursor.week,
      year: cursor.year,
      monday,
      sunday,
      key: `${cursor.year}-${String(cursor.week).padStart(2, '0')}`,
    })
    cursor = getAdjacentWeek(cursor.week, cursor.year, 1)
  }

  return weeks
}

export function getWeekWindow(centerWeek, centerYear, beforeCount, afterCount) {
  const weeks = []
  let start = { week: centerWeek, year: centerYear }

  for (let index = 0; index < beforeCount; index += 1) {
    start = getAdjacentWeek(start.week, start.year, -1)
  }

  let cursor = start
  const totalCount = beforeCount + afterCount + 1

  for (let index = 0; index < totalCount; index += 1) {
    const { monday, sunday } = getWeekDates(cursor.week, cursor.year)
    weeks.push({
      week: cursor.week,
      year: cursor.year,
      monday,
      sunday,
      key: `${cursor.year}-${String(cursor.week).padStart(2, '0')}`,
    })
    cursor = getAdjacentWeek(cursor.week, cursor.year, 1)
  }

  return weeks
}

export function getWeekKey(week, year) {
  return `${year}-${String(week).padStart(2, '0')}`
}

export function parseDistanceValue(distance) {
  if (typeof distance !== 'string') return null
  const match = distance.replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : null
}

export function getWorkoutDistance(workout) {
  return parseDistanceValue(workout?.distance)
}

export function getWeeklyDistance(workouts) {
  return workouts.reduce((sum, workout) => {
    const distance = getWorkoutDistance(workout)
    return distance === null ? sum : sum + distance
  }, 0)
}

export function formatKmValue(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 km'
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1))
  return `${rounded} km`
}

function getWeekOffsetFromAnchor(targetWeek, targetYear, anchorWeek, anchorYear) {
  if (targetYear === anchorYear) {
    return targetWeek - anchorWeek
  }

  let offset = 0

  if (targetYear > anchorYear) {
    offset += getISOWeeksInYear(anchorYear) - anchorWeek
    for (let year = anchorYear + 1; year < targetYear; year += 1) {
      offset += getISOWeeksInYear(year)
    }
    offset += targetWeek
    return offset
  }

  offset -= anchorWeek
  for (let year = anchorYear - 1; year > targetYear; year -= 1) {
    offset -= getISOWeeksInYear(year)
  }
  offset -= getISOWeeksInYear(targetYear) - targetWeek
  return offset
}

export function getWeeklyProgressionTarget(
  week,
  year,
  startingDistance = 17,
  growthFactor = 1.07,
  anchorWeek = 13,
  anchorYear = 2026
) {
  const weekOffset = getWeekOffsetFromAnchor(week, year, anchorWeek, anchorYear)
  return Number((startingDistance * Math.pow(growthFactor, weekOffset)).toFixed(2))
}

export function getWeeklyProgressionTargets(
  weeks,
  startingDistance = 17,
  growthFactor = 1.07,
  anchorWeek = 13,
  anchorYear = 2026
) {
  const targets = new Map()

  weeks.forEach(week => {
    targets.set(
      week.key,
      getWeeklyProgressionTarget(week.week, week.year, startingDistance, growthFactor, anchorWeek, anchorYear)
    )
  })

  return targets
}

export const ZONE_COLORS = {
  1: { bg: '#e8f4fd', border: '#90caf9', text: '#1565c0', label: 'Sone 1' },
  2: { bg: '#e8f8e8', border: '#81c784', text: '#2e7d32', label: 'Sone 2' },
  3: { bg: '#fffde7', border: '#fff176', text: '#f57f17', label: 'Sone 3' },
  4: { bg: '#fff3e0', border: '#ffb74d', text: '#e65100', label: 'Sone 4' },
  5: { bg: '#fce4ec', border: '#f48fb1', text: '#880e4f', label: 'Sone 5' },
}

export const TYPE_COLORS = {
  rolig:    { bg: '#dbeafe', border: '#60a5fa', text: '#1e40af' },
  molle:    { bg: '#dbeafe', border: '#60a5fa', text: '#1e40af' },
  terskel:  { bg: '#dcfce7', border: '#4ade80', text: '#166534' },
  interval: { bg: '#ffedd5', border: '#fb923c', text: '#9a3412' },
  styrke:   { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  annet:    { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },
}

export const WORKOUT_TYPES = [
  { value: 'interval', label: 'Intervall' },
  { value: 'terskel', label: 'Terskel' },
  { value: 'rolig', label: 'Rolig løping' },
  { value: 'styrke', label: 'Styrke' },
  { value: 'molle', label: 'Mølle + styrke' },
  { value: 'annet', label: 'Annet' },
]

export const TYPE_ICONS = {
  interval: '⚡',
  terskel: '🎯',
  rolig: '🚶',
  styrke: '💪',
  molle: '🏃',
  annet: '📋',
}

export const ZONE_INFO = {
  1: { hr: '118–154', rpe: 'Veldig lett', breathing: 'Kan prate uanstrengt' },
  2: { hr: '155–176', rpe: 'Nokså lett', breathing: 'Kan si lengre setninger relativt uanstrengt' },
  3: { hr: '177–187', rpe: 'Behagelig anstrengende', breathing: 'Kan si korte setninger' },
  4: { hr: '188–197', rpe: 'Anstrengende', breathing: 'Kan si noen ord eller svært korte setninger' },
  5: { hr: '198–215', rpe: 'Veldig anstrengende', breathing: 'Kan kun si ett ord eller to, samtidig som man puster tungt' },
}

export function hasIntensityZone(type) {
  return type !== 'styrke'
}

export function getAllowedIntensityZones(type) {
  if (!hasIntensityZone(type)) return []
  if (type === 'interval' || type === 'terskel') return [3, 4, 5]
  return [1, 2, 3, 4]
}

export function getDefaultIntensityZones(type) {
  if (!hasIntensityZone(type)) return []
  if (type === 'interval' || type === 'terskel') return [3]
  return [2]
}

export function normalizeIntensityZones(type, intensityZone) {
  const allowedZones = getAllowedIntensityZones(type)
  if (allowedZones.length === 0) return []

  const rawZones = Array.isArray(intensityZone)
    ? intensityZone
    : typeof intensityZone === 'string'
      ? (intensityZone.match(/[1-5]/g) || []).map(Number)
      : intensityZone == null
        ? []
        : [Number(intensityZone)]

  const normalized = [...new Set(
    rawZones
      .map(Number)
      .filter(zone => allowedZones.includes(zone))
  )].sort((a, b) => a - b)

  return normalized.length > 0 ? normalized : getDefaultIntensityZones(type)
}

export function normalizeIntensityZone(type, intensityZone) {
  const zones = normalizeIntensityZones(type, intensityZone)
  return zones.length > 0 ? zones[zones.length - 1] : null
}

export function formatIntensityZoneLabel(zones) {
  if (!zones || zones.length === 0) return null
  if (zones.length === 1) return `Sone ${zones[0]}`

  const contiguous = zones.every((zone, index) => index === 0 || zone === zones[index - 1] + 1)
  if (contiguous) return `Sone ${zones[0]}-${zones[zones.length - 1]}`

  return `Sone ${zones.join(', ')}`
}

export function normalizeWorkout(workout) {
  const intensityZones = normalizeIntensityZones(workout.type, workout.intensityZone)
  return {
    ...workout,
    intensityZone: intensityZones,
    userComment: workout.userComment || '',
  }
}

export function getIntensityZoneLabel(workout) {
  const zones = normalizeIntensityZones(workout.type, workout.intensityZone)
  return formatIntensityZoneLabel(zones)
}

export const TEMPLATE_CATEGORIES = [
  'Intervall',
  'Terskel',
  'Rolig',
  'Mølle + styrke',
  'Styrke',
  'Annet',
]
