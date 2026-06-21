import Login from '../components/Login'
import LoadingScreen from './LoadingScreen'
import ProfileErrorScreen from './ProfileErrorScreen'
import MainShell from './MainShell'
import {
  UserManagementScreen,
  AthleteOverviewScreen,
  AdminDashboardScreen,
  MyAccountScreen,
} from './AdminScreens'
import { getUserStatus, isActiveUserProfile } from '../roles'

// Resolves which top-level screen to render based on auth state and the
// active admin/overview toggles. Keeping this in one place makes the routing
// flow explicit and keeps the App component focused on state wiring.
export default function AppRoutes({
  user,
  userProfile,
  profileLoading,
  profileError,
  isSuperadmin,
  canManageWorkouts,
  isAthlete,
  showUserManagement,
  showAthleteOverview,
  showAdmin,
  showMyAccount,
  setShowUserManagement,
  setShowAthleteOverview,
  setShowAdmin,
  setShowMyAccount,
  invitePending,
  pendingInvite,
  handlers,
  adminScreenProps,
  mainShellProps,
}) {
  if (user === undefined || (user && profileLoading)) return <LoadingScreen />
  if (!user) {
    return (
      <Login
        fullScreen
        onClose={() => {}}
        invitePending={invitePending}
        pendingInvite={pendingInvite}
      />
    )
  }
  if (profileError) {
    return <ProfileErrorScreen message={profileError} onLogout={handlers.handleLogout} />
  }
  if (userProfile && !isActiveUserProfile(userProfile)) {
    const status = getUserStatus(userProfile)
    const message = status === 'disabled'
      ? 'This account has been disabled. Contact an administrator if you need access.'
      : 'Your account is waiting for access approval. A superadmin must activate it before training data is available.'
    return <ProfileErrorScreen message={message} onLogout={handlers.handleLogout} />
  }

  if (showUserManagement && isSuperadmin) {
    return (
      <UserManagementScreen
        userProfile={userProfile}
        setShowUserManagement={setShowUserManagement}
      />
    )
  }

  if (showAthleteOverview && canManageWorkouts) {
    return (
      <AthleteOverviewScreen
        user={user}
        userProfile={userProfile}
        athletes={adminScreenProps.athletes}
        setShowAthleteOverview={setShowAthleteOverview}
      />
    )
  }

  if (showMyAccount && isAthlete) {
    return (
      <MyAccountScreen
        userProfile={userProfile}
        setShowMyAccount={setShowMyAccount}
      />
    )
  }

  if (showAdmin && canManageWorkouts) {
    return <AdminDashboardScreen {...adminScreenProps} />
  }

  return <MainShell {...mainShellProps} />
}
