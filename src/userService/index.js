// Public surface of the user service. Split into focused modules:
//   users.js          – user profile CRUD + subscriptions
//   athleteProfile.js – coaching profile (HR, zones, results)
//   relationships.js  – coach <-> athlete links
export {
  createUserProfile,
  getUserProfile,
  onUserProfileSnapshot,
  updateUserRole,
  updateUserStatus,
  updateUserProfile,
  onAllUsersSnapshot,
} from './users'

export {
  updateAthleteMaxHr,
  updateAthleteZones,
  addAthleteResult,
  removeAthleteResult,
} from './athleteProfile'

export {
  addRelationship,
  removeRelationship,
  onRelationshipsSnapshot,
  onCoachAthletesSnapshot,
  onCoachesSnapshot,
} from './relationships'

export {
  createDraftPlan,
  createInvitedUserProfile,
  createPlanInvite,
  inviteLink,
  getInvite,
  claimPlanInvite,
} from './planSharing'
