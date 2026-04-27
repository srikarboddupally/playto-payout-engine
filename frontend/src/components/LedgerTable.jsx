const fmt = (p) => `₹${(Math.abs(p)/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function LedgerTable({ ledger }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24, overflow: 'hidden',
    }}>
      <p style={{
        fontSize: 11, fontFamily: 'DM Mono', letterSpacing: '1px',
        color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 20,
      }}>Ledger</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ledger.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'DM Mono' }}>No entries</p>
        ) : ledger.map(e => (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
              <p style={{
                fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{e.description}</p>
              <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'DM Mono', marginTop: 2 }}>
                {new Date(e.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
            <span style={{
              fontSize: 13, fontFamily: 'DM Mono', fontWeight: 500,
              color: e.entry_type === 'credit' ? 'var(--green)' : 'var(--red)',
              flexShrink: 0,
            }}>
              {e.entry_type === 'credit' ? '+' : '−'}{fmt(e.amount_paise)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}