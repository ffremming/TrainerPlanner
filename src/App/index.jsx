import { useState, useEffect, useMemo } from 'react'
import {
  getAdjacentWeek,
  getWeekKey,
  getWeekNumber,
  getWeekDates,
  getWeekWindow,
  groupWorkoutsByWeekday,
} from '../utils'
import { hasRole, isActiveUserProfile } from '../roles'
import ShortcutsHelp from '../components/ShortcutsHelp'
import '../components/AthleteHome.css'
import { useAuth } from './hooks/useAuth'
import { useInvite } from './hooks/useInvite'
import { useAthletes } from './hooks/useAthletes'
import { useWorkouts } from './hooks/useWorkouts'
import { useTemplates } from './hooks/useTemplates'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { createHandlers } from './handlers'
import AppRoutes from './AppRoutes'
import { NavProvider } from './primaryNav'

export default function App() {
  const today = useMemo(() => new Date(), [])
  const [currentWeek, setCurrentWeek] = useState(() => getWeekNumber(today))
  const [currentYear, setCurrentYear] = useState(() => today.getFullYear())

  const [showLogin, setShowLogin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showMyAccount, setShowMyAccount] = useState(false)
  const [showAthleteOverview, setShowAthleteOverview] = useState(false)
  const [showOverview, setShowOverview] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [replacementTarget, setReplacementTarget] = useState(null)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  const { user, userProfile, profileLoading, profileError } = useAuth()

  // Clear the ?strava=connected param Strava's OAuth callback redirects back with,
  // so it doesn't linger in the URL after the connection completes.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('strava') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const overviewWeeks = useMemo(
    () => getWeekWindow(currentWeek, currentYear, 4, 4),
    [currentWeek, currentYear]
  )
  const overviewWeekKeys = useMemo(
    () => new Set(overviewWeeks.map(week => week.key)),
    [overviewWeeks]
  )
  const selectedWeekKey = getWeekKey(currentWeek, currentYear)

  const accountActive = isActiveUserProfile(userProfile)
  const activeUserProfile = accountActive ? userProfile : null
  const isSuperadmin = accountActive && hasRole(userProfile, 'superadmin')
  const isCoach = accountActive && hasRole(userProfile, 'coach')
  const isAthlete = accountActive && hasRole(userProfile, 'athlete')
  const canManageWorkouts = isSuperadmin || isCoach
  const workoutLayout = userProfile?.workoutLayout === 'calendar' ? 'calendar' : 'list'

  const { athletes, selectedAthleteId, setSelectedAthleteId } = useAthletes(
    activeUserProfile,
    { isAthlete, isCoach, isSuperadmin }
  )

  // Selecting a just-created or just-claimed plan is sticky: useAthletes can
  // briefly drop a selection while the new athlete doc loads, so we record the
  // intent and re-assert it the moment the plan appears in the roster.
  const [desiredAthleteId, setDesiredAthleteId] = useState(null)
  const requestSelectAthlete = (id) => {
    setDesiredAthleteId(id)
    setSelectedAthleteId(id)
  }
  useEffect(() => {
    if (!desiredAthleteId) return
    if (athletes.some(a => a.uid === desiredAthleteId)) {
      setSelectedAthleteId(desiredAthleteId)
      if (selectedAthleteId === desiredAthleteId) setDesiredAthleteId(null)
    }
  }, [desiredAthleteId, athletes, selectedAthleteId, setSelectedAthleteId])

  // Share-by-link: claim a ?invite=TOKEN plan and jump to it once it loads.
  const { invitePending, pendingInvite, claimedAthleteId } = useInvite(activeUserProfile)
  useEffect(() => {
    if (claimedAthleteId) setDesiredAthleteId(claimedAthleteId)
  }, [claimedAthleteId])

  const selectedAthleteProfile = athletes.find(athlete => athlete.uid === selectedAthleteId) || null
  const adminWorkoutLayout = selectedAthleteProfile?.workoutLayout === 'calendar' ? 'calendar' : 'list'
  const viewedAthleteId = !accountActive
    ? null
    : canManageWorkouts
      ? (selectedAthleteId || userProfile?.uid || user?.uid)
      : (activeUserProfile?.uid || user?.uid)
  const activeHomeAthlete = !accountActive
    ? null
    : canManageWorkouts
      ? (selectedAthleteProfile || (selectedAthleteId === userProfile?.uid ? userProfile : null))
      : activeUserProfile
  const homeWorkoutLayout = canManageWorkouts ? adminWorkoutLayout : workoutLayout

  const { workouts, overviewWorkouts, loading, overviewLoading } = useWorkouts({
    viewedAthleteId, currentWeek, currentYear, overviewWeeks, overviewWeekKeys,
    canManageWorkouts, userProfile, user,
  })

  // Keep the open workout detail modal in sync with live workout data.
  useEffect(() => {
    if (!selectedWorkout) return
    const freshWorkout = workouts.find(w => w.id === selectedWorkout.id)
    setSelectedWorkout(freshWorkout || null)
  }, [workouts, selectedWorkout])

  const { templates, loadingTemplates } = useTemplates(activeUserProfile)

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

  const isModalOpen = Boolean(
    selectedWorkout ||
    replacementTarget ||
    showLogin ||
    showAdmin ||
    showUserManagement ||
    showMyAccount ||
    showAthleteOverview
  )

  useKeyboardShortcuts({
    isModalOpen,
    showShortcutsHelp,
    setShowShortcutsHelp,
    prevWeek,
    nextWeek,
    goToToday,
  })

  const handlers = createHandlers({
    selectedWorkout, setSelectedWorkout,
    replacementTarget, setReplacementTarget,
    setShowAdmin, setShowUserManagement, setShowAthleteOverview,
    selectedAthleteId, userProfile, adminWorkoutLayout,
  })

  const { monday, sunday } = getWeekDates(currentWeek, currentYear)
  const doneCount = workouts.filter(w => w.completed).length
  const isThisWeek = currentWeek === getWeekNumber(today) && currentYear === today.getFullYear()
  const workoutDays = groupWorkoutsByWeekday(workouts)
  const overviewByWeekKey = useMemo(() => (
    overviewWorkouts.reduce((acc, workout) => {
      const key = getWeekKey(workout.week, workout.year)
      if (!acc[key]) acc[key] = []
      acc[key].push(workout)
      return acc
    }, {})
  ), [overviewWorkouts])

  const adminScreenProps = {
    user, userProfile, athletes, setShowAdmin, setShowUserManagement,
    currentWeek, currentYear, handleWeekChange, overviewWeeks,
    selectedAthleteId, setSelectedAthleteId, adminWorkoutLayout, isSuperadmin,
    handleWorkoutLayoutChange: handlers.handleWorkoutLayoutChange,
  }

  const mainShellProps = {
    isSuperadmin, canManageWorkouts, activeHomeAthlete,
    currentWeek, currentYear, monday, sunday, isThisWeek,
    prevWeek, nextWeek, goToToday, handleWeekChange,
    showOverview, setShowOverview, overviewLoading, overviewWeeks, overviewByWeekKey, selectedWeekKey,
    athletes, selectedAthleteId, setSelectedAthleteId, userProfile,
    homeWorkoutLayout,
    handleWorkoutLayoutChange: handlers.handleWorkoutLayoutChange,
    loading, workouts, doneCount, workoutDays,
    selectedWorkout, setSelectedWorkout,
    handleToggleComplete: handlers.handleToggleComplete,
    handleSaveComment: handlers.handleSaveComment,
    handleStartReplaceWorkout: handlers.handleStartReplaceWorkout,
    handleDuplicateWorkout: handlers.handleDuplicateWorkout,
    replacementTarget, templates, loadingTemplates,
    closeTemplatePicker: handlers.closeTemplatePicker,
    handleReplaceWithTemplate: handlers.handleReplaceWithTemplate,
    showLogin, setShowLogin,
    setShowUserManagement, setShowAthleteOverview, setShowAdmin,
    handleLogout: handlers.handleLogout,
  }

  return (
    <NavProvider
      canManageWorkouts={canManageWorkouts}
      isSuperadmin={isSuperadmin}
      setShowAthleteOverview={setShowAthleteOverview}
      setShowAdmin={setShowAdmin}
      setShowUserManagement={setShowUserManagement}
      setShowMyAccount={setShowMyAccount}
      isAthlete={isAthlete}
      handleLogout={handlers.handleLogout}
      userProfile={userProfile}
      athletes={athletes}
      selectedAthleteId={selectedAthleteId}
      setSelectedAthleteId={setSelectedAthleteId}
      selectPlan={requestSelectAthlete}
    >
      <AppRoutes
        user={user}
        userProfile={userProfile}
        profileLoading={profileLoading}
        profileError={profileError}
        isSuperadmin={isSuperadmin}
        canManageWorkouts={canManageWorkouts}
        isAthlete={isAthlete}
        showUserManagement={showUserManagement}
        showAthleteOverview={showAthleteOverview}
        showAdmin={showAdmin}
        showMyAccount={showMyAccount}
        setShowUserManagement={setShowUserManagement}
        setShowAthleteOverview={setShowAthleteOverview}
        setShowAdmin={setShowAdmin}
        setShowMyAccount={setShowMyAccount}
        invitePending={invitePending}
        pendingInvite={pendingInvite}
        handlers={handlers}
        adminScreenProps={adminScreenProps}
        mainShellProps={mainShellProps}
      />
      {showShortcutsHelp && <ShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />}
    </NavProvider>
  )
}
