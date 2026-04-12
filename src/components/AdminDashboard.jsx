import { useEffect, useMemo, useState } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, deleteField
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../firebase'
import {
  getWeekNumber,
  getAdjacentWeek,
  getWeekDates,
  getWeekKey,
  getWeekWindow,
  ZONE_COLORS,
  TYPE_COLORS,
  TYPE_ICONS,
  TEMPLATE_CATEGORIES,
  ACTIVITY_TAGS,
  ACTIVITY_TAG_MAP,
  LOAD_TAG_MAP,
  compareWorkoutsBySchedule,
  formatWorkoutTime,
  formatWorkoutSchedule,
  getDateStringForWeekday,
  getDefaultCooldown,
  getDefaultIntensityZones,
  getDefaultLoadTag,
  getDefaultWarmup,
  getIntensityZoneLabel,
  groupWorkoutsByWeekday,
  normalizeLoadTag,
  normalizeIntensityZones,
  normalizeIntensityZone,
  normalizeWorkout,
} from '../utils'
import { BUILTIN_TEMPLATES, mergeTemplates } from '../templateLibrary'
import WorkoutForm from './WorkoutForm'
import WorkoutDetail from './WorkoutDetail'
import BirdsEyeOverview from './BirdsEyeOverview'
import AnalysisDashboard from './AnalysisDashboard'
import AthleteSelector from './AthleteSelector'
import ActivityIcon from './ActivityIcon'
import SystemIcon from './SystemIcon'
import WorkoutLayoutToggle from './WorkoutLayoutToggle'
import AdminPlanBuilder from './AdminPlanBuilder'
import TestingDashboard from './TestingDashboard'
import { subscribeToWorkoutWeeks } from '../workoutSubscriptions'

// ─── Helpers ───────────────────────────────────────────────────────────────

