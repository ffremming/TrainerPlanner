import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { createUserProfile } from '../userService'
import SystemIcon from './SystemIcon'

export default function Login({ onClose, fullScreen }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isRegistering) {
        if (!displayName.trim()) {
          setError('Skriv inn navnet ditt')
          setLoading(false)
          return
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await createUserProfile(cred.user.uid, email, displayName.trim(), 'athlete')
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      if (onClose) onClose()
    } catch (err) {
      if (isRegistering) {
        if (err.code === 'auth/email-already-in-use') {
          setError('Denne e-posten er allerede registrert')
        } else if (err.code === 'auth/weak-password') {
          setError('Passordet må være minst 6 tegn')
        } else {
          setError('Kunne ikke registrere. Prøv igjen.')
        }
      } else {
        setError('Feil e-post eller passord')
      }
      setLoading(false)
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget && onClose) onClose()
  }

  function toggleMode() {
    setIsRegistering(prev => !prev)
    setError('')
  }

  const form = (
    <form onSubmit={handleSubmit} className="add-form auth-form">
      {isRegistering && (
        <label>
          Navn
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Ditt fulle navn"
            autoComplete="name"
            required
            autoFocus={isRegistering}
          />
        </label>
      )}
      <label>
        E-post
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="din@epost.no"
          autoComplete="email"
          required
          autoFocus={!isRegistering}
        />
      </label>
      <label>
        Passord
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={isRegistering ? 'new-password' : 'current-password'}
          required
        />
      </label>
      {error && <div className="login-error">{error}</div>}
      <button type="submit" className="btn-save" disabled={loading}>
        {!loading && <SystemIcon name="login" className="button-icon" />}
        {loading
          ? (isRegistering ? 'Registrerer...' : 'Logger inn...')
          : (isRegistering ? 'Registrer deg' : 'Logg inn')
        }
      </button>
      <div className="auth-footer">
        <span className="auth-footer-text">
          {isRegistering ? 'Har allerede konto?' : 'Har ikke konto?'}
        </span>
        <button type="button" className="register-toggle" onClick={toggleMode}>
          {isRegistering ? 'Logg inn' : 'Registrer deg'}
        </button>
      </div>
    </form>
  )

  if (fullScreen) {
    return (
      <div className="auth-screen">
        <div className="auth-screen-inner">
          <div className="auth-hero">
            <div className="login-header auth-brand">
              <span className="login-icon">TP</span>
              <div>
                <span className="brand-eyebrow">Training Planner</span>
                <h2 className="modal-title-h2">Tren smartere, uke for uke</h2>
              </div>
            </div>
            <p className="auth-subtitle">
              {isRegistering ? 'Opprett en konto for å komme i gang' : 'Logg inn for å se treningsplanen din'}
            </p>
            <div className="auth-feature-list">
              <span className="auth-feature-pill">Ukeplan</span>
              <span className="auth-feature-pill">Analyse</span>
              <span className="auth-feature-pill">Coach flow</span>
            </div>
          </div>
          {form}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal login-modal">
        <button className="modal-close" onClick={onClose}><SystemIcon name="close" className="system-icon" /></button>
        <div className="login-header">
          <span className="login-icon"><SystemIcon name="login" className="hero-icon" /></span>
          <h2 className="modal-title-h2">
            {isRegistering ? 'Registrer deg' : 'Logg inn'}
          </h2>
        </div>
        {form}
      </div>
    </div>
  )
}
