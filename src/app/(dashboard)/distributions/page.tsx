export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import StatCard from '@/components/ui/StatCard'
import DistributionsClient, { DistRowActions } from '@/components/distributions/DistributionsClient'
import type { Distribution } from '@/lib/types'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function DistributionsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('distributions')
    .select('*')
    .order('date', { ascending: false })

  const distributions: Distribution[] = data ?? []

  const totalDistributed = distributions.reduce((s, d) => s + d.amount, 0)

  // By recipient
  const byRecipient: Record<string, number> = {}
  for (const d of distributions) {
    byRecipient[d.recipient] = (byRecipient[d.recipient] ?? 0) + d.amount
  }
  const topRecipients = Object.entries(byRecipient).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const allRecipients = Object.keys(byRecipient)
  const existingRecipients = Array.from(new Set(['Tana Whitt', 'Shannon Chema', 'Charissa Duffy', ...allRecipients]))

  // Monthly grid
  const monthlyGrid: Record<string, Record<string, number>> = {}
  for (const d of distributions) {
    const month = d.date.slice(0, 7) // "2026-05"
    if (!monthlyGrid[month]) monthlyGrid[month] = {}
    monthlyGrid[month][d.recipient] = (monthlyGrid[month][d.recipient] ?? 0) + d.amount
  }
  const months = Object.keys(monthlyGrid).sort()
  const recipients = allRecipients.length > 0 ? allRecipients : ['Tana Whitt', 'Shannon Chema', 'Charissa Duffy']

  function fmtMonthLabel(m: string) {
    return new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  return (
    <div>
      <style>{`.hover-row:hover { background: var(--line-soft) !important; }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
          Distributions
        </h1>
        <DistributionsClient distributions={distributions} />
      </div>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 36px' }}>Partner distributions from company revenue</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        <StatCard label="Total Distributed" value={fmt(totalDistributed)} accent="info" />
        {topRecipients[0] && <StatCard label={topRecipients[0][0]} value={fmt(topRecipients[0][1])} accent="warn" />}
        {topRecipients[1] && <StatCard label={topRecipients[1][0]} value={fmt(topRecipients[1][1])} accent="warn" />}
        {topRecipients[2] && <StatCard label={topRecipients[2][0]} value={fmt(topRecipients[2][1])} accent="warn" />}
      </div>

      {/* Monthly grid */}
      {months.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--line-soft)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Monthly Grid</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>Month</th>
                  {recipients.map(r => (
                    <th key={r} style={{ textAlign: 'right', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{r}</th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {months.map(m => {
                  const rowTotal = recipients.reduce((s, r) => s + (monthlyGrid[m]?.[r] ?? 0), 0)
                  return (
                    <tr key={m} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{fmtMonthLabel(m)}</td>
                      {recipients.map(r => (
                        <td key={r} style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right', color: monthlyGrid[m]?.[r] ? 'var(--ink)' : 'var(--ink-faint)' }}>
                          {monthlyGrid[m]?.[r] ? fmt(monthlyGrid[m][r]) : '—'}
                        </td>
                      ))}
                      <td style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{fmt(rowTotal)}</td>
                    </tr>
                  )
                })}
                {/* Totals row */}
                <tr style={{ borderTop: '2px solid var(--line)', background: 'var(--line-soft)' }}>
                  <td style={{ padding: '13px 16px', fontSize: 12, fontWeight: 600, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Total</td>
                  {recipients.map(r => (
                    <td key={r} style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>
                      {fmt(byRecipient[r] ?? 0)}
                    </td>
                  ))}
                  <td style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{fmt(totalDistributed)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--line-soft)' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>All Distributions</h2>
        </div>
        {distributions.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>No distributions yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Date', 'Recipient', 'Amount', 'Notes', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {distributions.map(d => (
                <tr key={d.id} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <td style={{ padding: '13px 16px', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>{fmtDate(d.date)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500 }}>{d.recipient}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: 'var(--warn)' }}>{fmt(d.amount)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-faint)' }}>{d.notes || '—'}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <DistRowActions distribution={d} existingRecipients={existingRecipients} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
