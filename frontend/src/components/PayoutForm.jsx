import { useState } from 'react'
import { createPayout } from '../api'

export default function PayoutForm({ merchant, balance, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const bank = balance?.bank_accounts?.[0]
  const available = balance?.available_balance_paise || 0

  const handleSubmit = async () => {
    if (!amount || !bank) return
    const paise = Math.round(parseFloat(amount) * 100)
    if (paise <= 0) return

    setLoading(true)
    setStatus(null)
    try {
      await createPayout({
        merchant_id: merchant.id,
        amount_paise: paise,
        bank_account_id: bank.id,
      }, crypto.randomUUID())
      setStatus({ ok: true, msg: `₹${amount} payout initiated` })
      setAmount('')
      setTimeout(onSuccess, 800)
    } catch (err) {
      setStatus({ ok: false, msg: err.response?.data?.error || 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontFamily: 'DM Mono', letterSpacing: '1px', color: 'var(--text-3)', textTransform: 'uppercase' }}>
          Request Payout
        </p>
        <span style={{
          fontSize: 10, fontFamily: 'DM Mono', color: 'var(--green)',
          background: 'var(--green-dim)', padding: '2px 8px', borderRadius: 4,
        }}>
          avail. ₹{(available/100).toLocaleString('en-IN')}
        </span>
      </div>

      {bank && (
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, background: 'var(--surface-3)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'var(--text-2)',
          }}>
            {bank.ifsc_code.slice(0, 2)}
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{bank.account_holder_name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'DM Mono' }}>
              {bank.ifsc_code} · ····{bank.account_number_last4}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
          borderRadius: 8, padding: '0 14px', gap: 8,
        }}>
          <span style={{ color: 'var(--text-3)', fontSize: 16, fontFamily: 'DM Mono' }}>₹</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="0.00"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 16, fontFamily: 'DM Mono',
              padding: '12px 0',
            }}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !amount}
          style={{
            background: loading || !amount ? 'var(--surface-3)' : 'var(--green)',
            color: loading || !amount ? 'var(--text-3)' : '#000',
            border: 'none', borderRadius: 8, padding: '0 20px',
            fontSize: 13, fontWeight: 600, cursor: loading || !amount ? 'not-allowed' : 'pointer',
            fontFamily: 'Syne', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          {loading ? '...' : 'Withdraw'}
        </button>
      </div>

      {status && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: status.ok ? 'var(--green-dim)' : 'var(--red-dim)',
          border: `1px solid ${status.ok ? 'rgba(0,208,132,0.2)' : 'rgba(255,71,87,0.2)'}`,
          borderRadius: 8, fontSize: 12,
          color: status.ok ? 'var(--green)' : 'var(--red)',
          fontFamily: 'DM Mono',
        }}>
          {status.ok ? '✓' : '✕'} {status.msg}
        </div>
      )}
    </div>
  )
}