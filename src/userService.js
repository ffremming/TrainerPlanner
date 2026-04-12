import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { getPrimaryRole } from './roles'

function normalizeUserDoc(snapshot) {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    uid: data.uid || snapshot.id,
    ...data,
  }
}

// ─── User Profiles ────────────────────────────────────────────────────────

export async function createUserProfile(uid, email, displayName, role = 'athlete') {
  const roles = Array.isArray(role) ? role : [role]
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    displayName,
    workoutLayout: 'list',
    role: getPrimaryRole({ roles }),
    roles,
    createdAt: serverTimestamp(),
  })
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? normalizeUserDoc(snap) : null
}

export function onUserProfileSnapshot(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    callback(snap.exists() ? normalizeUserDoc(snap) : null)
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
  return snap.docs.map(normalizeUserDoc)
}

export async function getAllAthletes() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs
    .map(normalizeUserDoc)
    .filter(user => Array.isArray(user.roles) ? user.roles.includes('athlete') : user.role === 'athlete')
}

export function onAllUsersSnapshot(callback) {
  return onSnapshot(collection(db, 'users'), snap => {
    callback(snap.docs.map(normalizeUserDoc))
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
  const athleteIds = new Set(relSnap.docs.map(d => d.data().athleteId))
  if (athleteIds.size === 0) return []

  const userSnap = await getDocs(collection(db, 'users'))
  return userSnap.docs
    .map(normalizeUserDoc)
    .filter(user => athleteIds.has(user.uid))
}

export function onCoachAthletesSnapshot(coachId, callback) {
  let athleteIds = new Set()
  let allUsers = []
  let hasRelationshipsSnapshot = false
  let hasUsersSnapshot = false

  const publish = () => {
    if (!hasRelationshipsSnapshot || !hasUsersSnapshot) return
    callback(allUsers.filter(user => athleteIds.has(user.uid)))
  }

  const unsubRelationships = onSnapshot(
    query(collection(db, 'relationships'), where('coachId', '==', coachId)),
    snap => {
      athleteIds = new Set(snap.docs.map(d => d.data().athleteId))
      hasRelationshipsSnapshot = true
      publish()
    }
  )

  const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
    allUsers = snap.docs.map(normalizeUserDoc)
    hasUsersSnapshot = true
    publish()
  })

  return () => {
    unsubRelationships()
    unsubUsers()
  }
}

export async function getAthleteCoaches(athleteId) {
  const relSnap = await getDocs(
    query(collection(db, 'relationships'), where('athleteId', '==', athleteId))
  )
  const coachIds = new Set(relSnap.docs.map(d => d.data().coachId))
  if (coachIds.size === 0) return []

  const userSnap = await getDocs(collection(db, 'users'))
  return userSnap.docs
    .map(normalizeUserDoc)
    .filter(user => coachIds.has(user.uid))
}

export function onRelationshipsSnapshot(callback) {
  return onSnapshot(collection(db, 'relationships'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}
