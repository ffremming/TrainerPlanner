import { useState } from 'react'
import SystemIcon from './SystemIcon'

const ADMIN_PIN = '1234'

export default function AdminPin({ onSuccess, onClose }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (pin === ADMIN_PIN) {
      onSuccess()
    } else {
      setError(true)
      setPin('')
      setTimeout(() => setError(false), 1500)
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal pin-modal">
        <button className="modal-close" onClick={onClose}><SystemIcon name="close" className="system-icon" /></button>
        <h2 className="modal-title-h2">Admin</h2>
        <p className="pin-hint">Skriv inn PIN-kode</p>
        <form onSubmit={handleSubmit} className="pin-form">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            className={`pin-input${error ? ' pin-error' : ''}`}
            placeholder="••••"
            autoFocus
          />
          {error && <div className="pin-error-msg">Feil PIN, prøv igjen</div>}
          <button type="submit" className="btn-save" style={{ marginTop: '1rem' }}>
            <SystemIcon name="login" className="button-icon" />
            Logg inn
          </button>
        </form>
      </div>
    </div>
  )
}
