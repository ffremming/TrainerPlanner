import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, query, where, onSnapshot,
  updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db, auth } from './firebase'
import {
  compareWorkoutsBySchedule,
  TYPE_COLORS,
  TYPE_ICONS,
  ZONE_COLORS,
  formatWorkoutTime,
  getDateStringForWeekday,
  getAdjacentWeek,
  getDefaultCooldown,
  getDefaultWarmup,
  getIntensityZoneLabel,
  getWeekKey,
  getWeekNumber,
  getWeekDates,
  getWeekWindow,
  groupWorkoutsByWeekday,
  normalizeLoadTag,
  normalizeIntensityZone,
  normalizeIntensityZones,
  normalizeWorkout,
} from './utils'
import { mergeTemplates } from './templateLibrary'
import {
  getUserProfile,
  createUserProfile,
  onUserProfileSnapshot,
  onCoachAthletesSnapshot,
  onAllUsersSnapshot,
  updateUserProfile,
} from './userService'
import { hasRole } from './roles'
import WorkoutCard from './components/WorkoutCard'
import WorkoutDetail from './components/WorkoutDetail'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'
import UserManagement from './components/UserManagement'
import BirdsEyeOverview from './components/BirdsEyeOverview'
import ActivityIcon from './components/ActivityIcon'
import SystemIcon from './components/SystemIcon'

