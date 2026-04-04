import { ZONE_INFO } from '../utils'

const ZONE_DISPLAY = {
  1: { bg: '#d1d5db', headerBg: '#9ca3af', label: 'Intensitetssone 1' },
  2: { bg: '#bfdbfe', headerBg: '#60a5fa', label: 'Intensitetssone 2' },
  3: { bg: '#bbf7d0', headerBg: '#4ade80', label: 'Intensitetssone 3' },
  4: { bg: '#fef08a', headerBg: '#facc15', label: 'Intensitetssone 4' },
  5: { bg: '#fca5a5', headerBg: '#f87171', label: 'Intensitetssone 5' },
}

export default function IntensityScaleModal({ onClose }) {
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop} style={{ zIndex: 200 }}>
      <div className="modal" style={{ padding: '1.5rem 1rem 2rem' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title-h2">Din intensitetsskala</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3, 4, 5].map(zone => {
            const info = ZONE_INFO[zone]
            const display = ZONE_DISPLAY[zone]
            return (
              <div key={zone} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
                <div style={{ background: display.headerBg, padding: '0.5rem 0.75rem' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{display.label}</strong>
                </div>
                <div style={{ background: display.bg, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 700, color: '#374151' }}>RPE beskrivelse</span><br />
                    {info.rpe}
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 700, color: '#374151' }}>Hjertefrekvens</span><br />
                    {info.hr} bpm
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 700, color: '#374151' }}>Ventilasjon / pust</span><br />
                    {info.breathing}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
