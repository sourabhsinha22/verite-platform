'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PERIODS = [
  { v: '30d', l: 'Last 30 Days' },
  { v: '90d', l: 'Last 90 Days' },
  { v: 'ytd', l: 'Year to Date' },
  { v: 'all', l: 'All Time' },
]

export default function PeriodFilter() {
  const router = useRouter()
  const sp = useSearchParams()
  const current = sp.get('period') ?? 'all'
  const tab = sp.get('tab') ?? 'velocity'
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
      {PERIODS.map(p => (
        <button
          key={p.v}
          onClick={() => router.push(`/sales-intelligence?tab=${tab}&period=${p.v}`)}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: current === p.v ? 'var(--navy)' : 'var(--line-soft)',
            color: current === p.v ? '#fff' : 'var(--ink-soft)',
            transition: 'all 0.15s',
          }}
        >
          {p.l}
        </button>
      ))}
    </div>
  )
}
