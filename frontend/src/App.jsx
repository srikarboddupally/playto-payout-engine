import { useState, useEffect } from 'react'
import { getMerchants } from './api'
import Dashboard from './components/Dashboard'

export default function App() {
  const [merchants, setMerchants] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getMerchants().then(r => {
      setMerchants(r.data)
      setSelected(r.data[0])
    })
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'rgba(8,10,15,0.9)',
        backdropFilter: 'blur(12px)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--green)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>
            Playto Pay
          </span>
          <span style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '1px 7px',
            fontSize: 10,
            color: 'var(--text-2)',
            fontFamily: 'DM Mono',
            letterSpacing: '0.5px',
          }}>PAYOUT ENGINE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Merchant</span>
          <select
            value={selected?.id || ''}
            onChange={e => setSelected(merchants.find(m => m.id === e.target.value))}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              color: 'var(--text)',
              padding: '6px 12px',
              fontSize: 13,
              fontFamily: 'DM Sans',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {merchants.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </header>

      {selected && <Dashboard merchant={selected} />}
    </div>
  )
}