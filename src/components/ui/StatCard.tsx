interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'rose' | 'green' | 'warn' | 'info'
}

const ACCENTS = {
  rose:  { bg: '#fff', value: 'var(--wine)' },
  green: { bg: '#fff', value: 'var(--success)' },
  warn:  { bg: '#fff', value: 'var(--warn)' },
  info:  { bg: '#fff', value: 'var(--navy)' },
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  const valueColor = accent ? ACCENTS[accent].value : 'var(--navy)'
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: '8px',
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: '42px', fontWeight: 600, marginTop: '8px', color: valueColor, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '4px' }}>{sub}</div>
      )}
    </div>
  )
}
