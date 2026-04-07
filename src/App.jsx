import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, query, where, onSnapshot,
  updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db, auth } from './firebase'
import {
  TYPE_COLORS,
  TYPE_ICONS,
  ZONE_COLORS,
  getAdjacentWeek,
  getIntensityZoneLabel,
  getWeekKey,
  getWeekNumber,
  getWeekDates,
  getWeekWindow,
  normalizeIntensityZone,
  normalizeIntensityZones,
  normalizeWorkout,
} from './utils'
import WorkoutCard from './components/WorkoutCard'
import WorkoutDetail from './components/WorkoutDetail'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'
import BirdsEyeOverview from './components/BirdsEyeOverview'

export default function App() {
  const today = new Date()
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(today))
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [workouts, setWorkouts] = useState([])
  const [overviewWorkouts, setOverviewWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [overviewLoading, setOverviewLoading] = useState(true)

  const [user, setUser] = useState(undefined)
  const [showLogin, setShowLogin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showOverview, setShowOverview] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [replacementTarget, setReplacementTarget] = useState(null)

  const overviewWeeks = getWeekWindow(currentWeek, currentYear, 4, 4)
  const overviewWeekKeys = new Set(overviewWeeks.map(week => week.key))
  const selectedWeekKey = getWeekKey(currentWeek, currentYear)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u))
    return unsub
  }, [])

  useEffect(() => {
    setLoading(true)
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
      setLoading(false)
    })
    return unsub
  }, [currentWeek, currentYear])

  useEffect(() => {
    setOverviewLoading(true)
    setOverviewWorkouts([])

    const years = [...new Set(overviewWeeks.map(week => week.year))]
    const workoutMap = new Map()
    const loadedYears = new Set()

    const unsubscribers = years.map(year => onSnapshot(
      query(collection(db, 'workouts'), where('year', '==', year)),
      snap => {
        for (const [id, workout] of [...workoutMap.entries()]) {
          if (workout.year === year) {
            workoutMap.delete(id)
          }
        }

        snap.docs.forEach(docSnap => {
          const normalized = normalizeWorkout({ id: docSnap.id, ...docSnap.data() })
          const key = getWeekKey(normalized.week, normalized.year)
          if (overviewWeekKeys.has(key)) {
            workoutMap.set(normalized.id, normalized)
          }
        })

        loadedYears.add(year)
        setOverviewWorkouts(
          [...workoutMap.values()].sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year
            if (a.week !== b.week) return a.week - b.week
            return (a.order ?? 0) - (b.order ?? 0)
          })
        )
        if (loadedYears.size >= years.length) {
          setOverviewLoading(false)
        }
      }
    ))

    return () => unsubscribers.forEach(unsub => unsub())
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
    setLoadingTemplates(true)
    const unsub = onSnapshot(collection(db, 'templates'), snap => {
      const docs = snap.docs
        .map(d => normalizeWorkout({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const categoryCompare = (a.category || '').localeCompare(b.category || '')
          if (categoryCompare !== 0) return categoryCompare
          return (a.title || '').localeCompare(b.title || '')
        })
      setTemplates(docs)
      setLoadingTemplates(false)
    })
    return unsub
  }, [])

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

  function goToToday() {
    setCurrentWeek(getWeekNumber(today))
    setCurrentYear(today.getFullYear())
  }

  function handleWeekChange(week, year) {
    setCurrentWeek(week)
    setCurrentYear(year)
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

  function handleStartReplaceWorkout(workout) {
    setReplacementTarget(workout)
    setSelectedWorkout(null)
  }

  async function handleReplaceWithTemplate(template) {
    if (!replacementTarget) return

    const shouldReplace = window.confirm(
      `Er du sikker på at du vil bytte ut økten "${replacementTarget.title}" med "${template.title}"?`
    )
    if (!shouldReplace) return

    const { id, createdAt, updatedAt, templateId, source, ...fields } = template
    await updateDoc(doc(db, 'workouts', replacementTarget.id), {
      ...fields,
      intensityZone: normalizeIntensityZones(fields.type, fields.intensityZone),
      week: replacementTarget.week,
      year: replacementTarget.year,
      order: replacementTarget.order ?? 0,
      completed: false,
      completedAt: null,
      userComment: '',
      userCommentUpdatedAt: null,
      updatedAt: serverTimestamp(),
    })

    setReplacementTarget(null)
  }

  function closeTemplatePicker() {
    setReplacementTarget(null)
  }

  const { monday, sunday } = getWeekDates(currentWeek, currentYear)
  const doneCount = workouts.filter(w => w.completed).length
  const isThisWeek = currentWeek === getWeekNumber(today) && currentYear === today.getFullYear()
  const isAdmin = !!user
  const overviewByWeekKey = overviewWorkouts.reduce((acc, workout) => {
    const key = getWeekKey(workout.week, workout.year)
    if (!acc[key]) acc[key] = []
    acc[key].push(workout)
    return acc
  }, {})

  if (showAdmin && isAdmin) {
    return (
      <AdminDashboard
        user={user}
        onClose={() => setShowAdmin(false)}
        currentWeek={currentWeek}
        currentYear={currentYear}
        onWeekChange={handleWeekChange}
        overviewWeeks={overviewWeeks}
        overviewWorkoutsByWeekKey={overviewByWeekKey}
        overviewLoading={overviewLoading}
      />
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1 className="app-title">Treningsplan</h1>
          {user === undefined ? null : user ? (
            <button className="admin-btn active" onClick={() => setShowAdmin(true)} title="Admin">
              ⚙️
            </button>
          ) : (
            <button className="admin-btn" onClick={() => setShowLogin(true)} title="Logg inn">
              🔒
            </button>
          )}
        </div>

        <div className="week-nav">
          <button className="nav-btn" onClick={prevWeek}>‹</button>
          <div className="week-info" onClick={goToToday}>
            <span className="week-label">
              Uke {currentWeek}
              {isThisWeek && <span className="this-week-dot"> •</span>}
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
            aria-controls="birds-eye-overview"
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
      </header>

      <main className="main">
        {showOverview && (
          overviewLoading ? (
            <div className="birds-eye-loading" id="birds-eye-overview">Laster ukeoversikt...</div>
          ) : (
            <BirdsEyeOverview
              weeks={overviewWeeks}
              workoutsByWeekKey={overviewByWeekKey}
              selectedWeekKey={selectedWeekKey}
              onSelectWeek={(week, year) => {
                handleWeekChange(week, year)
                setShowOverview(false)
              }}
            />
          )
        )}

        {loading ? (
          <div className="empty-state">Laster...</div>
        ) : workouts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏃</div>
            <div>Ingen økter denne uken</div>
          </div>
        ) : (
          <>
            <div className="week-summary">
              {doneCount}/{workouts.length} fullført denne uken
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(doneCount / workouts.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="workout-list">
              {workouts.map((w, idx) => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  index={idx}
                  onClick={setSelectedWorkout}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {selectedWorkout && (
        <WorkoutDetail
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          isAdmin={isAdmin}
          onReplace={handleStartReplaceWorkout}
          onDelete={async (w) => {
            await deleteDoc(doc(db, 'workouts', w.id))
            setSelectedWorkout(null)
          }}
          onToggleComplete={handleToggleComplete}
          onSaveComment={handleSaveComment}
          onEdit={async (updated) => {
            const { id, ...fields } = updated
            await updateDoc(doc(db, 'workouts', id), fields)
            setSelectedWorkout(null)
          }}
        />
      )}

      {replacementTarget && (
        <TemplatePickerModal
          targetWorkout={replacementTarget}
          templates={templates}
          loading={loadingTemplates}
          onClose={closeTemplatePicker}
          onPick={handleReplaceWithTemplate}
        />
      )}

      {showLogin && <Login onClose={() => setShowLogin(false)} />}
    </div>
  )
}

function TemplatePickerModal({ targetWorkout, templates, loading, onClose, onPick }) {
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal add-modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title-h2">Bytt økt</h2>
        <p className="template-picker-subtitle">
          Velg en ny økt fra øktbanken for å erstatte &quot;{targetWorkout.title}&quot;.
        </p>

        {loading ? (
          <div className="empty-state">Laster øktbank...</div>
        ) : templates.length === 0 ? (
          <div className="empty-state">Ingen økter tilgjengelig i øktbanken.</div>
        ) : (
          <div className="template-list template-picker-list">
            {templates.map(template => (
              <TemplatePickerCard
                key={template.id}
                template={template}
                onPick={() => onPick(template)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TemplatePickerCard({ template, onPick }) {
  const typeColors = TYPE_COLORS[template.type] || TYPE_COLORS.annet
  const zone = normalizeIntensityZone(template.type, template.intensityZone)
  const zoneColors = zone ? ZONE_COLORS[zone] : null
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
            {template.category && <div className="template-category">{template.category}</div>}
          </div>
        </div>
        {zone && zoneLabel && zoneColors && (
          <span
            className="zone-badge"
            style={{ backgroundColor: zoneColors.border, color: zoneColors.text }}
          >
            {zoneLabel}
          </span>
        )}
      </div>

      {template.description && <div className="template-desc">{template.description}</div>}

      <div className="template-actions">
        <button className="btn-template-pick" onClick={onPick}>
          Bytt til denne
        </button>
      </div>
    </div>
  )
}
