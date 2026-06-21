import { describe, it, expect, vi, beforeEach } from 'vitest'

const setDoc = vi.fn(() => Promise.resolve())
const updateDoc = vi.fn(() => Promise.resolve())
const getDoc = vi.fn()
const doc = vi.fn((_db, col, id) => ({ __doc: `${col}/${id}` }))

vi.mock('firebase/firestore', () => ({
  doc: (...args) => doc(...args),
  setDoc: (...args) => setDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  getDoc: (...args) => getDoc(...args),
  collection: vi.fn(),
  serverTimestamp: () => '__ts',
}))
vi.mock('../firebase', () => ({ db: {} }))
vi.mock('../security/rateLimits', () => ({ withDatabaseWriteLimit: (_k, fn) => fn() }))

import { createDraftPlan, claimPlanInvite } from './planSharing'

beforeEach(() => {
  setDoc.mockClear()
  updateDoc.mockClear()
  getDoc.mockReset()
  doc.mockClear()
})

describe('createDraftPlan', () => {
  it('writes a draft athlete owned by the coach and links the relationship', async () => {
    const coach = { uid: 'coach1', roles: ['athlete'] }
    const id = await createDraftPlan(coach, '  Marathon block ')

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)

    const draftWrite = setDoc.mock.calls.find(([ref]) => ref.__doc === `users/${id}`)
    expect(draftWrite).toBeTruthy()
    expect(draftWrite[1]).toMatchObject({
      uid: id,
      isDraft: true,
      planName: 'Marathon block',
      displayName: 'Marathon block',
      ownerCoachId: 'coach1',
      status: 'active',
      roles: ['athlete'],
    })

    // The athlete-only creator is promoted to coach.
    const promote = updateDoc.mock.calls.find(([ref]) => ref.__doc === 'users/coach1')
    expect(promote).toBeTruthy()
    expect(promote[1].roles).toContain('coach')

    // The coach is linked to the draft.
    const rel = setDoc.mock.calls.find(([ref]) => ref.__doc === `relationships/coach1_${id}`)
    expect(rel).toBeTruthy()
    expect(rel[1]).toMatchObject({ coachId: 'coach1', athleteId: id })
  })

  it('does not re-promote a user who is already a coach', async () => {
    await createDraftPlan({ uid: 'coach2', roles: ['athlete', 'coach'] }, 'Plan')
    const promote = updateDoc.mock.calls.find(([ref]) => ref.__doc === 'users/coach2')
    expect(promote).toBeUndefined()
  })
})

describe('claimPlanInvite', () => {
  it('makes the invitee a coach of the shared draft and stamps the claim', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      id: 'tok',
      data: () => ({ token: 'tok', athleteId: 'draft9', inviterId: 'coach1', claimedBy: null }),
    })

    const athleteId = await claimPlanInvite('tok', { uid: 'invitee1', roles: ['athlete'] })
    expect(athleteId).toBe('draft9')

    const rel = setDoc.mock.calls.find(([ref]) => ref.__doc === 'relationships/invitee1_draft9')
    expect(rel).toBeTruthy()
    expect(rel[1]).toMatchObject({ coachId: 'invitee1', athleteId: 'draft9' })

    const stamp = updateDoc.mock.calls.find(([ref]) => ref.__doc === 'invites/tok')
    expect(stamp).toBeTruthy()
    expect(stamp[1]).toMatchObject({ claimedBy: 'invitee1' })
  })

  it('is a no-op link when the user is the draft itself', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      id: 'tok',
      data: () => ({ token: 'tok', athleteId: 'self', inviterId: 'c', claimedBy: null }),
    })
    const athleteId = await claimPlanInvite('tok', { uid: 'self', roles: ['athlete'] })
    expect(athleteId).toBe('self')
    expect(setDoc).not.toHaveBeenCalled()
  })
})
