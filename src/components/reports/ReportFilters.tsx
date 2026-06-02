'use client'

import { useRouter } from 'next/navigation'

interface Props {
  currentFilter: string
  currentLead: string
  leads: string[]
}

const CHIPS = [
  { label: 'All', value: 'all' },
  { label: 'Active Only', value: 'active' },
  { label: 'At Risk', value: 'atrisk' },
  { label: 'Needs Attention', value: 'yellow' },
]

export default function ReportFilters({ currentFilter, currentLead, leads }: Props) {
  const router = useRouter()

  function navigate(filter: string, lead: string) {
    const params = new URLSearchParams()
    if (filter && filter !== 'all') params.set('filter', filter)
    if (lead) params.set('lead', lead)
    const qs = params.toString()
    router.push('/reports' + (qs ? '?' + qs : ''))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {CHIPS.map(chip => {
        const active = currentFilter === chip.value || (chip.value === 'all' && !currentFilter)
        return (
          <button
            key={chip.value}
            onClick={() => navigate(chip.value, currentLead)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              background: active ? 'var(--navy)' : 'var(--line-soft)',
              color: active ? '#fff' : 'var(--ink-soft)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {chip.label}
          </button>
        )
      })}

      <select
        value={currentLead}
        onChange={e => navigate(currentFilter, e.target.value)}
        style={{
          marginLeft: 8,
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <option value="">All Leads</option>
        {leads.map(lead => (
          <option key={lead} value={lead}>{lead}</option>
        ))}
      </select>
    </div>
  )
}
