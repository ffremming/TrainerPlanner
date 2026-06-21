import { useEffect, useRef, useState } from 'react'
import { getInvite, claimPlanInvite } from '../../userService'
import { isActiveUserProfile } from '../../roles'

// Reads ?invite=TOKEN once on load, exposes the pending invite (so Login can show
// a banner), and — as soon as the signed-in user is active — claims it: the user
// becomes a coach of the shared draft plan. Returns the claimed athlete id so the
// caller can auto-select that plan.
export function useInvite(userProfile) {
  const [token] = useState(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('invite') || null
  })
  const [pendingInvite, setPendingInvite] = useState(null)
  const [claimedAthleteId, setClaimedAthleteId] = useState(null)
  const claimingRef = useRef(false)

  // Look up the invite metadata once so we can greet the invitee by plan name.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    getInvite(token)
      .then(invite => { if (!cancelled) setPendingInvite(invite) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token])

  // Claim as soon as the profile is active. Runs once.
  useEffect(() => {
    if (!token || claimedAthleteId || claimingRef.current) return
    if (!isActiveUserProfile(userProfile)) return

    claimingRef.current = true
    claimPlanInvite(token, userProfile)
      .then(athleteId => {
        setClaimedAthleteId(athleteId)
        // Strip the token from the URL so a refresh doesn't re-trigger.
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname)
        }
      })
      .catch(err => {
        console.error('Could not claim plan invite', err)
        claimingRef.current = false
      })
  }, [token, userProfile, claimedAthleteId])

  return { invitePending: Boolean(token), pendingInvite, claimedAthleteId }
}