export default function App() {
  const today = new Date()
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(today))
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [workouts, setWorkouts] = useState([])
  const [overviewWorkouts, setOverviewWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [overviewLoading, setOverviewLoading] = useState(true)

  const [user, setUser] = useState(undefined)
  const [userProfile, setUserProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [showLogin, setShowLogin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showOverview, setShowOverview] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [replacementTarget, setReplacementTarget] = useState(null)

  // Athletes for coach/superadmin
  const [athletes, setAthletes] = useState([])
  const [selectedAthleteId, setSelectedAthleteId] = useState(null)

  const overviewWeeks = getWeekWindow(currentWeek, currentYear, 4, 4)
  const overviewWeekKeys = new Set(overviewWeeks.map(week => week.key))
  const selectedWeekKey = getWeekKey(currentWeek, currentYear)

  // Role flags
  const isSuperadmin = hasRole(userProfile, 'superadmin')
  const isCoach = hasRole(userProfile, 'coach')
  const isAthlete = hasRole(userProfile, 'athlete')
  const canManageWorkouts = isSuperadmin || isCoach
  const workoutLayout = userProfile?.workoutLayout === 'list' ? 'list' : 'calendar'
  const selectedAthleteProfile = athletes.find(athlete => athlete.uid === selectedAthleteId) || null
  const adminWorkoutLayout = selectedAthleteProfile?.workoutLayout === 'list' ? 'list' : 'calendar'

  // ─── Auth state ───
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u))
    return unsub
  }, [])

  // ─── User profile loading + auto-create superadmin ───
  useEffect(() => {
    if (!user) {
      setUserProfile(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)
    let cancelled = false

    async function initProfile() {
      const existing = await getUserProfile(user.uid)
      if (cancelled) return

      if (!existing) {
        // First user with no profile becomes superadmin
        await createUserProfile(user.uid, user.email, user.email.split('@')[0], 'superadmin')
      }

      // Start real-time listener
      const unsub = onUserProfileSnapshot(user.uid, profile => {
        if (!cancelled) {
          setUserProfile(profile)
          setProfileLoading(false)
        }
      })

      return unsub
    }

    let unsubProfile = null
    initProfile().then(unsub => { unsubProfile = unsub })

    return () => {
      cancelled = true
      if (unsubProfile) unsubProfile()
    }
  }, [user])

  // ─── Load athletes for coach/superadmin ───
  useEffect(() => {
    if (!userProfile) {
      setAthletes([])
      setSelectedAthleteId(null)
      return
    }

    if (isCoach) {
      const unsub = onCoachAthletesSnapshot(userProfile.uid, athleteList => {
        const nextAthletes = [
          userProfile,
          ...athleteList.filter(a => a.uid !== userProfile.uid),
        ]

        setAthletes(nextAthletes)
        setSelectedAthleteId(prev => {
          if (prev && nextAthletes.some(a => a.uid === prev)) return prev
          return userProfile.uid
        })
      })
      return unsub
    }

    if (isSuperadmin) {
      const unsub = onAllUsersSnapshot(allUsers => {
        const athleteList = allUsers.filter(u => hasRole(u, 'athlete'))
        setAthletes(athleteList)
        setSelectedAthleteId(prev => {
          if (prev && allUsers.some(a => a.uid === prev)) return prev
          // Default to self, or first athlete
          if (allUsers.some(a => a.uid === userProfile.uid)) return userProfile.uid
          return athleteList.length > 0 ? athleteList[0].uid : userProfile.uid
        })
      })
      return unsub
    }

    if (isAthlete) {
      setSelectedAthleteId(userProfile.uid)
      setAthletes([userProfile])
      return
    }
  }, [userProfile, isAthlete, isCoach, isSuperadmin])

  const homeAthleteId = userProfile?.uid || user?.uid

  // ─── Home workouts listener (always scoped to current user) ───
  useEffect(() => {
    if (!homeAthleteId) {
      setWorkouts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, 'workouts'),
      where('athleteId', '==', homeAthleteId),
      where('year', '==', currentYear),
      where('week', '==', currentWeek)
    )
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => normalizeWorkout({ id: d.id, ...d.data() }))
        .sort(compareWorkoutsBySchedule)
      setWorkouts(docs)
      setLoading(false)
    })
    return unsub
  }, [currentWeek, currentYear, homeAthleteId])

  // ─── Home overview workouts listener (always scoped to current user) ───
  useEffect(() => {
    if (!homeAthleteId) {
      setOverviewWorkouts([])
      setOverviewLoading(false)
      return
    }

    setOverviewLoading(true)
    setOverviewWorkouts([])

    const years = [...new Set(overviewWeeks.map(week => week.year))]
    const workoutMap = new Map()
    const loadedYears = new Set()

    const unsubscribers = years.map(year => onSnapshot(
      query(
        collection(db, 'workouts'),
        where('athleteId', '==', homeAthleteId),
        where('year', '==', year)
      ),
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
            return compareWorkoutsBySchedule(a, b)
          })
        )
        if (loadedYears.size >= years.length) {
          setOverviewLoading(false)
        }
      }
    ))

    return () => unsubscribers.forEach(unsub => unsub())
  }, [currentWeek, currentYear, homeAthleteId])

  useEffect(() => {
    if (!selectedWorkout) return
    const freshWorkout = workouts.find(w => w.id === selectedWorkout.id)
    if (freshWorkout) {
      setSelectedWorkout(freshWorkout)
      return
    }
    setSelectedWorkout(null)
  }, [workouts, selectedWorkout])

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

  async function handleSaveComment(workout, payload) {
    const userComment = typeof payload === 'string' ? payload : payload.userComment
    const formScore = typeof payload === 'string' ? (workout.formScore ?? null) : payload.formScore
    const surplusScore = typeof payload === 'string' ? (workout.surplusScore ?? null) : payload.surplusScore

    await updateDoc(doc(db, 'workouts', workout.id), {
      userComment,
      formScore,
      surplusScore,
      userCommentUpdatedAt: serverTimestamp(),
    })
    if (selectedWorkout?.id === workout.id) {
      setSelectedWorkout(prev => ({ ...prev, userComment, formScore, surplusScore }))
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
    const intensityZone = normalizeIntensityZones(fields.type, fields.intensityZone)
    await updateDoc(doc(db, 'workouts', replacementTarget.id), {
      ...fields,
      intensityZone,
      loadTag: normalizeLoadTag(fields.type, intensityZone, fields.loadTag),
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
      updatedAt: serverTimestamp(),
    })

    setReplacementTarget(null)
  }

  function closeTemplatePicker() {
    setReplacementTarget(null)
  }

  async function handleWorkoutLayoutChange(nextLayout) {
    const targetUserId = selectedAthleteId || userProfile?.uid
    if (!targetUserId || nextLayout === adminWorkoutLayout) return
    await updateUserProfile(targetUserId, { workoutLayout: nextLayout })
  }

  const { monday, sunday } = getWeekDates(currentWeek, currentYear)
  const doneCount = workouts.filter(w => w.completed).length
  const isThisWeek = currentWeek === getWeekNumber(today) && currentYear === today.getFullYear()
  const workoutDays = groupWorkoutsByWeekday(workouts)
  const overviewByWeekKey = overviewWorkouts.reduce((acc, workout) => {
    const key = getWeekKey(workout.week, workout.year)
    if (!acc[key]) acc[key] = []
    acc[key].push(workout)
    return acc
  }, {})

  // ─── Auth loading state ───
  if (user === undefined || (user && profileLoading)) {
    return (
      <div className="app">
        <div className="auth-screen">
          <div className="auth-screen-inner">
            <div className="login-header">
              <span className="login-icon">TP</span>
              <h2 className="modal-title-h2">Treningsplan</h2>
            </div>
            <div className="empty-state">Laster...</div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Not authenticated: show login ───
  if (!user) {
    return (
      <div className="app">
        <Login fullScreen onClose={() => {}} />
      </div>
    )
  }

  // ─── User Management (superadmin) ───
  if (showUserManagement && isSuperadmin) {
    return (
      <UserManagement
        currentUser={userProfile}
        onClose={() => setShowUserManagement(false)}
      />
    )
  }

  // ─── Admin Dashboard ───
  if (showAdmin && canManageWorkouts) {
    return (
      <AdminDashboard
        user={user}
        userProfile={userProfile}
        onClose={() => setShowAdmin(false)}
        currentWeek={currentWeek}
        currentYear={currentYear}
        onWeekChange={handleWeekChange}
        overviewWeeks={overviewWeeks}
        selectedAthleteId={selectedAthleteId}
        athletes={athletes}
        onSelectAthlete={setSelectedAthleteId}
        workoutLayout={adminWorkoutLayout}
        onWorkoutLayoutChange={handleWorkoutLayoutChange}
        onOpenUserManagement={isSuperadmin ? () => {
          setShowAdmin(false)
          setShowUserManagement(true)
        } : null}
      />
    )
  }

  // ─── Athlete name for display ───
  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="brand-block">
            <span className="brand-eyebrow">Training Planner</span>
            <div className="brand-row">
              <h1 className="app-title">Treningsplan</h1>
            </div>
          </div>
          <div className="header-actions">
            {isSuperadmin && (
              <button
                className="admin-btn"
                onClick={() => setShowUserManagement(true)}
                title="Brukere"
              >
                <SystemIcon name="users" className="system-icon" />
              </button>
            )}
            {canManageWorkouts && (
              <button className="admin-btn active" onClick={() => setShowAdmin(true)} title="Admin">
                <SystemIcon name="settings" className="system-icon" />
              </button>
            )}
          </div>
        </div>

        <div className="week-nav-shell shell-card">
          <div className="week-nav">
            <button className="nav-btn" onClick={prevWeek}>‹</button>
            <div className="week-info" onClick={goToToday}>
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
          <div className="empty-state shell-card">Laster...</div>
        ) : workouts.length === 0 ? (
          <div className="empty-state shell-card">
            <div className="empty-icon">WK</div>
            <div>Ingen økter denne uken</div>
          </div>
        ) : (
          <section className="content-section shell-card">
            <div className="week-summary">
              {doneCount}/{workouts.length} fullført denne uken
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(doneCount / workouts.length) * 100}%` }}
                />
              </div>
            </div>
            {workoutLayout === 'calendar' ? (
              <div className="program-day-list">
                {workoutDays.map(day => (
                  <section key={day.value} className="program-day-section">
                    <div className="program-day-header">
                      <div>
                        <h2 className="program-day-title">{day.label}</h2>
                        <div className="program-day-meta">
                          {day.workouts.length > 0 ? `${day.workouts.length} økt${day.workouts.length > 1 ? 'er' : ''}` : 'Hvile / ingen økter'}
                        </div>
                      </div>
                    </div>

                    {day.workouts.length === 0 ? (
                      <div className="program-day-slots" style={{ '--slot-count': 2 }}>
                        <div className="program-day-empty-slot">Ledig slot</div>
                        <div className="program-day-empty-slot">Ledig slot</div>
                      </div>
                    ) : (
                      <div
                        className="program-day-slots"
                        style={{ '--slot-count': Math.max(2, day.workouts.length) }}
                      >
                        {Array.from({ length: Math.max(2, day.workouts.length) }, (_, idx) => {
                          const workout = day.workouts[idx]
                          if (!workout) {
                            return <div key={`empty-${day.value}-${idx}`} className="program-day-empty-slot">Ledig slot</div>
                          }

                          return (
                            <WorkoutCard
                              key={workout.id}
                              workout={workout}
                              index={idx}
                              indexLabel={formatWorkoutTime(workout)}
                              showSchedule={false}
                              slotLayout
                              onClick={setSelectedWorkout}
                              onToggleComplete={handleToggleComplete}
                            />
                          )
                        })}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="workout-list">
                {workouts.map((workout, index) => (
                  <WorkoutCard
                    key={workout.id}
                    workout={workout}
                    index={index}
                    onClick={setSelectedWorkout}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {selectedWorkout && (
        <WorkoutDetail
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          canEdit={canManageWorkouts}
          onReplace={canManageWorkouts ? handleStartReplaceWorkout : undefined}
          onDelete={canManageWorkouts ? async (w) => {
            await deleteDoc(doc(db, 'workouts', w.id))
            setSelectedWorkout(null)
          } : undefined}
          onToggleComplete={handleToggleComplete}
          onSaveComment={handleSaveComment}
          onEdit={canManageWorkouts ? async (updated) => {
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
          } : undefined}
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
        <button className="modal-close" onClick={onClose}><SystemIcon name="close" className="system-icon" /></button>
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
  const icon = TYPE_ICONS[template.type] || 'AN'

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
