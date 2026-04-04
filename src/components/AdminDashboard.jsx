import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, getDocs
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../firebase'
import {
  getWeekNumber,
  getAdjacentWeek,
  getWeekDates,
  ZONE_COLORS,
  TYPE_COLORS,
  TYPE_ICONS,
  TEMPLATE_CATEGORIES,
  getDefaultIntensityZone,
  getIntensityZoneLabel,
  normalizeIntensityZone,
  normalizeWorkout,
} from '../utils'
import { WORKOUT_TEMPLATES } from '../workoutTemplates'
import WorkoutForm from './WorkoutForm'
import WorkoutDetail from './WorkoutDetail'

// ─── Helpers ───────────────────────────────────────────────────────────────

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

const EMPTY_TEMPLATE = {
  category: 'Intervall',
  type: 'interval',
  title: '',
  description: '',
  distance: '',
  sessionDetails: '',
  warmup: '',
  cooldown: '',
  exercises: '',
  rest: '',
  notes: '',
  intensityZone: getDefaultIntensityZone('interval'),
}

function getBuiltinTemplateDocId(template) {
  return `builtin-${String(template.id || template.title)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')}`
}

function getTemplateLookupKey(template) {
  return [
    (template.category || '').trim().toLowerCase(),
    (template.type || '').trim().toLowerCase(),
    (template.title || '').trim().toLowerCase(),
  ].join('::')
}

