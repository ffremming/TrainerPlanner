import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

export default function Login({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
      onClose()
    } catch {
      setError('Feil e-post eller passord')
      setLoading(false)
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal login-modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="login-header">
          <span className="login-icon">🔐</span>
          <h2 className="modal-title-h2">Admin-pålogging</h2>
        </div>
        <form onSubmit={handleSubmit} className="add-form">
          <label>
            E-post
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="din@epost.no"
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          <label>
            Passord
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn-save" disabled={loading}>
            {loading ? 'Logger inn...' : 'Logg inn'}
          </button>
        </form>
      </div>
    </div>
  )
}
