import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Plus, Share2 } from 'lucide-react'
import SystemIcon from '../components/SystemIcon'
import { Button } from '../components/ui'
import { createDraftPlan, createPlanInvite } from '../userService'

/* ────────────────────────────────────────────────────────────────────
 * Primary nav — single source of truth for the sidebar.
 *
 * Provides via context:
 *   • items / onChange / account  → primary nav + account block
 *   • selectedAthlete             → contextual "selected athlete" block,
 *                                    rendered in the sidebar between
 *                                    the nav list and the account block.
 *                                    Clickable; opens a popover with the
 *                                    full athlete roster.
 * ──────────────────────────────────────────────────────────────────── */
const NavContext = createContext(null)

function initialOf(p) {
  return ((p?.displayName || p?.email || '?').trim()[0] || '?').toUpperCase()
}

function planLabel(a, userProfile) {
  if (a.uid === userProfile?.uid) return `${a.displayName || a.email} (me)`
  return a.planName || a.displayName || a.email || 'No name'
}

function SidebarAthlete({
  athletes,
  selectedAthleteId,
  setSelectedAthleteId,
  selectPlan,
  userProfile,
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Always offer the user's own context first, then every plan/athlete they
  // coach. A plain athlete sees just themselves until they create a plan.
  const visibleAthletes = useMemo(() => {
    const list = athletes.filter(a => a.uid !== userProfile?.uid)
    return userProfile ? [userProfile, ...list] : list
  }, [athletes, userProfile])

  const selected = visibleAthletes.find(a => a.uid === selectedAthleteId) || null
  const displayName = selected ? planLabel(selected, userProfile) : 'Select plan'

  async function handleNewPlan() {
    const name = window.prompt('Name this plan (e.g. "Marathon block", "Anna 5k")')
    if (name === null) return
    setBusy(true)
    try {
      const draftId = await createDraftPlan(userProfile, name)
      selectPlan(draftId)
      setOpen(false)
    } catch (err) {
      console.error('Could not create plan', err)
      const detail = err?.code === 'permission-denied'
        ? ' (permission denied — the latest Firestore rules may not be deployed yet)'
        : err?.message ? ` (${err.message})` : ''
      window.alert(`Could not create the plan. Please try again.${detail}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleShare(athlete, e) {
    e.stopPropagation()
    setBusy(true)
    try {
      const link = await createPlanInvite(userProfile, athlete)
      try {
        await navigator.clipboard?.writeText(link)
        window.alert(`Share link copied to clipboard:\n\n${link}\n\nSend it to whoever should get this plan. They register and the plan is added to their account.`)
      } catch {
        window.prompt('Copy this share link:', link)
      }
    } catch (err) {
      console.error('Could not create share link', err)
      window.alert('Could not create a share link. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="th-sb-athlete" ref={ref}>
      <button
        type="button"
        className={`th-sb-athlete-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="th-sb-athlete-avatar" aria-hidden="true">
          {initialOf(selected)}
        </span>
        <span className="th-sb-athlete-meta">
          <span className="th-sb-athlete-eyebrow">Selected plan</span>
          <span className="th-sb-athlete-name">{displayName}</span>
        </span>
        <ChevronRight
          className={`th-sb-athlete-chevron${open ? ' is-open' : ''}`}
          size={16}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="th-sb-athlete-popover" role="listbox" aria-label="Switch plan">
          <div className="th-sb-athlete-popover-head">
            <span className="th-sb-athlete-eyebrow">Plans &amp; athletes</span>
          </div>
          <ul className="th-sb-athlete-popover-list">
            {visibleAthletes.length === 0 && (
              <li className="th-sb-athlete-popover-empty">No plans yet</li>
            )}
            {visibleAthletes.map(a => {
              const isActive = a.uid === selectedAthleteId
              return (
                <li key={a.uid}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`th-sb-athlete-option${isActive ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedAthleteId(a.uid)
                      setOpen(false)
                    }}
                  >
                    <span className="th-sb-athlete-option-avatar" aria-hidden="true">
                      {initialOf(a)}
                    </span>
                    <span className="th-sb-athlete-option-name">
                      {planLabel(a, userProfile)}
                    </span>
                    {a.isDraft && (
                      <span
                        className="th-sb-athlete-option-share"
                        role="button"
                        tabIndex={0}
                        aria-label={`Share ${planLabel(a, userProfile)}`}
                        onClick={e => handleShare(a, e)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleShare(a, e) }}
                        title="Share plan via link"
                      >
                        <Share2 size={14} aria-hidden="true" />
                      </span>
                    )}
                    {isActive && <span className="th-sb-athlete-option-dot" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className="th-sb-athlete-new"
            onClick={handleNewPlan}
            disabled={busy}
          >
            <Plus size={16} aria-hidden="true" />
            <span>New plan</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function NavProvider({
  canManageWorkouts,
  isSuperadmin,
  setShowAthleteOverview,
  setShowAdmin,
  setShowUserManagement,
  setShowMyAccount,
  isAthlete,
  handleLogout,
  userProfile,
  athletes,
  selectedAthleteId,
  setSelectedAthleteId,
  selectPlan,
  children,
}) {
  const value = useMemo(() => {
    const goPlan = () => {
      setShowAthleteOverview(false)
      setShowAdmin(false)
      setShowUserManagement(false)
    }

    const items = [
      {
        key: 'plan',
        label: 'Plan',
        icon: <SystemIcon name="calendar" />,
        onSelect: goPlan,
      },
      canManageWorkouts && {
        key: 'athletes',
        label: 'Athletes',
        icon: <SystemIcon name="users" />,
        onSelect: () => { goPlan(); setShowAthleteOverview(true) },
      },
      canManageWorkouts && {
        key: 'admin',
        label: 'Coach panel',
        icon: <SystemIcon name="dashboard" />,
        onSelect: () => { goPlan(); setShowAdmin(true) },
      },
      isSuperadmin && {
        key: 'users',
        label: 'Users',
        icon: <SystemIcon name="settings" />,
        onSelect: () => { goPlan(); setShowUserManagement(true) },
      },
    ].filter(Boolean)

    const onChange = (key) => {
      items.find(item => item.key === key)?.onSelect?.()
    }

    const initials = (userProfile?.displayName || userProfile?.email || '?').slice(0, 1).toUpperCase()
    const account = (
      <div className="th-account">
        {isAthlete ? (
          <button
            type="button"
            className="th-account-meta th-account-meta-button"
            onClick={() => setShowMyAccount(true)}
            aria-label="Open my coaches"
          >
            <span className="th-account-avatar" aria-hidden="true">{initials}</span>
            <div className="th-account-info">
              <span className="th-account-name">
                {userProfile?.displayName || userProfile?.email || 'User'}
              </span>
              {userProfile?.email && userProfile?.displayName && (
                <span className="th-account-email">{userProfile.email}</span>
              )}
            </div>
          </button>
        ) : (
          <div className="th-account-meta">
            <span className="th-account-avatar" aria-hidden="true">{initials}</span>
            <div className="th-account-info">
              <span className="th-account-name">
                {userProfile?.displayName || userProfile?.email || 'User'}
              </span>
              {userProfile?.email && userProfile?.displayName && (
                <span className="th-account-email">{userProfile.email}</span>
              )}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          block
          onClick={handleLogout}
          className="th-account-logout"
        >
          <SystemIcon name="logout" className="button-icon" />
          Sign out
        </Button>
      </div>
    )

    // Rendered for every active user — a plain athlete uses it to create their
    // first plan (which promotes them to coach), coaches use it to switch plans.
    const selectedAthlete = userProfile ? (
      <SidebarAthlete
        athletes={athletes}
        selectedAthleteId={selectedAthleteId}
        setSelectedAthleteId={setSelectedAthleteId}
        selectPlan={selectPlan || setSelectedAthleteId}
        userProfile={userProfile}
      />
    ) : null

    return { items, onChange, account, selectedAthlete }
  }, [
    canManageWorkouts,
    isSuperadmin,
    setShowAthleteOverview,
    setShowAdmin,
    setShowUserManagement,
    setShowMyAccount,
    isAthlete,
    handleLogout,
    userProfile,
    athletes,
    selectedAthleteId,
    setSelectedAthleteId,
    selectPlan,
  ])

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

/* Returns { items, onChange, account, selectedAthlete } — or `null` if no
 * provider is mounted (e.g. on the Login screen). Callers should guard. */
export function useNav() {
  return useContext(NavContext)
}
