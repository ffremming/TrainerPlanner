// Draft "plans for someone else" and share-by-link invites.
//
// A draft athlete is a regular users/{id} doc with `isDraft: true` and a
// `planName` instead of a real person behind it. The creator becomes its coach
// (relationships/{coachId}_{draftId}) and is granted the 'coach' role, so you
// can build a named plan even when you don't coach a real athlete yet.
//
// Sharing creates an invites/{token} doc pointing at the draft. The invitee
// opens ?invite=TOKEN, registers, and on first active login claims it: they
// too become a coach of that same draft athlete, so both parties share the plan.
import {
  doc, setDoc, getDoc, updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { getUserRoles } from '../roles'
import { withDatabaseWriteLimit } from '../security/rateLimits'
import { relationshipId } from './firestore'

function randomId(length = 20) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  const random = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(length))
    : null
  for (let i = 0; i < length; i += 1) {
    const n = random ? random[i] : Math.floor(Math.random() * alphabet.length)
    out += alphabet[n % alphabet.length]
  }
  return out
}

// Register a profile for someone arriving through a share link. Being invited
// is the authorization, so the account is created active (no superadmin gate)
// and stamped with the token so rules can verify the invite exists.
export async function createInvitedUserProfile(uid, email, displayName, inviteToken) {
  await withDatabaseWriteLimit('users', () => setDoc(doc(db, 'users', uid), {
    uid,
    email,
    displayName,
    workoutLayout: 'list',
    role: 'athlete',
    roles: ['athlete'],
    status: 'active',
    invitedVia: inviteToken,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))
}

// Make sure the given user carries the 'coach' role, so the relationship and
// athleteSessions rules accept them as a coach.
async function ensureCoachRole(userProfile) {
  if (!userProfile?.uid) return
  if (getUserRoles(userProfile).includes('coach')) return
  const nextRoles = [...new Set([...getUserRoles(userProfile), 'coach'])]
  await withDatabaseWriteLimit('users', () => updateDoc(doc(db, 'users', userProfile.uid), {
    roles: nextRoles,
    // Keep `role` as the athlete primary; coach is additive here.
    updatedAt: serverTimestamp(),
  }))
}

// Create a named draft athlete owned (coached) by `coach`. Returns the new id.
export async function createDraftPlan(coach, planName) {
  if (!coach?.uid) throw new Error('Missing coach')
  const name = (planName || '').trim() || 'Untitled plan'
  const draftId = randomId()

  await withDatabaseWriteLimit('users', () => setDoc(doc(db, 'users', draftId), {
    uid: draftId,
    isDraft: true,
    planName: name,
    displayName: name,
    ownerCoachId: coach.uid,
    workoutLayout: 'list',
    role: 'athlete',
    roles: ['athlete'],
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))

  await ensureCoachRole(coach)

  await withDatabaseWriteLimit('relationships', () => setDoc(
    doc(db, 'relationships', relationshipId(coach.uid, draftId)),
    { coachId: coach.uid, athleteId: draftId, createdAt: serverTimestamp() },
  ))

  return draftId
}

// Create (or reuse) a share invite for a draft plan. Returns the share link.
export async function createPlanInvite(inviter, draftAthlete) {
  if (!inviter?.uid) throw new Error('Missing inviter')
  if (!draftAthlete?.uid) throw new Error('Missing plan')
  const token = randomId(24)

  await withDatabaseWriteLimit('invites', () => setDoc(doc(db, 'invites', token), {
    token,
    athleteId: draftAthlete.uid,
    inviterId: inviter.uid,
    planName: draftAthlete.planName || draftAthlete.displayName || 'Plan',
    createdAt: serverTimestamp(),
    claimedBy: null,
    claimedAt: null,
  }))

  return inviteLink(token)
}

export function inviteLink(token) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/?invite=${token}`
}

export async function getInvite(token) {
  if (!token) return null
  const snap = await getDoc(doc(db, 'invites', token))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Claim an invite for the newly-registered (or signed-in) user: make them a
// coach of the shared draft athlete so they see and own the plan too.
export async function claimPlanInvite(token, userProfile) {
  if (!userProfile?.uid) throw new Error('Missing user')
  const invite = await getInvite(token)
  if (!invite) throw new Error('Invite not found')
  if (invite.athleteId === userProfile.uid) return invite.athleteId

  await ensureCoachRole(userProfile)

  await withDatabaseWriteLimit('relationships', () => setDoc(
    doc(db, 'relationships', relationshipId(userProfile.uid, invite.athleteId)),
    { coachId: userProfile.uid, athleteId: invite.athleteId, createdAt: serverTimestamp() },
  ))

  if (!invite.claimedBy) {
    await withDatabaseWriteLimit('invites', () => updateDoc(doc(db, 'invites', token), {
      claimedBy: userProfile.uid,
      claimedAt: serverTimestamp(),
    }))
  }

  return invite.athleteId
}
