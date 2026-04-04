import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../firebase'
import { getWeekNumber, getWeekDates, isoDate, ZONE_COLORS, TYPE_ICONS, formatDate } from '../utils'
import { WORKOUT_TEMPLATES, TEMPLATE_CATEGORIES } from '../workoutTemplates'
import AddWorkout from './AddWorkout'
import AddFromTemplate from './AddFromTemplate'
import WorkoutDetail from './WorkoutDetail'

export default function AdminDashboard({ user, onClose }) {
  const today = new Date()
  const [tab, setTab] = useState('plan') // 'plan' | 'oktbank'
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(today))
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  // Øktbank state
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Modals
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)

  const { monday, sunday } = getWeekDates(currentWeek, currentYear)
  const mondayStr = isoDate(monday)
  const sundayStr = isoDate(sunday)
  const isThisWeek = currentWeek === getWeekNumber(today) && currentYear === today.getFullYear()

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

  async function handleSave(form) {
    await addDoc(collection(db, 'workouts'), {
      ...form,
      completed: false,
      createdAt: serverTimestamp(),
    })
    setShowAddCustom(false)
    setSelectedTemplate(null)
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

  async function handleLogout() {
    await signOut(auth)
    onClose()
  }

  const filteredTemplates = activeCategory === 'Alle'
    ? WORKOUT_TEMPLATES
    : WORKOUT_TEMPLATES.filter(t => t.category === activeCategory)

  return (
    <div className="admin-dashboard">
      {/* ─── Admin Header ─── */}
      <header className="admin-header">
        <button className="admin-back-btn" onClick={onClose}>‹ Tilbake</button>
        <span className="admin-header-title">Admin</span>
        <button className="admin-logout-btn" onClick={handleLogout}>Logg ut</button>
      </header>

      {/* ─── Tab Bar ─── */}
      <div className="admin-tabs">
        <button
          className={`admin-tab${tab === 'plan' ? ' active' : ''}`}
          onClick={() => setTab('plan')}
        >
          📅 Ukeplan
        </button>
        <button
          className={`admin-tab${tab === 'oktbank' ? ' active' : ''}`}
          onClick={() => setTab('oktbank')}
        >
          📚 Øktbank
        </button>
      </div>

      {/* ─── Plan Tab ─── */}
      {tab === 'plan' && (
        <div className="admin-plan">
          {/* Week Nav */}
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

          {/* Workout list */}
          <div className="admin-plan-list">
            {loading ? (
              <div className="empty-state">Laster...</div>
            ) : workouts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <div>Ingen økter denne uken</div>
              </div>
            ) : (
              workouts.map(w => (
                <AdminWorkoutRow
                  key={w.id}
                  workout={w}
                  onClick={setSelectedWorkout}
                  onDelete={handleDelete}
                  onToggleComplete={handleToggleComplete}
                />
              ))
            )}
          </div>

          {/* Add buttons */}
          <div className="admin-plan-actions">
            <button className="btn-admin-add" onClick={() => setShowAddCustom(true)}>
              + Egendefinert økt
            </button>
            <button className="btn-admin-add secondary" onClick={() => setTab('oktbank')}>
              + Fra øktbank
            </button>
          </div>
        </div>
      )}

      {/* ─── Øktbank Tab ─── */}
      {tab === 'oktbank' && (
        <div className="admin-oktbank">
          <div className="oktbank-header">
            <h2 className="oktbank-title">Øktbank</h2>
            <p className="oktbank-subtitle">Trykk på en økt for å legge den til i planen</p>
          </div>

          {/* Category filter */}
          <div className="category-filter">
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`cat-btn${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div className="template-list">
            {filteredTemplates.map(template => {
              const colors = ZONE_COLORS[template.intensityZone || 2]
              const icon = TYPE_ICONS[template.type] || '📋'
              return (
                <button
                  key={template.id}
                  className="template-card"
                  style={{ backgroundColor: colors.bg, borderLeftColor: colors.border }}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="template-card-top">
                    <span className="template-icon">{icon}</span>
                    <span
                      className="zone-badge"
                      style={{ backgroundColor: colors.border, color: colors.text }}
                    >
                      {colors.label}
                    </span>
                  </div>
                  <div className="template-title">{template.title}</div>
                  <div className="template-desc">{template.description}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Modals ─── */}
      {showAddCustom && (
        <AddWorkout
          onSave={handleSave}
          onClose={() => setShowAddCustom(false)}
          initialDate={mondayStr}
        />
      )}

      {selectedTemplate && (
        <AddFromTemplate
          template={selectedTemplate}
          initialDate={mondayStr}
          onSave={handleSave}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {selectedWorkout && (
        <WorkoutDetail
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          isAdmin
          onDelete={handleDelete}
          onToggleComplete={handleToggleComplete}
        />
      )}
    </div>
  )
}

function AdminWorkoutRow({ workout, onClick, onDelete, onToggleComplete }) {
  const colors = ZONE_COLORS[workout.intensityZone || 1]
  const icon = TYPE_ICONS[workout.type] || '📋'

  return (
    <div
      className={`admin-workout-row${workout.completed ? ' completed' : ''}`}
      style={{ borderLeftColor: colors.border }}
    >
      <div className="admin-row-main" onClick={() => onClick(workout)}>
        <span className="card-icon">{icon}</span>
        <div className="admin-row-info">
          <span className="card-date">{formatDate(workout.date)}</span>
          <span className="card-title">{workout.title}</span>
        </div>
      </div>
      <div className="admin-row-actions">
        <button
          className={`check-btn${workout.completed ? ' checked' : ''}`}
          onClick={() => onToggleComplete(workout)}
        >
          {workout.completed ? '✓' : '○'}
        </button>
        <button
          className="delete-btn"
          onClick={() => onDelete(workout)}
          title="Slett"
        >
          🗑
        </button>
      </div>
    </div>
  )
}
