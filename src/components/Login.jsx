import { useState } from 'react'
import { motion as m } from 'framer-motion'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { createUserProfile, createInvitedUserProfile } from '../userService'
import {
  assertAuthAttemptAllowed,
  clearAuthAttempts,
  isRateLimitError,
} from '../security/rateLimits'
import {
  Button,
  Field,
  GradientText,
  Input,
  InvertedSection,
  Modal,
  SectionLabel,
  motion as motionVariants,
} from './ui'
import './Login.css'

const { fadeInUp, stagger, viewport, floatY, floatYAlt } = motionVariants

export default function Login({ onClose, fullScreen, invitePending = false, pendingInvite = null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // An invite link lands the visitor on registration so they can claim the plan.
  const [isRegistering, setIsRegistering] = useState(invitePending)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (isRegistering && !displayName.trim()) {
      setError('Enter your name')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    const authAction = isRegistering ? 'register' : 'login'

    try {
      assertAuthAttemptAllowed(authAction, normalizedEmail)
    } catch (err) {
      setError(isRateLimitError(err) ? err.message : 'Please wait before trying again.')
      return
    }

    setLoading(true)
    try {
      if (isRegistering) {
        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        if (pendingInvite?.token) {
          // Invited users are activated immediately — the invite is their access.
          await createInvitedUserProfile(cred.user.uid, normalizedEmail, displayName.trim(), pendingInvite.token)
        } else {
          await createUserProfile(cred.user.uid, normalizedEmail, displayName.trim(), 'athlete')
        }
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password)
      }
      clearAuthAttempts(authAction, normalizedEmail)
      onClose?.()
    } catch (err) {
      if (isRegistering) {
        if (err.code === 'auth/email-already-in-use') setError('This email is already registered')
        else if (err.code === 'auth/weak-password')   setError('Password must be at least 6 characters')
        else                                          setError('Could not register. Please try again.')
      } else {
        setError('Wrong email or password')
      }
      setLoading(false)
    }
  }

  function toggleMode() { setIsRegistering(p => !p); setError('') }

  const form = (
    <form onSubmit={handleSubmit} className="th-login-form">
      {invitePending && (
        <div className="th-login-invite" role="status">
          <strong>You've been invited to a plan{pendingInvite?.planName ? `: “${pendingInvite.planName}”` : ''}.</strong>
          <span>Create an account to open it. It's added to your plans automatically.</span>
        </div>
      )}
      {isRegistering && (
        <Field label="Name">
          <Input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            required
            autoFocus
          />
        </Field>
      )}
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          autoComplete="email"
          required
          autoFocus={!isRegistering}
        />
      </Field>
      <Field label="Password" hint={isRegistering ? 'At least 6 characters' : null}>
        <Input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={isRegistering ? 'new-password' : 'current-password'}
          required
        />
      </Field>

      {error && <div className="th-login-error" role="alert">{error}</div>}

      <Button type="submit" variant="primary" size="lg" block disabled={loading}>
        {loading
          ? (isRegistering ? 'Registering…' : 'Signing in…')
          : (isRegistering ? 'Create account' : 'Sign in')}
      </Button>

      <p className="th-login-toggle">
        <span>{isRegistering ? 'Already have an account?' : 'New here?'}</span>
        <button type="button" className="th-login-toggle-btn" onClick={toggleMode}>
          {isRegistering ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </form>
  )

  if (fullScreen) {
    return (
      <div className="th-login-shell">
        {/* Ambient radial glows positioned at corners — atmosphere, not decoration */}
        <div className="th-login-glow th-login-glow--tl" aria-hidden="true" />
        <div className="th-login-glow th-login-glow--br" aria-hidden="true" />

        <main className="th-login-stage">
          <m.section
            className="th-login-hero"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <m.div variants={fadeInUp} className="th-login-brand">
              <span className="th-login-mark" aria-hidden="true">TH</span>
              <span className="th-login-brand-text">Threshold</span>
            </m.div>

            <m.div variants={fadeInUp}>
              <SectionLabel>Build form toward the goal</SectionLabel>
            </m.div>

            <m.h1 variants={fadeInUp} className="th-login-headline">
              Build the week.<br />
              Win the <GradientText>race</GradientText>
              <span className="th-login-headline-bar" aria-hidden="true" />
            </m.h1>

            <m.p variants={fadeInUp} className="th-login-tagline">
              A professional tool for coaches and athletes — plan sessions,
              track load, and build form toward the goal.
            </m.p>

            <m.div variants={fadeInUp} className="th-login-marks" aria-hidden="true">
              <HeroGraphic />
            </m.div>
          </m.section>

          <m.section
            className="th-login-card"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            <header className="th-login-card-head">
              <span className="th-login-eyebrow">
                {isRegistering ? 'New user' : 'Welcome back'}
              </span>
              <h2 className="th-login-card-title">
                {isRegistering ? 'Create account' : 'Sign in'}
              </h2>
            </header>
            {form}
          </m.section>
        </main>

        <InvertedSection as="footer" className="th-login-foot">
          <div className="th-login-foot-inner">
            <span className="th-login-foot-brand">
              <span className="th-login-mark th-login-mark--invert" aria-hidden="true">TH</span>
              Threshold
            </span>
            <span className="th-num th-login-foot-version">v1 · 2026</span>
          </div>
        </InvertedSection>
      </div>
    )
  }

  return (
    <Modal open onClose={onClose} title={isRegistering ? 'Sign up' : 'Sign in'}>
      {form}
    </Modal>
  )
}

/* ── Hero graphic ─────────────────────────────────────────────────
 * Abstract generative composition per design system spec:
 *   • Rotating outer ring (60s, dashed)
 *   • Two floating cards on staggered y-bobbing animations
 *   • 3×3 dot grid
 *   • Solid corner accent block with accent-tinted shadow
 * Hidden on small screens — geometric density only reads at scale. */
function HeroGraphic() {
  return (
    <div className="th-hero-graphic">
      <m.div
        className="th-hero-ring"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        aria-hidden="true"
      />
      <m.div
        className="th-hero-ring th-hero-ring--inner"
        animate={{ rotate: -360 }}
        transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        aria-hidden="true"
      />

      <div className="th-hero-dots" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
      </div>

      <m.div className="th-hero-card th-hero-card--a" animate={floatY}>
        <span className="th-hero-card-eyebrow">Monday · Z3</span>
        <span className="th-hero-card-num">8 km</span>
        <span className="th-hero-card-bar"><span style={{ width: '64%' }} /></span>
      </m.div>

      <m.div className="th-hero-card th-hero-card--b" animate={floatYAlt}>
        <span className="th-hero-card-eyebrow">Week 18</span>
        <span className="th-hero-card-num">42 km</span>
        <span className="th-hero-card-meta">+12 % vs previous</span>
      </m.div>

      <span className="th-hero-block" aria-hidden="true" />
    </div>
  )
}
