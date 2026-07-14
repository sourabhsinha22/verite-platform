'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import { CompanyTag } from '@/lib/types'

export interface CompanyRow {
  id: string
  name: string
  tag: string
  industry: string | null
  address: string | null
  account_owner: string | null
  contactCount: number
  engagementCount: number
  activeEngagementCount: number
  totalRevenue: number
}

interface Props {
  companies: CompanyRow[]
}

const TAG_PRIORITY: Record<string, number> = { current: 0, prospect: 1, past: 2 }

function formatRevenue(amount: number): string {
  if (amount === 0) return '—'
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`
  return `$${amount}`
}

const TAG_LABELS: Record<string, string> = {
  current: 'Current Client',
  prospect: 'Prospect',
  past: 'Past Client',
}

export default function DirectoryClient({ companies }: Props) {
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string>('all')

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of companies) {
      counts[c.tag] = (counts[c.tag] ?? 0) + 1
    }
    return counts
  }, [companies])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies
      .filter(c => {
        if (activeTag !== 'all' && c.tag !== activeTag) return false
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          (c.industry ?? '').toLowerCase().includes(q) ||
          (c.account_owner ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const pa = TAG_PRIORITY[a.tag] ?? 9
        const pb = TAG_PRIORITY[b.tag] ?? 9
        if (pa !== pb) return pa - pb
        return a.name.localeCompare(b.name)
      })
  }, [companies, search, activeTag])

  const chips = useMemo(() => {
    const result: { key: string; label: string; count: number }[] = []
    for (const key of ['current', 'prospect', 'past']) {
      const count = tagCounts[key] ?? 0
      if (count > 0) result.push({ key, label: TAG_LABELS[key], count })
    }
    return result
  }, [tagCounts])

  return (
    <div>
      <style>{`
        .hover-row { cursor: pointer; transition: background 0.1s; }
        .hover-row:hover { background: var(--line-soft) !important; }
        .dir-chip { cursor: pointer; border: 1px solid var(--line); borderRadius: 20px; padding: 5px 13px; fontSize: 12px; fontWeight: 500; transition: background 0.12s, color 0.12s; }
      `}</style>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search input */}
        <div style={{ position: 'relative', width: 280 }}>
          <span style={{
            position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--ink-faint)', fontSize: 13, pointerEvents: 'none', lineHeight: 1,
          }}>
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies…"
            style={{
              fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 6, padding: '7px 10px 7px 28px',
              width: '100%', boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>

        {/* Tag chips */}
        <div style={{ display: 'flex', gap: 6 }}>
          {/* All chip */}
          <button
            onClick={() => setActiveTag('all')}
            style={{
              cursor: 'pointer',
              border: '1px solid var(--line)',
              borderRadius: 20,
              padding: '5px 13px',
              fontSize: 12,
              fontWeight: 500,
              background: activeTag === 'all' ? 'var(--navy)' : 'var(--surface)',
              color: activeTag === 'all' ? '#fff' : 'var(--ink-soft)',
            }}
          >
            All ({companies.length})
          </button>
          {chips.map(chip => (
            <button
              key={chip.key}
              onClick={() => setActiveTag(chip.key)}
              style={{
                cursor: 'pointer',
                border: '1px solid var(--line)',
                borderRadius: 20,
                padding: '5px 13px',
                fontSize: 12,
                fontWeight: 500,
                background: activeTag === chip.key ? 'var(--navy)' : 'var(--surface)',
                color: activeTag === chip.key ? '#fff' : 'var(--ink-soft)',
              }}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 8, padding: '48px 32px', textAlign: 'center', color: 'var(--ink-faint)',
        }}>
          <p style={{ fontSize: 14, margin: 0 }}>No companies match your search.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Company', 'Tag', 'Industry', 'Revenue', 'Contacts', 'Engagements', 'Account Owner'].map(h => (
                  <th key={h} style={{
                    textAlign: h === 'Contacts' || h === 'Engagements' ? 'center' : 'left',
                    padding: '12px 16px',
                    fontSize: 10,
                    color: 'var(--wine)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((company, i) => (
                <tr
                  key={company.id}
                  className="hover-row"
                  style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <Link
                      href={`/directory/${company.id}`}
                      style={{ textDecoration: 'none', color: 'var(--navy)', fontWeight: 500, fontSize: 13, display: 'block' }}
                    >
                      {company.name}
                    </Link>
                    {company.address && (
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{company.address}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Badge tag={(company.tag as CompanyTag) || 'prospect'} />
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>
                    {company.industry || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: company.totalRevenue > 0 ? 'var(--ink)' : 'var(--ink-faint)', fontWeight: company.totalRevenue > 0 ? 500 : 400 }}>
                    {formatRevenue(company.totalRevenue)}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center' }}>
                    {company.contactCount}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center' }}>
                    {company.engagementCount}
                    {company.activeEngagementCount > 0 && (
                      <span style={{ color: 'var(--success)', marginLeft: 6, fontSize: 12 }}>
                        ({company.activeEngagementCount} active)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>
                    {company.account_owner || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