function getBuiltinTemplatePayload(template) {
  const { id, ...fields } = template
  return {
    ...fields,
    templateId: id,
    source: 'builtin',
    intensityZone: normalizeIntensityZone(fields.type, fields.intensityZone),
  }
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function AdminDashboard({ user, onClose }) {
  const today = new Date()
  const [tab, setTab] = useState('plan')

  // Ukeplan state
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(today))
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [workouts, setWorkouts] = useState([])
  const [loadingWorkouts, setLoadingWorkouts] = useState(true)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customForm, setCustomForm] = useState({ ...EMPTY_TEMPLATE })
  const [replacementTarget, setReplacementTarget] = useState(null)

  // Øktbank state
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [editingTemplate, setEditingTemplate] = useState(null) // null | 'new' | {template}
  const [templateForm, setTemplateForm] = useState({ ...EMPTY_TEMPLATE })
  const [templatesSynced, setTemplatesSynced] = useState(false)

  // When in "pick from bank" mode (triggered from plan tab)
  const [pickingFromBank, setPickingFromBank] = useState(false)

  const { monday, sunday } = getWeekDates(currentWeek, currentYear)
  const isThisWeek = currentWeek === getWeekNumber(today) && currentYear === today.getFullYear()

  // ─── Workouts listener ───
  useEffect(() => {
    setLoadingWorkouts(true)
    const q = query(
      collection(db, 'workouts'),
      where('year', '==', currentYear),
      where('week', '==', currentWeek)
    )
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => normalizeWorkout({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setWorkouts(docs)
      setLoadingWorkouts(false)
    })
    return unsub
  }, [currentWeek, currentYear])

  useEffect(() => {
    if (!selectedWorkout) return
    const freshWorkout = workouts.find(w => w.id === selectedWorkout.id)
    if (freshWorkout) {
      setSelectedWorkout(freshWorkout)
      return
    }
    setSelectedWorkout(null)
  }, [workouts, selectedWorkout])

  useEffect(() => {
    let cancelled = false

    async function syncBuiltinTemplates() {
      const templatesRef = collection(db, 'templates')
      const existingSnap = await getDocs(templatesRef)
      const existingDocs = existingSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      const docsById = new Map(existingDocs.map(template => [template.id, template]))
      const docsByTemplateId = new Map(
        existingDocs
          .filter(template => template.templateId)
          .map(template => [template.templateId, template])
      )
      const docsByLookupKey = new Map(
        existingDocs.map(template => [getTemplateLookupKey(template), template])
      )

      const batch = writeBatch(db)
      let changes = 0

      WORKOUT_TEMPLATES.forEach(template => {
        const docId = getBuiltinTemplateDocId(template)
        const payload = getBuiltinTemplatePayload(template)
        const existing =
          docsById.get(docId) ||
          docsByTemplateId.get(template.id) ||
          docsByLookupKey.get(getTemplateLookupKey(template))

        const currentComparable = existing
          ? JSON.stringify(getBuiltinTemplatePayload({ ...existing, id: existing.templateId || template.id }))
          : null
        const nextComparable = JSON.stringify(payload)

        if (!existing || existing.id !== docId || currentComparable !== nextComparable) {
          batch.set(doc(db, 'templates', docId), {
            ...payload,
            createdAt: existing?.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
          changes += 1
        }

        if (existing && existing.id !== docId) {
          batch.delete(doc(db, 'templates', existing.id))
          changes += 1
        }
      })

      if (changes > 0) {
        await batch.commit()
      }

      if (!cancelled) {
        setTemplatesSynced(true)
      }
    }

    syncBuiltinTemplates().catch(err => {
      console.error('Kunne ikke synkronisere innebygde maler:', err)
      if (!cancelled) {
        setTemplatesSynced(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // ─── Templates listener ───
  useEffect(() => {
    setLoadingTemplates(true)
    const unsub = onSnapshot(collection(db, 'templates'), snap => {
      const docs = snap.docs
        .map(d => normalizeWorkout({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const catOrder = TEMPLATE_CATEGORIES.indexOf(a.category) - TEMPLATE_CATEGORIES.indexOf(b.category)
          return catOrder !== 0 ? catOrder : (a.title || '').localeCompare(b.title || '')
        })
      setTemplates(docs)
      if (templatesSynced || !snap.empty) {
        setLoadingTemplates(false)
      }
    })
    return unsub
  }, [templatesSynced])

  // ─── Week nav ───
  function prevWeek() {
    const previous = getAdjacentWeek(currentWeek, currentYear, -1)
    setCurrentWeek(previous.week)
    setCurrentYear(previous.year)
  }
  function nextWeek() {
    const next = getAdjacentWeek(currentWeek, currentYear, 1)
    setCurrentWeek(next.week)
    setCurrentYear(next.year)
  }

  // ─── Workout actions ───
  async function addWorkoutToWeek(fields) {
    const nextOrder = workouts.length > 0 ? Math.max(...workouts.map(w => w.order ?? 0)) + 1 : 1
    await addDoc(collection(db, 'workouts'), {
      ...fields,
      intensityZone: normalizeIntensityZone(fields.type, fields.intensityZone),
      week: currentWeek,
      year: currentYear,
      order: nextOrder,
      completed: false,
      createdAt: serverTimestamp(),
    })
  }

  async function handleAddCustom(e) {
    e.preventDefault()
    await addWorkoutToWeek(customForm)
    setShowCustomForm(false)
    setCustomForm({ ...EMPTY_TEMPLATE })
  }

  async function handleAddFromTemplate(template) {
    const { id, createdAt, ...fields } = template
    if (replacementTarget) {
      const shouldReplace = window.confirm(
        `Er du sikker på at du vil bytte ut økten "${replacementTarget.title}" med "${template.title}"?`
      )
      if (!shouldReplace) return

      await updateDoc(doc(db, 'workouts', replacementTarget.id), {
        ...EMPTY_TEMPLATE,
        ...fields,
        intensityZone: normalizeIntensityZone(fields.type, fields.intensityZone),
        week: replacementTarget.week,
        year: replacementTarget.year,
        order: replacementTarget.order ?? 0,
        completed: false,
        completedAt: null,
        userComment: '',
        userCommentUpdatedAt: null,
      })

      if (selectedWorkout?.id === replacementTarget.id) {
        setSelectedWorkout(null)
      }
      setReplacementTarget(null)
    } else {
      await addWorkoutToWeek(fields)
    }

    setPickingFromBank(false)
    setTab('plan')
  }

  function handleStartReplaceWorkout(workout) {
    setReplacementTarget(workout)
    setPickingFromBank(true)
    setTab('oktbank')
  }

  function handleOpenWorkoutBank() {
    setReplacementTarget(null)
    setPickingFromBank(true)
    setTab('oktbank')
  }

  async function handleEditWorkout(updated) {
    const { id, ...fields } = updated
    await updateDoc(doc(db, 'workouts', id), {
      ...fields,
      intensityZone: normalizeIntensityZone(fields.type, fields.intensityZone),
    })
    setSelectedWorkout(null)
  }

  async function handleDeleteWorkout(workout) {
    if (!window.confirm(`Slett "${workout.title}"?`)) return
    await deleteDoc(doc(db, 'workouts', workout.id))
    setSelectedWorkout(null)
  }

  async function handleToggleComplete(workout) {
    await updateDoc(doc(db, 'workouts', workout.id), {
      completed: !workout.completed,
      completedAt: !workout.completed ? serverTimestamp() : null,
    })
    if (selectedWorkout?.id === workout.id) {
      setSelectedWorkout(prev => ({ ...prev, completed: !prev.completed }))
    }
  }

  async function handleSaveComment(workout, userComment) {
    await updateDoc(doc(db, 'workouts', workout.id), {
      userComment,
      userCommentUpdatedAt: serverTimestamp(),
    })
    if (selectedWorkout?.id === workout.id) {
      setSelectedWorkout(prev => ({ ...prev, userComment }))
    }
  }

  async function moveWorkout(workout, direction) {
    const sorted = [...workouts]
    const idx = sorted.findIndex(w => w.id === workout.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const batch = writeBatch(db)
    batch.update(doc(db, 'workouts', sorted[idx].id), { order: sorted[swapIdx].order ?? swapIdx + 1 })
    batch.update(doc(db, 'workouts', sorted[swapIdx].id), { order: sorted[idx].order ?? idx + 1 })
    await batch.commit()
  }

  // ─── Template actions ───
  function startNewTemplate() {
    setTemplateForm({ ...EMPTY_TEMPLATE })
    setEditingTemplate('new')
  }

  function startEditTemplate(template) {
    setTemplateForm({ ...template })
    setEditingTemplate(template)
  }

  async function handleSaveTemplate(e) {
    e.preventDefault()
    if (!templateForm.title.trim()) return
    if (editingTemplate === 'new') {
      await addDoc(collection(db, 'templates'), {
        ...templateForm,
        source: 'custom',
        intensityZone: normalizeIntensityZone(templateForm.type, templateForm.intensityZone),
        createdAt: serverTimestamp(),
      })
    } else {
      const { id, ...fields } = templateForm
      await updateDoc(doc(db, 'templates', editingTemplate.id), {
        ...fields,
        intensityZone: normalizeIntensityZone(fields.type, fields.intensityZone),
      })
    }
    setEditingTemplate(null)
  }

  async function handleDeleteTemplate(template) {
    if (!window.confirm(`Slett malen "${template.title}"?`)) return
    await deleteDoc(doc(db, 'templates', template.id))
  }

  async function handleLogout() {
    await signOut(auth)
    onClose()
  }

  const filteredTemplates = activeCategory === 'Alle'
    ? templates
    : templates.filter(t => t.category === activeCategory)

  // ─── Render: Template editor modal ───
  if (editingTemplate !== null) {
    return (
      <div className="admin-dashboard">
        <header className="admin-header">
          <button className="admin-back-btn" onClick={() => setEditingTemplate(null)}>‹ Avbryt</button>
          <span className="admin-header-title">
            {editingTemplate === 'new' ? 'Ny mal' : 'Rediger mal'}
          </span>
          <div style={{ width: 72 }} />
        </header>
        <div className="admin-scroll-area">
          <form onSubmit={handleSaveTemplate} style={{ padding: '1rem' }}>
            <WorkoutForm value={templateForm} onChange={setTemplateForm} showCategory />
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn-cancel" onClick={() => setEditingTemplate(null)}>Avbryt</button>
              <button type="submit" className="btn-save">Lagre mal</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ─── Render: Custom workout form modal ───
  if (showCustomForm) {
    return (
      <div className="admin-dashboard">
        <header className="admin-header">
          <button className="admin-back-btn" onClick={() => setShowCustomForm(false)}>‹ Avbryt</button>
          <span className="admin-header-title">Egendefinert økt</span>
          <div style={{ width: 72 }} />
        </header>
        <div className="admin-scroll-area">
          <form onSubmit={handleAddCustom} style={{ padding: '1rem' }}>
            <WorkoutForm value={customForm} onChange={setCustomForm} showCategory />
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn-cancel" onClick={() => setShowCustomForm(false)}>Avbryt</button>
              <button type="submit" className="btn-save">Legg til i uke {currentWeek}</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      {/* ─── Header ─── */}
      <header className="admin-header">
        <button className="admin-back-btn" onClick={onClose}>‹ Tilbake</button>
        <span className="admin-header-title">Admin</span>
        <button className="admin-logout-btn" onClick={handleLogout}>Logg ut</button>
      </header>

      {/* ─── Tabs ─── */}
      <div className="admin-tabs">
        <button
          className={`admin-tab${tab === 'plan' ? ' active' : ''}`}
          onClick={() => {
            setTab('plan')
            setPickingFromBank(false)
            setReplacementTarget(null)
          }}
        >
          📅 Ukeplan
        </button>
        <button
          className={`admin-tab${tab === 'oktbank' ? ' active' : ''}`}
          onClick={() => {
            setTab('oktbank')
            setReplacementTarget(null)
          }}
        >
          📚 Øktbank
        </button>
      </div>

      {/* ─── Ukeplan tab ─── */}
      {tab === 'plan' && (
        <div className="admin-plan">
          <div className="admin-week-nav">
            <button className="nav-btn" onClick={prevWeek}>‹</button>
            <div className="week-info">
              <span className="week-label">
                Uke {currentWeek}
                {isThisWeek && <span className="this-week-dot"> •</span>}
              </span>
              <span className="week-dates">
                {monday.getDate()}.{monday.getMonth() + 1} – {sunday.getDate()}.{sunday.getMonth() + 1}.{sunday.getFullYear()}
              </span>
            </div>
            <button className="nav-btn" onClick={nextWeek}>›</button>
          </div>

          <div className="admin-plan-list">
            {loadingWorkouts ? (
              <div className="empty-state">Laster...</div>
            ) : workouts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <div>Ingen økter denne uken</div>
              </div>
            ) : (
              workouts.map((w, idx) => (
                <AdminWorkoutRow
                  key={w.id}
                  workout={w}
                  index={idx}
                  total={workouts.length}
                  onClick={setSelectedWorkout}
                  onDelete={handleDeleteWorkout}
                  onReplace={handleStartReplaceWorkout}
                  onToggleComplete={handleToggleComplete}
                  onMoveUp={() => moveWorkout(w, -1)}
                  onMoveDown={() => moveWorkout(w, 1)}
                />
              ))
            )}
          </div>

          <div className="admin-plan-actions">
            <button
              className="btn-admin-add secondary"
              onClick={handleOpenWorkoutBank}
            >
              + Fra øktbank
            </button>
            <button className="btn-admin-add" onClick={() => setShowCustomForm(true)}>
              + Egendefinert
            </button>
          </div>
        </div>
      )}

      {/* ─── Øktbank tab ─── */}
      {tab === 'oktbank' && (
        <div className="admin-oktbank">
          <div className="oktbank-header">
            {pickingFromBank ? (
              <>
                <h2 className="oktbank-title">Velg økt for uke {currentWeek}</h2>
                <p className="oktbank-subtitle">
                  {replacementTarget
                    ? `Trykk på en økt for å bytte ut "${replacementTarget.title}"`
                    : 'Trykk på en økt for å legge den til i planen'}
                </p>
              </>
            ) : (
              <>
                <h2 className="oktbank-title">Øktbank</h2>
                <p className="oktbank-subtitle">{templates.length} maler · trykk for å redigere</p>
              </>
            )}
          </div>

          <div className="category-filter">
            {['Alle', ...TEMPLATE_CATEGORIES].map(cat => (
              <button
                key={cat}
                className={`cat-btn${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {loadingTemplates ? (
            <div className="empty-state">Laster maler...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="empty-state">
              <div>Ingen maler i denne kategorien</div>
              <button className="btn-add-empty" onClick={startNewTemplate}>+ Ny mal</button>
            </div>
          ) : (
            <div className="template-list">
              {filteredTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  pickMode={pickingFromBank}
                  replacementMode={!!replacementTarget}
                  onPick={() => handleAddFromTemplate(template)}
                  onEdit={() => startEditTemplate(template)}
                  onDelete={() => handleDeleteTemplate(template)}
                />
              ))}
            </div>
          )}

          {!pickingFromBank && (
            <button className="fab" onClick={startNewTemplate}>+</button>
          )}
        </div>
      )}

      {/* ─── Workout detail / edit modal ─── */}
      {selectedWorkout && (
        <WorkoutDetail
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          isAdmin
          onDelete={handleDeleteWorkout}
          onToggleComplete={handleToggleComplete}
          onSaveComment={handleSaveComment}
          onEdit={handleEditWorkout}
        />
      )}
    </div>
  )
}

// ─── Admin Workout Row ─────────────────────────────────────────────────────

function AdminWorkoutRow({ workout, index, total, onClick, onDelete, onReplace, onToggleComplete, onMoveUp, onMoveDown }) {
  const typeColors = TYPE_COLORS[workout.type] || TYPE_COLORS.annet
  const icon = TYPE_ICONS[workout.type] || '📋'

  return (
    <div
      className={`admin-workout-row${workout.completed ? ' completed' : ''}`}
      style={{ borderLeftColor: typeColors.border }}
    >
      <div className="admin-row-reorder">
        <button
          className="reorder-btn"
          onClick={onMoveUp}
          disabled={index === 0}
          title="Flytt opp"
        >↑</button>
        <button
          className="reorder-btn"
          onClick={onMoveDown}
          disabled={index === total - 1}
          title="Flytt ned"
        >↓</button>
      </div>

      <div className="admin-row-main" onClick={() => onClick(workout)}>
        <span className="card-icon" style={{ fontSize: '1.2rem' }}>{icon}</span>
        <div className="admin-row-info">
          <span className="card-title">{workout.title}</span>
          {workout.description && (
            <span className="card-desc" style={{ WebkitLineClamp: 1 }}>{workout.description}</span>
          )}
        </div>
      </div>

      <div className="admin-row-actions">
        <button className="reorder-btn" onClick={() => onReplace(workout)} title="Bytt ut fra øktbank">⇄</button>
        <button
          className={`check-btn${workout.completed ? ' checked' : ''}`}
          onClick={() => onToggleComplete(workout)}
        >
          {workout.completed ? '✓' : '○'}
        </button>
        <button className="delete-btn" onClick={() => onDelete(workout)} title="Slett">🗑</button>
      </div>
    </div>
  )
}

// ─── Template Card ─────────────────────────────────────────────────────────

function TemplateCard({ template, pickMode, replacementMode, onPick, onEdit, onDelete }) {
  const typeColors = TYPE_COLORS[template.type] || TYPE_COLORS.annet
  const zone = normalizeIntensityZone(template.type, template.intensityZone)
  const zoneColors = ZONE_COLORS[zone]
  const zoneLabel = getIntensityZoneLabel(template)
  const icon = TYPE_ICONS[template.type] || '📋'

  return (
    <div
      className="template-card"
      style={{ backgroundColor: typeColors.bg, borderLeftColor: typeColors.border }}
    >
      <div className="template-card-top">
        <div className="template-card-left">
          <span className="template-icon">{icon}</span>
          <div>
            <div className="template-title">{template.title}</div>
            {template.category && (
              <div className="template-category">{template.category}</div>
            )}
          </div>
        </div>
        {zone && zoneLabel && (
          <span
            className="zone-badge"
            style={{ backgroundColor: zoneColors.border, color: zoneColors.text }}
          >
            {zoneLabel}
          </span>
        )}
      </div>

      {template.description && (
        <div className="template-desc">{template.description}</div>
      )}

      <div className="template-actions">
        {pickMode ? (
          <button className="btn-template-pick" onClick={onPick}>
            {replacementMode ? 'Bytt ut økt' : '+ Legg til i plan'}
          </button>
        ) : (
          <>
            <button className="btn-template-edit" onClick={onEdit}>✏️ Rediger</button>
            <button className="btn-template-delete" onClick={onDelete}>🗑 Slett</button>
          </>
        )}
      </div>
    </div>
  )
}
