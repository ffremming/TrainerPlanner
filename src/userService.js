import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { getPrimaryRole } from './roles'

// ─── User Profiles ────────────────────────────────────────────────────────

export async function createUserProfile(uid, email, displayName, role = 'athlete') {
  const roles = Array.isArray(role) ? role : [role]
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    displayName,
    workoutLayout: 'calendar',
    role: getPrimaryRole({ roles }),
    roles,
    createdAt: serverTimestamp(),
  })
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function onUserProfileSnapshot(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export async function updateUserRole(uid, roles) {
  const nextRoles = Array.isArray(roles) ? roles : [roles]
  await updateDoc(doc(db, 'users', uid), {
    role: getPrimaryRole({ roles: nextRoles }),
    roles: nextRoles,
  })
}

export async function updateUserProfile(uid, fields) {
  await updateDoc(doc(db, 'users', uid), fields)
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getAllAthletes() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(user => Array.isArray(user.roles) ? user.roles.includes('athlete') : user.role === 'athlete')
}

export function onAllUsersSnapshot(callback) {
  return onSnapshot(collection(db, 'users'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ─── Coach-Athlete Relationships ──────────────────────────────────────────

function getRelationshipId(coachId, athleteId) {
  return `${coachId}_${athleteId}`
}

export async function addRelationship(coachId, athleteId) {
  const id = getRelationshipId(coachId, athleteId)
  await setDoc(doc(db, 'relationships', id), {
    coachId,
    athleteId,
    createdAt: serverTimestamp(),
  })
}

export async function removeRelationship(coachId, athleteId) {
  const id = getRelationshipId(coachId, athleteId)
  await deleteDoc(doc(db, 'relationships', id))
}

export async function getCoachAthletes(coachId) {
  const relSnap = await getDocs(
    query(collection(db, 'relationships'), where('coachId', '==', coachId))
  )
  const athleteIds = relSnap.docs.map(d => d.data().athleteId)
  if (athleteIds.length === 0) return []

  const athletes = await Promise.all(
    athleteIds.map(id => getUserProfile(id))
  )
  return athletes.filter(Boolean)
}

export function onCoachAthletesSnapshot(coachId, callback) {
  return onSnapshot(
    query(collection(db, 'relationships'), where('coachId', '==', coachId)),
    async snap => {
      const athleteIds = snap.docs.map(d => d.data().athleteId)
      if (athleteIds.length === 0) {
        callback([])
        return
      }
      const athletes = await Promise.all(
        athleteIds.map(id => getUserProfile(id))
      )
      callback(athletes.filter(Boolean))
    }
  )
}

export async function getAthleteCoaches(athleteId) {
  const relSnap = await getDocs(
    query(collection(db, 'relationships'), where('athleteId', '==', athleteId))
  )
  const coachIds = relSnap.docs.map(d => d.data().coachId)
  if (coachIds.length === 0) return []

  const coaches = await Promise.all(
    coachIds.map(id => getUserProfile(id))
  )
  return coaches.filter(Boolean)
}

export function onRelationshipsSnapshot(callback) {
  return onSnapshot(collection(db, 'relationships'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}
