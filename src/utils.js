export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
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

export function isoDate(date) {
  return date.toISOString().split('T')[0]
}

export const ZONE_COLORS = {
  1: { bg: '#e8f4fd', border: '#90caf9', text: '#1565c0', label: 'Sone 1' },
  2: { bg: '#e8f8e8', border: '#81c784', text: '#2e7d32', label: 'Sone 2' },
  3: { bg: '#fffde7', border: '#fff176', text: '#f57f17', label: 'Sone 3' },
  4: { bg: '#fff3e0', border: '#ffb74d', text: '#e65100', label: 'Sone 4' },
  5: { bg: '#fce4ec', border: '#f48fb1', text: '#880e4f', label: 'Sone 5' },
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

const NO_DAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
const NO_MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export function formatDate(isoString) {
  const [year, month, day] = isoString.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return `${NO_DAYS[d.getDay()]} ${d.getDate()}. ${NO_MONTHS[d.getMonth()]}`
}
