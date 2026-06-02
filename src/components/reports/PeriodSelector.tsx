'use client'

import { useRouter } from 'next/navigation'

interface PeriodSelectorProps {
  current: string
}

const PERIODS = [
  { key: 'mtd', label: 'Month to Date' },
  { key: 'qtd', label: 'Quarter to Date' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'all', label: 'All Time' },
] as const

export default function PeriodSelector({ current }: PeriodSelectorProps) {
  const router = useRouter()

  return (
    <div
      className="no-print"
      style={{
        display: 'flex',
        gap: 4,
        background: 'var(--line-soft)',
        padding: 4,
        borderRadius: 8,
        width: 'fit-content',
      }}
    >
      {PERIODS.map(p => {
        const isActive = p.key === current
        return (
          <button
            key={p.key}
            onClick={() => router.push(`/reports/financial?period=${p.key}`)}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              border: 'none',
              cursor: 'pointer',
              background: isActive ? 'var(--navy)' : 'transparent',
              color: isActive ? '#fff' : 'var(--ink-soft)',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
