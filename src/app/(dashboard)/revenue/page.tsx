export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function fmtFull(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMonth(m: string | null) {
  if (!m) return '—'
  return new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default async function RevenuePage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('revenue_items')
    .select('*, engagement:engagements(id, name, company:companies(id, name))')
    .order('month', { ascending: true })

  const rows = items ?? []

  const totalForecast = rows.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
  const totalActual = rows.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
  const variance = totalActual - totalForecast
  const pctCollected = totalForecast > 0 ? Math.round((totalActual / totalForecast) * 100) : 0

  // Group by engagement
  const byEngagement: Record<string, {
    engagementId: string; engagementName: string; companyName: string; companyId: string; rows: typeof rows
  }> = {}
  for (const item of rows) {
    const eng = item.engagement as { id: string; name: string; company?: { id: string; name: string } } | null
    if (!eng) continue
    if (!byEngagement[eng.id]) {
      byEngagement[eng.id] = {
        engagementId: eng.id,
        engagementName: eng.name,
        companyName: eng.company?.name ?? '—',
        companyId: eng.company?.id ?? '',
        rows: [],
      }
    }
    byEngagement[eng.id].rows.push(item)
  }

  // Year-over-Year grouping
  const CLIENT_COLORS = ['#5f3e3f','#2d6a3e','#185FA5','#b8841a','#7F77DD','#D85A30','#2f2e4b','#993556','#c59a88','#0C447C']

  // Collect engagements in order of first appearance
  const engOrderMap: Record<string, number> = {}
  let engOrderIdx = 0
  for (const item of rows) {
    const eng = item.engagement as { id: string; name: string } | null
    if (!eng) continue
    if (!(eng.id in engOrderMap)) {
      engOrderMap[eng.id] = engOrderIdx++
    }
  }

  // Per-year per-engagement forecast/actual
  const yoyEngMap: Record<number, Record<string, { forecast: number; actual: number; name: string }>> = {}
  for (const item of rows) {
    if (!item.month) continue
    const eng = item.engagement as { id: string; name: string } | null
    if (!eng) continue
    const year = parseInt(item.month.slice(0, 4))
    if (!yoyEngMap[year]) yoyEngMap[year] = {}
    if (!yoyEngMap[year][eng.id]) yoyEngMap[year][eng.id] = { forecast: 0, actual: 0, name: eng.name }
    yoyEngMap[year][eng.id].forecast += item.forecast_amount ?? 0
    yoyEngMap[year][eng.id].actual += item.actual_amount ?? 0
  }

  const yoyYears = Object.keys(yoyEngMap).map(Number).sort()

  // All unique engagements across all years
  const allEngIds = Object.keys(engOrderMap).sort((a, b) => engOrderMap[a] - engOrderMap[b])
  const allEngNames: Record<string, string> = {}
  for (const item of rows) {
    const eng = item.engagement as { id: string; name: string } | null
    if (eng && !allEngNames[eng.id]) allEngNames[eng.id] = eng.name
  }

  // Per-year totals (for stacked bar sizing)
  const yoyYearTotals: Record<number, number> = {}
  for (const year of yoyYears) {
    yoyYearTotals[year] = Object.values(yoyEngMap[year]).reduce((s, e) => s + e.forecast, 0)
  }

  return (
    <div>
      <style>{`.hover-row { cursor: pointer; transition: background 0.1s; } .hover-row:hover { background: var(--line-soft) !important; }`}</style>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
        Revenue
      </h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 28px' }}>
        Forecast vs. actuals across all engagements
      </p>

      {/* Year over Year */}
      {yoyYears.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 18px' }}>Year over Year</h2>

          {/* Part A — Stacked bar chart by engagement */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '24px 28px', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {yoyYears.map(year => {
                const engsThisYear = yoyEngMap[year] ?? {}
                const grandTotal = yoyYearTotals[year] || 1
                const yearActual = Object.values(engsThisYear).reduce((s, e) => s + e.actual, 0)
                // Sort engagement segments by engOrderMap
                const segments = Object.entries(engsThisYear).sort(([a], [b]) => (engOrderMap[a] ?? 99) - (engOrderMap[b] ?? 99))
                return (
                  <div key={year}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', width: 40, flexShrink: 0 }}>{year}</span>
                      {/* Stacked bar */}
                      <div style={{ flex: 1, height: 28, display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
                        {segments.map(([engId, eng], i) => {
                          const pct = (eng.forecast / grandTotal) * 100
                          const color = CLIENT_COLORS[engOrderMap[engId] % CLIENT_COLORS.length]
                          const isFirst = i === 0
                          const isLast = i === segments.length - 1
                          return (
                            <div
                              key={engId}
                              title={`${eng.name}: ${fmtFull(eng.forecast)}`}
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: color,
                                borderRadius: isFirst && isLast ? 4 : isFirst ? '4px 0 0 4px' : isLast ? '0 4px 4px 0' : 0,
                                flexShrink: 0,
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ marginLeft: 56, fontSize: 11, color: 'var(--ink-soft)', display: 'flex', gap: 16 }}>
                      <span>Forecast: <strong style={{ color: 'var(--navy)' }}>{fmtFull(grandTotal)}</strong></span>
                      {yearActual > 0 && <span>Actual received: <strong style={{ color: 'var(--success)' }}>{fmtFull(yearActual)}</strong></span>}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              {allEngIds.map(engId => {
                const color = CLIENT_COLORS[engOrderMap[engId] % CLIENT_COLORS.length]
                const name = allEngNames[engId] ?? engId
                return (
                  <div key={engId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{name}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Part B — Per-engagement × year table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, whiteSpace: 'nowrap' }}>Engagement</th>
                    {yoyYears.map((year, yi) => (
                      [
                        <th key={`${year}-f`} style={{ textAlign: 'right', padding: '9px 12px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, whiteSpace: 'nowrap' }}>{year} Forecast</th>,
                        <th key={`${year}-a`} style={{ textAlign: 'right', padding: '9px 12px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, whiteSpace: 'nowrap', borderRight: yi < yoyYears.length - 1 ? '1px solid var(--line)' : undefined }}>{year} Actual</th>,
                      ]
                    ))}
                    <th style={{ textAlign: 'right', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {allEngIds.map(engId => {
                    const name = allEngNames[engId] ?? engId
                    const color = CLIENT_COLORS[engOrderMap[engId] % CLIENT_COLORS.length]
                    const engTotal = yoyYears.reduce((s, y) => s + (yoyEngMap[y]?.[engId]?.forecast ?? 0), 0)
                    return (
                      <tr key={engId} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--navy)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {name}
                        </td>
                        {yoyYears.map((year, yi) => {
                          const eng = yoyEngMap[year]?.[engId]
                          const prevYear = yoyYears[yi - 1]
                          const prevForecast = prevYear ? (yoyEngMap[prevYear]?.[engId]?.forecast ?? 0) : null
                          const curForecast = eng?.forecast ?? 0
                          let growthBadge: { pct: number; positive: boolean } | null = null
                          if (prevForecast !== null && prevForecast > 0 && curForecast > 0) {
                            const pctChange = Math.round(((curForecast - prevForecast) / prevForecast) * 100)
                            growthBadge = { pct: pctChange, positive: pctChange >= 0 }
                          }
                          return [
                            <td key={`${year}-f`} style={{ padding: '11px 12px', fontSize: 13, color: 'var(--ink-soft)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {eng ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                  {growthBadge && (
                                    <span style={{
                                      fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                                      background: growthBadge.positive ? 'var(--success-soft)' : '#fde8e8',
                                      color: growthBadge.positive ? 'var(--success)' : 'var(--danger)',
                                    }}>
                                      {growthBadge.positive ? '+' : ''}{growthBadge.pct}%
                                    </span>
                                  )}
                                  {fmtFull(eng.forecast)}
                                </span>
                              ) : '—'}
                            </td>,
                            <td key={`${year}-a`} style={{ padding: '11px 12px', fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: eng?.actual ? 500 : 400, color: eng?.actual ? 'var(--success)' : 'var(--ink-faint)', borderRight: yi < yoyYears.length - 1 ? '1px solid var(--line-soft)' : undefined }}>
                              {eng?.actual ? fmtFull(eng.actual) : '—'}
                            </td>,
                          ]
                        })}
                        <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: 'var(--navy)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtFull(engTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--line-soft)', borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total</td>
                    {yoyYears.map((year, yi) => {
                      const yearForecast = yoyYearTotals[year] ?? 0
                      const yearActual = Object.values(yoyEngMap[year] ?? {}).reduce((s, e) => s + e.actual, 0)
                      return [
                        <td key={`${year}-f`} style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--navy)', textAlign: 'right' }}>{fmtFull(yearForecast)}</td>,
                        <td key={`${year}-a`} style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: yearActual > 0 ? 'var(--success)' : 'var(--ink-faint)', textAlign: 'right', borderRight: yi < yoyYears.length - 1 ? '1px solid var(--line)' : undefined }}>{yearActual > 0 ? fmtFull(yearActual) : '—'}</td>,
                      ]
                    })}
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--navy)', textAlign: 'right' }}>
                      {fmtFull(yoyYears.reduce((s, y) => s + (yoyYearTotals[y] ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        <StatCard label="Total Forecast" value={fmt(totalForecast)} sub={`${rows.length} line items`} accent="info" />
        <StatCard label="Total Actual" value={fmt(totalActual)} sub="received" accent="green" />
        <StatCard label="Variance" value={(variance >= 0 ? '+' : '') + fmt(variance)} accent={variance >= 0 ? 'green' : 'rose'} />
        <StatCard label="% Collected" value={`${pctCollected}%`} sub="of forecast" accent={pctCollected >= 80 ? 'green' : pctCollected >= 50 ? 'warn' : 'rose'} />
      </div>

      {Object.values(byEngagement).length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
          No revenue data yet. Add revenue items inside an engagement to see them here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.values(byEngagement).map(group => {
            const grpForecast = group.rows.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
            const grpActual = group.rows.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
            const grpVariance = grpActual - grpForecast
            const grpPct = grpForecast > 0 ? Math.round((grpActual / grpForecast) * 100) : 0
            return (
              <div key={group.engagementId} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: 'var(--line-soft)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <Link href={`/engagements/${group.engagementId}`} style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--navy)', textDecoration: 'none' }}>
                      {group.engagementName}
                    </Link>
                    {group.companyName !== '—' && (
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                        — {group.companyName}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--ink-soft)' }}>
                    <span>Forecast: <strong style={{ color: 'var(--navy)' }}>{fmtFull(grpForecast)}</strong></span>
                    <span>Actual: <strong style={{ color: 'var(--success)' }}>{fmtFull(grpActual)}</strong></span>
                    <span style={{ color: grpVariance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {grpPct}% collected
                    </span>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(241,239,232,0.5)', borderBottom: '1px solid var(--line)' }}>
                      {['Label', 'Month', 'Forecast', 'Actual', 'Variance', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((item) => {
                      const v = (item.actual_amount ?? 0) - item.forecast_amount
                      const hasActual = item.actual_amount != null
                      return (
                        <tr key={item.id} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <td style={{ padding: '11px 16px', fontSize: 13 }}>{item.label}</td>
                          <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{fmtMonth(item.month)}</td>
                          <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{fmtFull(item.forecast_amount)}</td>
                          <td style={{ padding: '11px 16px', fontSize: 13, color: hasActual ? 'var(--success)' : 'var(--ink-faint)', fontWeight: hasActual ? 500 : 400 }}>
                            {hasActual ? fmtFull(item.actual_amount!) : '—'}
                          </td>
                          <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 500, color: !hasActual ? 'var(--ink-faint)' : v >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {hasActual ? (v >= 0 ? '+' : '') + fmtFull(v) : '—'}
                          </td>
                          <td style={{ padding: '11px 16px' }}>
                            {hasActual ? (
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--success-soft)', color: 'var(--success)' }}>Received</span>
                            ) : (
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--line-soft)', color: 'var(--ink-faint)' }}>Forecast</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}

          {/* Grand total bar */}
          <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Grand Total</div>
            <div style={{ display: 'flex', gap: 40 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Forecast</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', fontFamily: 'var(--serif)' }}>{fmtFull(totalForecast)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Actual</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#7dd9a3', fontFamily: 'var(--serif)' }}>{fmtFull(totalActual)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Variance</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: variance >= 0 ? '#7dd9a3' : '#f5a0a0', fontFamily: 'var(--serif)' }}>
                  {(variance >= 0 ? '+' : '') + fmtFull(variance)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
