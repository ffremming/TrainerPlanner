import { TEMPLATE_CATEGORIES, WORKOUT_TEMPLATES } from './workoutTemplates'
import {
  getDefaultCooldown,
  getDefaultWarmup,
  normalizeIntensityZones,
  normalizeLoadTag,
  normalizeWorkout,
} from './utils'

function getBuiltinTemplateDocId(template) {
  return `builtin-${String(template.id || template.title)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')}`
}

function toBuiltinTemplate(template) {
  const { id, ...fields } = template
  return normalizeWorkout({
    id: getBuiltinTemplateDocId(template),
    ...fields,
    templateId: id,
    source: 'builtin',
    cooldown: fields.cooldown || getDefaultCooldown(fields.type, fields.activityTag),
    intensityZone: normalizeIntensityZones(fields.type, fields.intensityZone),
    loadTag: normalizeLoadTag(fields.type, fields.intensityZone, fields.loadTag),
    warmup: fields.warmup || getDefaultWarmup(fields.type, fields.activityTag),
  })
}

function getTemplateCategoryIndex(category) {
  const index = TEMPLATE_CATEGORIES.indexOf(category)
  return index === -1 ? TEMPLATE_CATEGORIES.length : index
}

export const BUILTIN_TEMPLATES = WORKOUT_TEMPLATES.map(toBuiltinTemplate)

export function sortTemplates(a, b) {
  const sourceOrder = (template) => (template.source === 'custom' ? 0 : 1)
  const sourceCompare = sourceOrder(a) - sourceOrder(b)
  if (sourceCompare !== 0) return sourceCompare

  const categoryCompare = getTemplateCategoryIndex(a.category) - getTemplateCategoryIndex(b.category)
  if (categoryCompare !== 0) return categoryCompare

  return (a.title || '').localeCompare(b.title || '')
}

export function mergeTemplates(customTemplates = []) {
  const merged = new Map()

  BUILTIN_TEMPLATES.forEach(template => {
    merged.set(template.id, template)
  })

  customTemplates.forEach(template => {
    merged.set(template.id, normalizeWorkout(template))
  })

  return [...merged.values()].sort(sortTemplates)
}
