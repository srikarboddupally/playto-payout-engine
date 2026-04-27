const fmt = (p) => `₹${(p/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const STATUS = {
  pending:    { color: 'var(--yellow)', bg: 'var(--yellow-dim)', dot: '#f5a623' },
  processing: { color: 'var(--blue)',   bg: 'var(--blue-dim)',   dot: '#4e9eff' },
  completed:  { color: 'var(--green)',  bg: 'var(--green-dim)',  dot: '#00d084' },
  failed:     { color: 'var(--red)',    bg: 'var(--red-dim)',    dot: '#ff4757' },
}

export default function PayoutTable({ payouts }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <p style={{
          fontSize: 11, fontFamily: 'DM Mono', letterSpacing: '1px',
          color: 'var(--text-3)', textTransform: 'uppercase',
        }}>Payout History</p>
      </div>

      {payouts.length === 0 ? (
        <div style={{ padding: 24 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'DM Mono' }}>No payouts yet</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Amount', 'Status', 'Bank Account', 'Attempts', 'Event Trail', 'Created'].map(h => (
                <th key={h} style={{
                  padding: '10px 24px', textAlign: 'left',
                  fontSize: 10, fontFamily: 'DM Mono', letterSpacing: '0.5px',
                  color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 400,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, i) => {
              const s = STATUS[p.current_status] || STATUS.pending
              return (
                <tr key={p.id} style={{
                  borderBottom: i < payouts.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{
                      fontSize: 14, fontFamily: 'DM Mono', fontWeight: 500, color: 'var(--text)',
                    }}>{fmt(p.amount_paise)}</span>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: s.bg, color: s.color,
                      padding: '3px 10px', borderRadius: 20,
                      fontSize: 11, fontFamily: 'DM Mono',
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: s.dot,
                        boxShadow: p.current_status === 'pending' ? `0 0 6px ${s.dot}` : 'none',
                      }} />
                      {p.current_status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'DM Mono' }}>
                      {p.bank_account}
                    </span>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{
                      fontSize: 12, fontFamily: 'DM Mono', color: 'var(--text-3)',
                      background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4,
                    }}>{p.attempts}</span>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      {p.events.map((e, idx) => (
                        <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{
                            fontSize: 10, fontFamily: 'DM Mono',
                            color: STATUS[e.event_type]?.color || 'var(--text-3)',
                          }}>{e.event_type}</span>
                          {idx < p.events.length - 1 && (
                            <span style={{ color: 'var(--text-3)', fontSize: 10 }}>›</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'DM Mono' }}>
                      {new Date(p.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}