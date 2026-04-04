import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db, auth } from './firebase'
import { getWeekNumber, getWeekDates, isoDate } from './utils'
import WorkoutCard from './components/WorkoutCard'
import WorkoutDetail from './components/WorkoutDetail'
import AddWorkout from './components/AddWorkout'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'

export default function App() {
  const today = new Date()
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(today))
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  const [user, setUser] = useState(undefined) // undefined = checking, null = not logged in
  const [showLogin, setShowLogin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u))
    return unsub
  }, [])

  const { monday, sunday } = getWeekDates(currentWeek, currentYear)
  const mondayStr = isoDate(monday)
  const sundayStr = isoDate(sunday)

  useEffect(() => {
    setLoading(true)
    const q = query(
      collection(db, 'workouts'),
      where('date', '>=', mondayStr),
      where('date', '<=', sundayStr)
    )
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.date.localeCompare(b.date))
      setWorkouts(docs)
      setLoading(false)
    })
    return unsub
  }, [mondayStr, sundayStr])

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

  async function handleSaveWorkout(form) {
    await addDoc(collection(db, 'workouts'), {
      ...form,
      completed: false,
      createdAt: serverTimestamp(),
    })
    setShowAdd(false)
  }

  async function handleToggleComplete(workout) {
    const ref = doc(db, 'workouts', workout.id)
    await updateDoc(ref, {
      completed: !workout.completed,
      completedAt: !workout.completed ? serverTimestamp() : null,
    })
    if (selectedWorkout?.id === workout.id) {
      setSelectedWorkout(prev => ({ ...prev, completed: !prev.completed }))
    }
  }

  async function handleDelete(workout) {
    if (!window.confirm(`Slett "${workout.title}"?`)) return
    await deleteDoc(doc(db, 'workouts', workout.id))
    setSelectedWorkout(null)
  }

  const doneCount = workouts.filter(w => w.completed).length
  const isThisWeek = currentWeek === getWeekNumber(today) && currentYear === today.getFullYear()
  const isAdmin = !!user

  // Show admin dashboard as full-screen page
  if (showAdmin && isAdmin) {
    return (
      <AdminDashboard
        user={user}
        onClose={() => setShowAdmin(false)}
      />
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1 className="app-title">Treningsplan</h1>
          {user === undefined ? null : user ? (
            <button
              className="admin-btn active"
              onClick={() => setShowAdmin(true)}
              title="Åpne admin"
            >
              ⚙️
            </button>
          ) : (
            <button
              className="admin-btn"
              onClick={() => setShowLogin(true)}
              title="Admin-pålogging"
            >
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
            {isAdmin && (
              <button className="btn-add-empty" onClick={() => setShowAdd(true)}>
                + Legg til økt
              </button>
            )}
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
              {workouts.map(w => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  onClick={setSelectedWorkout}
                  isAdmin={isAdmin}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {isAdmin && (
        <button className="fab" onClick={() => setShowAdd(true)}>+</button>
      )}

      {selectedWorkout && (
        <WorkoutDetail
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          isAdmin={isAdmin}
          onDelete={handleDelete}
          onToggleComplete={handleToggleComplete}
        />
      )}

      {showAdd && (
        <AddWorkout
          onSave={handleSaveWorkout}
          onClose={() => setShowAdd(false)}
          initialDate={mondayStr}
        />
      )}

      {showLogin && (
        <Login onClose={() => setShowLogin(false)} />
      )}
    </div>
  )
}
