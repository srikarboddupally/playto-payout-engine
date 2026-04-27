import { useState, useEffect, useCallback } from 'react'
import { getBalance, getPayouts, getLedger } from '../api'
import BalanceCard from './BalanceCard'
import PayoutForm from './PayoutForm'
import PayoutTable from './PayoutTable'
import LedgerTable from './LedgerTable'

export default function Dashboard({ merchant }) {
  const [balance, setBalance] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!merchant) return
    Promise.all([
      getBalance(merchant.id),
      getPayouts(merchant.id),
      getLedger(merchant.id),
    ]).then(([b, p, l]) => {
      setBalance(b.data)
      setPayouts(p.data)
      setLedger(l.data)
      setLoading(false)
    })
  }, [merchant])

  useEffect(() => {
    setLoading(true)
    refresh()
    const interval = setInterval(refresh, 4000)
    return () => clearInterval(interval)
  }, [refresh])

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 56px)', flexDirection: 'column', gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, border: '2px solid var(--border-strong)',
        borderTopColor: 'var(--green)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'DM Mono' }}>Loading</span>
    </div>
  )

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 64px' }}>
      {/* Merchant info */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'Syne', fontWeight: 800, fontSize: 26,
          letterSpacing: '-0.5px', color: 'var(--text)',
        }}>{merchant.name}</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'DM Mono', marginTop: 2 }}>
          {merchant.email} · {merchant.id.slice(0, 8)}...
        </p>
      </div>

      <BalanceCard balance={balance} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginTop: 16,
      }}>
        <PayoutForm merchant={merchant} balance={balance} onSuccess={refresh} />
        <LedgerTable ledger={ledger} />
      </div>

      <div style={{ marginTop: 16 }}>
        <PayoutTable payouts={payouts} />
      </div>
    </main>
  )
}