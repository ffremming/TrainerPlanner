import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, query, where, onSnapshot,
  updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db, auth } from './firebase'
import {
  getAdjacentWeek,
  getWeekKey,
  getWeekNumber,
  getWeekDates,
  getWeekWindow,
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
    return <AdminDashboard user={user} onClose={() => setShowAdmin(false)} />
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
                setCurrentWeek(week)
                setCurrentYear(year)
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

      {showLogin && <Login onClose={() => setShowLogin(false)} />}
    </div>
  )
}