const EMPTY_TEMPLATE = {
  category: 'Intervall',
  type: 'interval',
  title: '',
  description: '',
  distance: '',
  sessionDetails: '',
  warmup: getDefaultWarmup('interval'),
  cooldown: getDefaultCooldown('interval'),
  exercises: '',
  rest: '',
  notes: '',
  intensityZone: getDefaultIntensityZones('interval'),
  loadTag: getDefaultLoadTag('interval', getDefaultIntensityZones('interval')),
  activityTag: '',
  weekday: '',
  time: '',
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function AdminDashboard({
  user,
  userProfile,
  onClose,
  currentWeek,
  currentYear,
  onWeekChange,
  overviewWeeks,
  selectedAthleteId,
  athletes,
  onSelectAthlete,
  onOpenUserManagement,
  workoutLayout,
  onWorkoutLayoutChange,
}) {
  const today = new Date()
  const [tab, setTab] = useState('plan')

  // Ukeplan state
  const [workouts, setWorkouts] = useState([])
  const [loadingWorkouts, setLoadingWorkouts] = useState(true)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customForm, setCustomForm] = useState({ ...EMPTY_TEMPLATE })
  const [replacementTarget, setReplacementTarget] = useState(null)
  const [analysisWorkouts, setAnalysisWorkouts] = useState([])
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [overviewWorkouts, setOverviewWorkouts] = useState([])
  const [loadingOverview, setLoadingOverview] = useState(true)

  // Øktbank state
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templateForm, setTemplateForm] = useState({ ...EMPTY_TEMPLATE })
  const [pickingFromBank, setPickingFromBank] = useState(false)
  const [showOverview, setShowOverview] = useState(false)
  const [activeTagFilter, setActiveTagFilter] = useState(null)
  const [draggedWorkoutId, setDraggedWorkoutId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  const { monday, sunday } = getWeekDates(currentWeek, currentYear)
  const analysisWeeks = useMemo(() => getWeekWindow(currentWeek, currentYear, 11, 11), [currentWeek, currentYear])
  const analysisWeekKeys = useMemo(() => new Set(analysisWeeks.map(week => week.key)), [analysisWeeks])
  const overviewWeekKeys = useMemo(() => new Set(overviewWeeks.map(week => week.key)), [overviewWeeks])
  const isThisWeek = currentWeek === getWeekNumber(today) && currentYear === today.getFullYear()
  const isSuperadmin = userProfile?.role === 'superadmin'

  // ─── Workouts listener (scoped to selected athlete) ───
  useEffect(() => {
    if (!selectedAthleteId) {
      setWorkouts([])
      setLoadingWorkouts(false)
      return
    }

    setLoadingWorkouts(true)
    const q = query(
      collection(db, 'workouts'),
      where('athleteId', '==', selectedAthleteId),
      where('year', '==', currentYear),
      where('week', '==', currentWeek)
    )
    const unsub = onSnapshot(
      q,
      snap => {
        const docs = snap.docs
          .map(d => normalizeWorkout({ id: d.id, ...d.data() }))
          .sort(compareWorkoutsBySchedule)
        setWorkouts(docs)
        setLoadingWorkouts(false)
      },
      () => {
        setWorkouts([])
        setLoadingWorkouts(false)
      }
    )
    return unsub
  }, [currentWeek, currentYear, selectedAthleteId])

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
    if (!selectedAthleteId) {
      setOverviewWorkouts([])
      setLoadingOverview(false)
      return
    }

    setLoadingOverview(true)
    setOverviewWorkouts([])

    return subscribeToWorkoutWeeks({
      athleteId: selectedAthleteId,
      weeks: overviewWeeks,
      filterWorkout: workout => overviewWeekKeys.has(getWeekKey(workout.week, workout.year)),
      onData: (nextWorkouts, isReady) => {
        setOverviewWorkouts(nextWorkouts)
        if (isReady) {
          setLoadingOverview(false)
        }
      },
      onError: () => {
        setLoadingOverview(false)
      },
    })
  }, [overviewWeekKeys, overviewWeeks, selectedAthleteId])

  useEffect(() => {
    if (!selectedAthleteId) {
      setAnalysisWorkouts([])
      setLoadingAnalysis(false)
      return
    }

    setLoadingAnalysis(true)
    return subscribeToWorkoutWeeks({
      athleteId: selectedAthleteId,
      weeks: analysisWeeks,
      filterWorkout: workout => analysisWeekKeys.has(getWeekKey(workout.week, workout.year)),
      onData: (nextWorkouts, isReady) => {
        setAnalysisWorkouts(nextWorkouts)
        if (isReady) {
          setLoadingAnalysis(false)
        }
      },
      onError: () => {
        setLoadingAnalysis(false)
      },
    })
  }, [analysisWeekKeys, analysisWeeks, selectedAthleteId])

  // ─── Templates listener ───
  useEffect(() => {
    setLoadingTemplates(true)
    if (!userProfile?.uid) {
      setTemplates(mergeTemplates())
      setLoadingTemplates(false)
      return
    }

    const unsub = onSnapshot(
      query(collection(db, 'templates'), where('ownerId', '==', userProfile.uid)),
      snap => {
        const customTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTemplates(mergeTemplates(customTemplates))
        setLoadingTemplates(false)
      }
    )
    return unsub
  }, [userProfile?.uid])

  // ─── Week nav ───
  function prevWeek() {
    const previous = getAdjacentWeek(currentWeek, currentYear, -1)
    onWeekChange(previous.week, previous.year)
  }
  function nextWeek() {
    const next = getAdjacentWeek(currentWeek, currentYear, 1)
    onWeekChange(next.week, next.year)
  }

  // ─── Workout actions ───
  async function addWorkoutToWeek(fields) {
    if (!selectedAthleteId) return
    const nextOrder = workouts.length > 0 ? Math.max(...workouts.map(w => w.order ?? 0)) + 1 : 1
    const weekday = Number(fields.weekday)
    const intensityZone = normalizeIntensityZones(fields.type, fields.intensityZone)
    await addDoc(collection(db, 'workouts'), {
      ...fields,
      intensityZone,
      loadTag: normalizeLoadTag(fields.type, intensityZone, fields.loadTag),
      warmup: fields.warmup?.trim() || getDefaultWarmup(fields.type, fields.activityTag),
      cooldown: fields.cooldown?.trim() || getDefaultCooldown(fields.type, fields.activityTag),
      athleteId: selectedAthleteId,
      week: currentWeek,
      year: currentYear,
      weekday,
      date: getDateStringForWeekday(currentWeek, currentYear, weekday),
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
        intensityZone: normalizeIntensityZones(fields.type, fields.intensityZone),
        loadTag: normalizeLoadTag(fields.type, fields.intensityZone, fields.loadTag),
        warmup: fields.warmup?.trim() || getDefaultWarmup(fields.type, fields.activityTag),
        cooldown: fields.cooldown?.trim() || getDefaultCooldown(fields.type, fields.activityTag),
        week: replacementTarget.week,
        year: replacementTarget.year,
        weekday: replacementTarget.weekday,
        date: replacementTarget.date,
        time: replacementTarget.time || '',
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
      setCustomForm({
        ...EMPTY_TEMPLATE,
        ...fields,
        weekday: customForm.weekday || '',
        time: fields.time || '',
      })
      setShowCustomForm(true)
    }

    setPickingFromBank(false)
    setTab('plan')
  }

  async function handleAddTemplateToDay(template, weekday, beforeWorkoutId = null) {
    if (!selectedAthleteId) return

    const normalizedWeekday = Number(weekday)
    const targetDayWorkouts = workouts
      .filter(workout => workout.weekday === normalizedWeekday)
      .sort(compareWorkoutsBySchedule)

    let insertIndex = targetDayWorkouts.length
    if (beforeWorkoutId) {
      const candidateIndex = targetDayWorkouts.findIndex(workout => workout.id === beforeWorkoutId)
      if (candidateIndex >= 0) {
        insertIndex = candidateIndex
      }
    }

    const { id, createdAt, updatedAt, ownerId, source, ...fields } = template
    const batch = writeBatch(db)
    const newWorkoutRef = doc(collection(db, 'workouts'))

    batch.set(newWorkoutRef, {
      ...EMPTY_TEMPLATE,
      ...fields,
      intensityZone: normalizeIntensityZones(fields.type, fields.intensityZone),
      loadTag: normalizeLoadTag(fields.type, fields.intensityZone, fields.loadTag),
      warmup: fields.warmup?.trim() || getDefaultWarmup(fields.type, fields.activityTag),
      cooldown: fields.cooldown?.trim() || getDefaultCooldown(fields.type, fields.activityTag),
      athleteId: selectedAthleteId,
      week: currentWeek,
      year: currentYear,
      weekday: normalizedWeekday,
      date: getDateStringForWeekday(currentWeek, currentYear, normalizedWeekday),
      time: fields.time || '',
      completed: false,
      completedAt: null,
      userComment: '',
      userCommentUpdatedAt: null,
      createdAt: serverTimestamp(),
      order: insertIndex + 1,
    })

    const nextTargetDayWorkouts = [...targetDayWorkouts]
    nextTargetDayWorkouts.splice(insertIndex, 0, {
      id: newWorkoutRef.id,
      ...fields,
      weekday: normalizedWeekday,
    })

    nextTargetDayWorkouts.forEach((workout, index) => {
      if (workout.id === newWorkoutRef.id) {
        batch.set(newWorkoutRef, { order: index + 1 }, { merge: true })
        return
      }

      batch.update(doc(db, 'workouts', workout.id), {
        order: index + 1,
      })
    })

    await batch.commit()
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
    const intensityZone = normalizeIntensityZones(fields.type, fields.intensityZone)
    await updateDoc(doc(db, 'workouts', id), {
      ...fields,
      weekday: Number(fields.weekday),
      date: getDateStringForWeekday(updated.week, updated.year, fields.weekday),
      intensityZone,
      loadTag: normalizeLoadTag(fields.type, intensityZone, fields.loadTag),
      warmup: fields.warmup?.trim() || getDefaultWarmup(fields.type, fields.activityTag),
      cooldown: fields.cooldown?.trim() || getDefaultCooldown(fields.type, fields.activityTag),
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

  async function handleSaveComment(workout, payload) {
    const userComment = typeof payload === 'string' ? payload : payload.userComment

    await updateDoc(doc(db, 'workouts', workout.id), {
      userComment,
      formScore: deleteField(),
      surplusScore: deleteField(),
      userCommentUpdatedAt: serverTimestamp(),
    })
    if (selectedWorkout?.id === workout.id) {
      setSelectedWorkout(prev => ({
        ...prev,
        userComment,
        formScore: null,
        surplusScore: null,
      }))
    }
  }

  async function moveWorkout(workout, direction) {
    const sorted = workouts
      .filter(item => item.weekday === workout.weekday)
      .sort(compareWorkoutsBySchedule)
    const idx = sorted.findIndex(w => w.id === workout.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const batch = writeBatch(db)
    batch.update(doc(db, 'workouts', sorted[idx].id), { order: sorted[swapIdx].order ?? swapIdx + 1 })
    batch.update(doc(db, 'workouts', sorted[swapIdx].id), { order: sorted[idx].order ?? idx + 1 })
    await batch.commit()
  }

  async function moveWorkoutByDrag(workoutId, targetWeekday, beforeWorkoutId = null) {
    const draggedWorkout = workouts.find(workout => workout.id === workoutId)
    if (!draggedWorkout || !targetWeekday) return

    const normalizedTargetWeekday = Number(targetWeekday)
    const sourceWeekday = Number(draggedWorkout.weekday)
    const sourceDayWorkouts = workouts
      .filter(workout => workout.weekday === sourceWeekday && workout.id !== draggedWorkout.id)
      .sort(compareWorkoutsBySchedule)
    const targetDayWorkouts = workouts
      .filter(workout => workout.weekday === normalizedTargetWeekday && workout.id !== draggedWorkout.id)
      .sort(compareWorkoutsBySchedule)

    let insertIndex = targetDayWorkouts.length
    if (beforeWorkoutId) {
      const candidateIndex = targetDayWorkouts.findIndex(workout => workout.id === beforeWorkoutId)
      if (candidateIndex >= 0) {
        insertIndex = candidateIndex
      }
    }

    const nextTargetDayWorkouts = [...targetDayWorkouts]
    nextTargetDayWorkouts.splice(insertIndex, 0, {
      ...draggedWorkout,
      weekday: normalizedTargetWeekday,
      date: getDateStringForWeekday(currentWeek, currentYear, normalizedTargetWeekday),
    })

    const nextTargetIds = nextTargetDayWorkouts.map(workout => workout.id)
    const currentTargetIds = workouts
      .filter(workout => workout.weekday === normalizedTargetWeekday)
      .sort(compareWorkoutsBySchedule)
      .map(workout => workout.id)

    if (
      sourceWeekday === normalizedTargetWeekday &&
      nextTargetIds.join('|') === currentTargetIds.join('|')
    ) {
      return
    }

    const batch = writeBatch(db)

    nextTargetDayWorkouts.forEach((workout, index) => {
      batch.update(doc(db, 'workouts', workout.id), {
        weekday: normalizedTargetWeekday,
        date: getDateStringForWeekday(currentWeek, currentYear, normalizedTargetWeekday),
        order: index + 1,
      })
    })

    if (sourceWeekday !== normalizedTargetWeekday) {
      sourceDayWorkouts.forEach((workout, index) => {
        batch.update(doc(db, 'workouts', workout.id), {
          order: index + 1,
        })
      })
    }

    await batch.commit()
  }

  function handleDragStart(workout) {
    setDraggedWorkoutId(workout.id)
    setDropTarget({
      weekday: workout.weekday,
      beforeWorkoutId: workout.id,
    })
  }

  function handleDragEnd() {
    setDraggedWorkoutId(null)
    setDropTarget(null)
  }

  function handleDropTargetChange(weekday, beforeWorkoutId = null) {
    if (!draggedWorkoutId) return

    setDropTarget(prev => {
      if (prev?.weekday === weekday && prev?.beforeWorkoutId === beforeWorkoutId) {
        return prev
      }
      return { weekday, beforeWorkoutId }
    })
  }

  async function handleDropWorkout(weekday, beforeWorkoutId = null) {
    if (!draggedWorkoutId) return

    const draggedId = draggedWorkoutId
    setDraggedWorkoutId(null)
    setDropTarget(null)
    await moveWorkoutByDrag(draggedId, weekday, beforeWorkoutId)
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
        ownerId: userProfile.uid,
        intensityZone: normalizeIntensityZones(templateForm.type, templateForm.intensityZone),
        loadTag: normalizeLoadTag(templateForm.type, templateForm.intensityZone, templateForm.loadTag),
        warmup: templateForm.warmup?.trim() || getDefaultWarmup(templateForm.type, templateForm.activityTag),
        cooldown: templateForm.cooldown?.trim() || getDefaultCooldown(templateForm.type, templateForm.activityTag),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      const { id, ...fields } = templateForm
      await updateDoc(doc(db, 'templates', editingTemplate.id), {
        ...fields,
        intensityZone: normalizeIntensityZones(fields.type, fields.intensityZone),
        loadTag: normalizeLoadTag(fields.type, fields.intensityZone, fields.loadTag),
        warmup: fields.warmup?.trim() || getDefaultWarmup(fields.type, fields.activityTag),
        cooldown: fields.cooldown?.trim() || getDefaultCooldown(fields.type, fields.activityTag),
        updatedAt: serverTimestamp(),
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
  const selectedWeekKey = getWeekKey(currentWeek, currentYear)
  const filteredWorkouts = workouts
    .filter(workout => !activeTagFilter || workout.activityTag === activeTagFilter)
    .sort(compareWorkoutsBySchedule)
  const groupedWorkouts = groupWorkoutsByWeekday(filteredWorkouts)
  const overviewWorkoutsByWeekKey = overviewWorkouts.reduce((acc, workout) => {
    const key = getWeekKey(workout.week, workout.year)
    if (!acc[key]) acc[key] = []
    acc[key].push(workout)
    return acc
  }, {})
  const analysisWorkoutsByWeekKey = analysisWorkouts.reduce((acc, workout) => {
    const key = getWeekKey(workout.week, workout.year)
    if (!acc[key]) acc[key] = []
    acc[key].push(workout)
    return acc
  }, {})

  // Get selected athlete name for display
  const selectedAthleteName = athletes.find(a => a.uid === selectedAthleteId)?.displayName
    || (selectedAthleteId === userProfile?.uid ? userProfile?.displayName : null)

  // ─── Render: Custom workout form modal ───
  if (showCustomForm) {
    return (
      <div className="admin-dashboard">
        <header className="admin-header">
          <button className="admin-back-btn" onClick={() => setShowCustomForm(false)}>‹ Avbryt</button>
          <div className="admin-header-copy">
            <span className="brand-eyebrow">Workout Editor</span>
            <span className="admin-header-title">Egendefinert økt</span>
          </div>
          <div style={{ width: 72 }} />
        </header>
        <div className="admin-scroll-area">
          <form onSubmit={handleAddCustom} style={{ padding: '1rem' }}>
            <WorkoutForm value={customForm} onChange={setCustomForm} showCategory showScheduleFields />
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
    <div className={`admin-dashboard${tab === 'builder' ? ' admin-dashboard-wide' : ''}`}>
      {/* ─── Header ─── */}
      <header className="admin-header">
        <button className="admin-back-btn" onClick={onClose}>‹ Tilbake</button>
        <div className="admin-header-copy">
          <span className="brand-eyebrow">Training Planner</span>
          <span className="admin-header-title">
            {isSuperadmin ? 'Adminpanel' : 'Trenerpanel'}
          </span>
        </div>
        <button className="admin-logout-btn" onClick={handleLogout}>Logg ut</button>
      </header>

      {/* ─── Athlete Selector ─── */}
      {athletes.length > 0 && (
        <div className="main-athlete-selector shell-card admin-athlete-shell">
          <div className="selector-meta">
            <span className="selector-label">Utøver</span>
            <span className="selector-help">Velg hvem planen og analysen gjelder for.</span>
          </div>
          <AthleteSelector
            athletes={athletes}
            selectedAthleteId={selectedAthleteId}
            onSelect={onSelectAthlete}
            currentUserProfile={userProfile}
            hideLabel
          />
        </div>
      )}

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
          Ukeplan
        </button>
        <button
          className={`admin-tab${tab === 'oktbank' ? ' active' : ''}`}
          onClick={() => {
            setTab('oktbank')
            setReplacementTarget(null)
          }}
        >
          Øktbank
        </button>
        <button
          className={`admin-tab${tab === 'builder' ? ' active' : ''}`}
          onClick={() => {
            setTab('builder')
            setPickingFromBank(false)
            setReplacementTarget(null)
          }}
        >
          Planverktøy
        </button>
        <button
          className={`admin-tab${tab === 'analysis' ? ' active' : ''}`}
          onClick={() => {
            setTab('analysis')
            setReplacementTarget(null)
          }}
        >
          Analyse
        </button>
        <button
          className={`admin-tab${tab === 'tests' ? ' active' : ''}`}
          onClick={() => {
            setTab('tests')
            setReplacementTarget(null)
          }}
        >
          Tester
        </button>
        {onOpenUserManagement && (
          <button
            className="admin-tab"
            onClick={onOpenUserManagement}
          >
            <SystemIcon name="users" className="button-icon" />
            Brukere
          </button>
        )}
      </div>

      {/* ─── No athlete selected warning ─── */}
      {!selectedAthleteId && tab === 'plan' && (
        <div className="admin-plan">
          <div className="empty-state">
            <div className="empty-icon">UT</div>
            <div>Velg en utøver for å administrere treningsplanen</div>
          </div>
        </div>
      )}

      {!selectedAthleteId && tab === 'builder' && (
        <div className="admin-plan">
          <div className="empty-state">
            <div className="empty-icon">BV</div>
            <div>Velg en utøver for å bruke planverktøyet</div>
          </div>
        </div>
      )}

      {/* ─── Ukeplan tab ─── */}
      {tab === 'plan' && selectedAthleteId && (
        <div className="admin-plan">
          {selectedAthleteName && (
            <div className="admin-athlete-banner">
              Treningsplan for <strong>{selectedAthleteName}</strong>
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
              aria-controls="admin-birds-eye-overview"
              aria-label="Vis oversikt for siste 4 og neste 4 uker"
              title="Siste 4 og neste 4 uker"
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
              <div className="birds-eye-loading admin-overview-loading" id="admin-birds-eye-overview">Laster mengdeoversikt...</div>
            ) : (
              <div className="admin-overview-wrap" id="admin-birds-eye-overview">
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

          <div className="admin-plan-controls">
            <div className="admin-layout-toggle-row">
              <div className="selector-meta">
                <span className="selector-label">Visning</span>
                <span className="selector-help">Velg mellom kalender og liste.</span>
              </div>
              <WorkoutLayoutToggle value={workoutLayout} onChange={onWorkoutLayoutChange} compact />
            </div>
            <div className="admin-tag-filter">
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
          </div>

          <div className="admin-plan-list">
            {loadingWorkouts ? (
              <div className="empty-state">Laster...</div>
            ) : filteredWorkouts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">{activeTagFilter ? 'TG' : 'PL'}</div>
                <div>{activeTagFilter ? 'Ingen økter matcher valgt aktivitet' : 'Ingen økter denne uken'}</div>
              </div>
            ) : workoutLayout === 'calendar' ? (
              groupedWorkouts.map(day => (
                <section key={day.value} className="program-day-section admin-program-day-section">
                  <div className="program-day-header">
                    <div>
                      <h2 className="program-day-title">{day.label}</h2>
                      <div className="program-day-meta">
                        {day.workouts.length > 0 ? `${day.workouts.length} økt${day.workouts.length > 1 ? 'er' : ''}` : 'Ingen økter'}
                      </div>
                    </div>
                    <div className="program-day-actions">
                      <button
                        type="button"
                        className="program-day-btn secondary"
                        onClick={() => {
                          setReplacementTarget(null)
                          setCustomForm(prev => ({ ...prev, weekday: day.value }))
                          setPickingFromBank(true)
                          setTab('oktbank')
                        }}
                      >
                        Fra øktbank
                      </button>
                      <button
                        type="button"
                        className="program-day-btn"
                        onClick={() => {
                          setCustomForm({ ...EMPTY_TEMPLATE, weekday: day.value })
                          setShowCustomForm(true)
                        }}
                      >
                        Ny økt
                      </button>
                    </div>
                  </div>

                  {day.workouts.length === 0 ? (
                    <div className="program-day-slots admin-program-day-slots" style={{ '--slot-count': 2 }}>
                      <div className="program-day-empty-slot admin-program-day-empty-slot">Ledig slot</div>
                      <div className="program-day-empty-slot admin-program-day-empty-slot">Ledig slot</div>
                    </div>
                  ) : (
                    <div
                      className="program-day-slots admin-program-day-slots"
                      style={{ '--slot-count': Math.max(2, day.workouts.length) }}
                    >
                      {Array.from({ length: Math.max(2, day.workouts.length) }, (_, idx) => {
                        const workout = day.workouts[idx]
                        if (!workout) {
                          return (
                            <div
                              key={`empty-${day.value}-${idx}`}
                              className={`program-day-empty-slot admin-program-day-empty-slot${
                                dropTarget?.weekday === day.value && !dropTarget?.beforeWorkoutId ? ' drag-over' : ''
                              }`}
                              onDragOver={e => {
                                e.preventDefault()
                                handleDropTargetChange(day.value)
                              }}
                              onDrop={async e => {
                                e.preventDefault()
                                await handleDropWorkout(day.value)
                              }}
                            >
                              Ledig slot
                            </div>
                          )
                        }

                        return (
                          <AdminWorkoutSlot
                            key={workout.id}
                            workout={workout}
                            index={idx}
                            total={day.workouts.length}
                            onClick={setSelectedWorkout}
                            onDelete={handleDeleteWorkout}
                            onReplace={handleStartReplaceWorkout}
                            onToggleComplete={handleToggleComplete}
                            onMoveUp={() => moveWorkout(workout, -1)}
                            onMoveDown={() => moveWorkout(workout, 1)}
                            isDragging={draggedWorkoutId === workout.id}
                            isDropTarget={dropTarget?.beforeWorkoutId === workout.id}
                            onDragStart={() => handleDragStart(workout)}
                            onDragEnd={handleDragEnd}
                            onDragOver={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDropTargetChange(day.value, workout.id)
                            }}
                            onDrop={async e => {
                              e.preventDefault()
                              e.stopPropagation()
                              await handleDropWorkout(day.value, workout.id)
                            }}
                          />
                        )
                      })}
                    </div>
                  )}

                  <div
                    className={`admin-day-dropzone${
                      dropTarget?.weekday === day.value && !dropTarget?.beforeWorkoutId ? ' drag-over' : ''
                    }`}
                    onDragOver={e => {
                      e.preventDefault()
                      handleDropTargetChange(day.value)
                    }}
                    onDrop={async e => {
                      e.preventDefault()
                      await handleDropWorkout(day.value)
                    }}
                  >
                    Slipp her for å legge økten sist denne dagen
                  </div>
                </section>
              ))
            ) : (
              <div className="workout-list admin-workout-list">
                {filteredWorkouts.map((workout, index) => (
                  <AdminWorkoutSlot
                    key={workout.id}
                    workout={workout}
                    index={index}
                    total={filteredWorkouts.length}
                    onClick={setSelectedWorkout}
                    onDelete={handleDeleteWorkout}
                    onReplace={handleStartReplaceWorkout}
                    onToggleComplete={handleToggleComplete}
                    onMoveUp={() => moveWorkout(workout, -1)}
                    onMoveDown={() => moveWorkout(workout, 1)}
                    isDragging={draggedWorkoutId === workout.id}
                    isDropTarget={dropTarget?.beforeWorkoutId === workout.id}
                    onDragStart={() => handleDragStart(workout)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDropTargetChange(workout.weekday, workout.id)
                    }}
                    onDrop={async e => {
                      e.preventDefault()
                      e.stopPropagation()
                      await handleDropWorkout(workout.weekday, workout.id)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'analysis' && (
        <div className="admin-analysis">
          {!selectedAthleteId ? (
            <div className="empty-state">
              <div className="empty-icon">AN</div>
              <div>Velg en utøver for å se analyse</div>
            </div>
          ) : loadingAnalysis ? (
            <div className="empty-state">Laster analyse...</div>
          ) : (
            <AnalysisDashboard
              weeks={analysisWeeks}
              workoutsByWeekKey={analysisWorkoutsByWeekKey}
              athleteName={selectedAthleteName}
              currentWeek={currentWeek}
              currentYear={currentYear}
            />
          )}
        </div>
      )}

      {tab === 'tests' && (
        <div className="admin-analysis">
          {!selectedAthleteId ? (
            <div className="empty-state">
              <div className="empty-icon">TS</div>
              <div>Velg en utøver for å administrere tester</div>
            </div>
          ) : (
            <TestingDashboard
              selectedAthleteId={selectedAthleteId}
              athleteName={selectedAthleteName}
              userProfile={userProfile}
            />
          )}
        </div>
      )}

      {tab === 'builder' && selectedAthleteId && (
        <AdminPlanBuilder
          currentWeek={currentWeek}
          currentYear={currentYear}
          monday={monday}
          sunday={sunday}
          isThisWeek={isThisWeek}
          workoutLayout={workoutLayout}
          selectedAthleteName={selectedAthleteName}
          workouts={workouts}
          loadingWorkouts={loadingWorkouts}
          templates={templates}
          loadingTemplates={loadingTemplates}
          overviewWeeks={overviewWeeks}
          overviewWorkoutsByWeekKey={overviewWorkoutsByWeekKey}
          loadingOverview={loadingOverview}
          analysisWeeks={analysisWeeks}
          analysisWorkoutsByWeekKey={analysisWorkoutsByWeekKey}
          loadingAnalysis={loadingAnalysis}
          onWeekChange={onWeekChange}
          onSelectWorkout={setSelectedWorkout}
          onDeleteWorkout={handleDeleteWorkout}
          onToggleComplete={handleToggleComplete}
          onMoveWorkout={moveWorkout}
          onMoveWorkoutByDrag={moveWorkoutByDrag}
          onAddTemplateToDay={handleAddTemplateToDay}
          onEditTemplate={startEditTemplate}
        />
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
                  onEdit={template.source === 'custom' ? () => startEditTemplate(template) : null}
                  onDelete={template.source === 'custom' ? () => handleDeleteTemplate(template) : null}
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
          canEdit
          onDelete={handleDeleteWorkout}
          onToggleComplete={handleToggleComplete}
          onSaveComment={handleSaveComment}
          onEdit={handleEditWorkout}
        />
      )}

      {editingTemplate !== null && (
        <div className="modal-backdrop" onClick={event => {
          if (event.target === event.currentTarget) {
            setEditingTemplate(null)
          }
        }}>
          <div className="modal add-modal">
            <button className="modal-close" onClick={() => setEditingTemplate(null)}>
              <SystemIcon name="close" className="system-icon" />
            </button>
            <h2 className="modal-title-h2">{editingTemplate === 'new' ? 'Ny mal' : 'Rediger mal'}</h2>
            <form onSubmit={handleSaveTemplate}>
              <WorkoutForm value={templateForm} onChange={setTemplateForm} showCategory />
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn-cancel" onClick={() => setEditingTemplate(null)}>Avbryt</button>
                <button type="submit" className="btn-save">Lagre mal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Admin Workout Row ─────────────────────────────────────────────────────

function AdminWorkoutSlot({
  workout,
  index,
  total,
  onClick,
  onDelete,
  onReplace,
  onToggleComplete,
  onMoveUp,
  onMoveDown,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  const typeColors = TYPE_COLORS[workout.type] || TYPE_COLORS.annet
  const icon = TYPE_ICONS[workout.type] || 'AN'
  const activityTag = workout.activityTag ? ACTIVITY_TAG_MAP[workout.activityTag] : null
  const loadTag = workout.loadTag ? LOAD_TAG_MAP[workout.loadTag] : null
  const scheduleLabel = formatWorkoutTime(workout) || formatWorkoutSchedule(workout, { includeWeekday: false })

  return (
    <div
      className={`admin-workout-slot${workout.completed ? ' completed' : ''}${isDragging ? ' dragging' : ''}${isDropTarget ? ' drag-over' : ''}`}
      style={{ borderLeftColor: typeColors.border }}
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
          <button
            className="reorder-btn"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Flytt opp"
          ><SystemIcon name="up" className="system-icon" /></button>
          <button
            className="reorder-btn"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Flytt ned"
          ><SystemIcon name="down" className="system-icon" /></button>
        </div>
      </div>

      <div className="admin-slot-main" onClick={() => onClick(workout)}>
        <div className="admin-row-info">
          {scheduleLabel && <span className="card-date">{scheduleLabel}</span>}
          <span className="card-title">{workout.title}</span>
          {workout.description && (
            <span className="card-desc admin-slot-desc">{workout.description}</span>
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

      <div className="admin-slot-footer">
        <button className="reorder-btn" onClick={() => onReplace(workout)} title="Bytt ut fra øktbank"><SystemIcon name="replace" className="system-icon" /></button>
        <button
          className={`check-btn${workout.completed ? ' checked' : ''}`}
          onClick={() => onToggleComplete(workout)}
        >
          {workout.completed ? <SystemIcon name="check" className="system-icon" /> : null}
        </button>
        <button className="delete-btn" onClick={() => onDelete(workout)} title="Slett"><SystemIcon name="delete" className="system-icon" /></button>
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
  const icon = TYPE_ICONS[template.type] || 'AN'
  const activityTag = template.activityTag ? ACTIVITY_TAG_MAP[template.activityTag] : null
  const loadTag = template.loadTag ? LOAD_TAG_MAP[template.loadTag] : null
  const isCustomTemplate = template.source === 'custom'

  return (
    <div
      className="template-card"
      style={{ backgroundColor: typeColors.bg, borderLeftColor: typeColors.border }}
    >
      <div className="template-card-top">
        <div className="template-card-left">
          <span className="template-icon"><ActivityIcon name={icon} className="ui-icon" /></span>
          <div>
            <div className="template-title">{template.title}</div>
            {template.category && (
              <div className="template-category">{template.category}</div>
            )}
            {!pickMode && (
              <div className="template-category">{isCustomTemplate ? 'Egen mal' : 'Standardmal'}</div>
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

      <div className="template-actions">
        {pickMode ? (
          <button className="btn-template-pick" onClick={onPick}>
            {replacementMode ? 'Bytt ut økt' : '+ Legg til i plan'}
          </button>
        ) : isCustomTemplate ? (
          <>
            <button className="btn-template-edit" onClick={onEdit}><SystemIcon name="edit" className="button-icon" />Rediger</button>
            <button className="btn-template-delete" onClick={onDelete}><SystemIcon name="delete" className="button-icon" />Slett</button>
          </>
        ) : (
          <span className="template-category">Kan brukes i plan, men ikke redigeres her</span>
        )}
      </div>
    </div>
  )
}
