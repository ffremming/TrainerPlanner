import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db, auth } from './firebase'
import { getWeekNumber, getWeekDates } from './utils'
import WorkoutCard from './components/WorkoutCard'
import WorkoutDetail from './components/WorkoutDetail'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'

export default function App() {
  const today = new Date()
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(today))
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  const [user, setUser] = useState(undefined)
  const [showLogin, setShowLogin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)

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
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setWorkouts(docs)
      setLoading(false)
    })
    return unsub
  }, [currentWeek, currentYear])

  function prevWeek() {
    if (currentWeek === 1) { setCurrentWeek(52); setCurrentYear(y => y - 1) }
    else setCurrentWeek(w => w - 1)
  }

  function nextWeek() {
    if (currentWeek >= 52) { setCurrentWeek(1); setCurrentYear(y => y + 1) }
    else setCurrentWeek(w => w + 1)
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

  const { monday, sunday } = getWeekDates(currentWeek, currentYear)
  const doneCount = workouts.filter(w => w.completed).length
  const isThisWeek = currentWeek === getWeekNumber(today) && currentYear === today.getFullYear()
  const isAdmin = !!user

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
        </div>
      </header>

      <main className="main">
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
            const { deleteDoc, doc: d } = await import('firebase/firestore')
            await deleteDoc(d(db, 'workouts', w.id))
            setSelectedWorkout(null)
          }}
          onToggleComplete={handleToggleComplete}
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
