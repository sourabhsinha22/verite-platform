'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const currentYear = new Date().getFullYear()
const YEARS = ['all', ...Array.from({ length: currentYear - 2022 }, (_, i) => String(currentYear - i))]

export default function YearFilter() {
  const router = useRouter()
  const sp = useSearchParams()
  const current = sp.get('year') ?? 'all'
  const tab = sp.get('tab') ?? 'revenue'
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>Period</span>
      {YEARS.map(y => (
        <button key={y} onClick={() => router.push(`/finance?tab=${tab}&year=${y}`)}
          style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
            background: current === y ? 'var(--navy)' : 'var(--line-soft)',
            color: current === y ? '#fff' : 'var(--ink-soft)', transition: 'all 0.15s' }}>
          {y === 'all' ? 'All Time' : y}
        </button>
      ))}
    </div>
  )
}
