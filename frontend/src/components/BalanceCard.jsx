const fmt = (p) => `₹${(p/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function BalanceCard({ balance }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1,
      background: 'var(--border)', borderRadius: 12, overflow: 'hidden',
      border: '1px solid var(--border)',
    }}>
      {[
        { label: 'Total Balance', value: balance.total_balance_paise, color: 'var(--text)', accent: null },
        { label: 'Held', value: balance.held_balance_paise, color: 'var(--yellow)', accent: 'var(--yellow-dim)' },
        { label: 'Available', value: balance.available_balance_paise, color: 'var(--green)', accent: 'var(--green-dim)' },
      ].map(({ label, value, color, accent }) => (
        <div key={label} style={{
          background: accent || 'var(--surface)',
          padding: '24px 28px',
          position: 'relative', overflow: 'hidden',
        }}>
          <p style={{
            fontSize: 10, fontFamily: 'DM Mono', letterSpacing: '1px',
            color: color === 'var(--text)' ? 'var(--text-3)' : color,
            textTransform: 'uppercase', marginBottom: 10,
          }}>{label}</p>
          <p style={{
            fontSize: 28, fontFamily: 'Syne', fontWeight: 800,
            color, letterSpacing: '-1px', lineHeight: 1,
          }}>{fmt(value)}</p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontFamily: 'DM Mono' }}>
            {(value/100).toFixed(0)} rupees
          </p>
        </div>
      ))}
    </div>
  )
}