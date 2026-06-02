export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'
import PnLClient from '@/components/pnl/PnLClient'
import { Expense, RevenueItem, EXPENSE_CATEGORIES, Engagement, EngagementStage, ENGAGEMENT_STAGE_LABELS } from '@/lib/types'

// ─── shared formatters ───────────────────────────────────────────
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

function fmtMonthShort(m: string) {
  return new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function roundUpNice(n: number): number {
  if (n <= 0) return 100000
  const mag = Math.pow(10, Math.floor(Math.log10(n)))
  return Math.ceil(n / mag) * mag
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${Math.round(v).toLocaleString()}`
}

function fmtMoneyFull(v: number): string {
  return `$${Math.round(v).toLocaleString()}`
}

// ─── tab titles ──────────────────────────────────────────────────
const TAB_TITLES: Record<string, string> = {
  revenue: 'Revenue',
  pnl: 'P&L Statement',
  cashflow: 'Monthly Cash Flow',
  forecast: 'Forecast',
}

const TABS = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'pnl', label: 'P&L' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'forecast', label: 'Forecast' },
]

const STAGE_PROBABILITY: Record<EngagementStage, number> = {
  lead: 10, opportunity: 30, active: 80, paused: 40, closed: 0,
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'revenue' } = await searchParams
  const activeTab = TABS.find(t => t.id === tab) ? tab : 'revenue'

  const supabase = await createClient()

  // ─── Tab bar ──────────────────────────────────────────────────
  const tabBar = (
    <div style={{ display: 'flex', gap: 4, marginBottom: 32, background: 'var(--line-soft)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
      {TABS.map(t => (
        <Link
          key={t.id}
          href={`/finance?tab=${t.id}`}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            background: activeTab === t.id ? 'var(--navy)' : 'transparent',
            color: activeTab === t.id ? '#fff' : 'var(--ink-soft)',
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // TAB: REVENUE
  // ═══════════════════════════════════════════════════════════════
  if (activeTab === 'revenue') {
    const { data: items } = await supabase
      .from('revenue_items')
      .select('*, engagement:engagements(id, name, company:companies(id, name))')
      .order('month', { ascending: true })

    const rows = items ?? []

    const totalForecast = rows.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
    const totalActual = rows.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
    const variance = totalActual - totalForecast
    const pctCollected = totalForecast > 0 ? Math.round((totalActual / totalForecast) * 100) : 0

    const byEngagement: Record<string, {
      engagementId: string; engagementName: string; companyName: string; companyId: string; rows: typeof rows
    }> = {}
    for (const item of rows) {
      const eng = item.engagement as { id: string; name: string; company?: { id: string; name: string } } | null
      if (!eng) continue
      if (!byEngagement[eng.id]) {
        byEngagement[eng.id] = { engagementId: eng.id, engagementName: eng.name, companyName: eng.company?.name ?? '—', companyId: eng.company?.id ?? '', rows: [] }
      }
      byEngagement[eng.id].rows.push(item)
    }

    const CLIENT_COLORS = ['#5f3e3f','#2d6a3e','#185FA5','#b8841a','#7F77DD','#D85A30','#2f2e4b','#993556','#c59a88','#0C447C']
    const engOrderMap: Record<string, number> = {}
    let engOrderIdx = 0
    for (const item of rows) {
      const eng = item.engagement as { id: string; name: string } | null
      if (!eng) continue
      if (!(eng.id in engOrderMap)) engOrderMap[eng.id] = engOrderIdx++
    }

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
    const allEngIds = Object.keys(engOrderMap).sort((a, b) => engOrderMap[a] - engOrderMap[b])
    const allEngNames: Record<string, string> = {}
    for (const item of rows) {
      const eng = item.engagement as { id: string; name: string } | null
      if (eng && !allEngNames[eng.id]) allEngNames[eng.id] = eng.name
    }
    const yoyYearTotals: Record<number, number> = {}
    for (const year of yoyYears) {
      yoyYearTotals[year] = Object.values(yoyEngMap[year]).reduce((s, e) => s + e.forecast, 0)
    }

    return (
      <div>
        <style>{`.hover-row { cursor: pointer; transition: background 0.1s; } .hover-row:hover { background: var(--line-soft) !important; }`}</style>
        {tabBar}
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
          Revenue
        </h1>
        <p style={{ color: 'var(--ink-soft)', margin: '0 0 28px' }}>Forecast vs. actuals across all engagements</p>

        {yoyYears.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 18px' }}>Year over Year</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '24px 28px', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {yoyYears.map(year => {
                  const engsThisYear = yoyEngMap[year] ?? {}
                  const grandTotal = yoyYearTotals[year] || 1
                  const yearActual = Object.values(engsThisYear).reduce((s, e) => s + e.actual, 0)
                  const segments = Object.entries(engsThisYear).sort(([a], [b]) => (engOrderMap[a] ?? 99) - (engOrderMap[b] ?? 99))
                  return (
                    <div key={year}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', width: 40, flexShrink: 0 }}>{year}</span>
                        <div style={{ flex: 1, height: 28, display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
                          {segments.map(([engId, eng], i) => {
                            const pct = (eng.forecast / grandTotal) * 100
                            const color = CLIENT_COLORS[engOrderMap[engId] % CLIENT_COLORS.length]
                            const isFirst = i === 0
                            const isLast = i === segments.length - 1
                            return (
                              <div key={engId} title={`${eng.name}: ${fmtFull(eng.forecast)}`} style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: isFirst && isLast ? 4 : isFirst ? '4px 0 0 4px' : isLast ? '0 4px 4px 0' : 0, flexShrink: 0 }} />
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
                                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: growthBadge.positive ? 'var(--success-soft)' : '#fde8e8', color: growthBadge.positive ? 'var(--success)' : 'var(--danger)' }}>
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
                      {group.companyName !== '—' && <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>— {group.companyName}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--ink-soft)' }}>
                      <span>Forecast: <strong style={{ color: 'var(--navy)' }}>{fmtFull(grpForecast)}</strong></span>
                      <span>Actual: <strong style={{ color: 'var(--success)' }}>{fmtFull(grpActual)}</strong></span>
                      <span style={{ color: grpVariance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{grpPct}% collected</span>
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

  // ═══════════════════════════════════════════════════════════════
  // TAB: P&L
  // ═══════════════════════════════════════════════════════════════
  if (activeTab === 'pnl') {
    const [{ data: revenueData }, { data: expenseData }] = await Promise.all([
      supabase.from('revenue_items').select('forecast_amount, actual_amount, month'),
      supabase.from('expenses').select('month, category, forecast, actual'),
    ])

    const revenue = (revenueData ?? []) as Pick<RevenueItem, 'forecast_amount' | 'actual_amount' | 'month'>[]
    const expenses = (expenseData ?? []) as Pick<Expense, 'month' | 'category' | 'forecast' | 'actual'>[]

    const monthSet = new Set<string>()
    for (const r of revenue) { if (r.month) monthSet.add(r.month) }
    for (const e of expenses) { if (e.month) monthSet.add(e.month) }
    const months = Array.from(monthSet).sort()

    const opexCatSet = new Set<string>()
    for (const e of expenses) {
      const catType = EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES]
      if (catType === 'opex') opexCatSet.add(e.category)
    }
    const opexCategories = Array.from(opexCatSet).sort()

    const monthData = months.map(month => {
      const revRows = revenue.filter(r => r.month === month)
      const revenue_forecast = revRows.reduce((s, r) => s + (r.forecast_amount || 0), 0)
      const revenue_actual = revRows.reduce((s, r) => s + (r.actual_amount || 0), 0)

      const expRows = expenses.filter(e => e.month === month)
      let cogs_forecast = 0, cogs_actual = 0, opex_forecast = 0, opex_actual = 0
      const opex_by_cat_forecast: Record<string, number> = {}
      const opex_by_cat_actual: Record<string, number> = {}

      for (const e of expRows) {
        const catType = EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES]
        if (catType === 'cogs') {
          cogs_forecast += e.forecast || 0
          cogs_actual += e.actual || 0
        } else if (catType === 'opex') {
          opex_forecast += e.forecast || 0
          opex_actual += e.actual || 0
          opex_by_cat_forecast[e.category] = (opex_by_cat_forecast[e.category] ?? 0) + (e.forecast || 0)
          opex_by_cat_actual[e.category] = (opex_by_cat_actual[e.category] ?? 0) + (e.actual || 0)
        }
      }

      const gross_profit_forecast = revenue_forecast - cogs_forecast
      const gross_profit_actual = revenue_actual - cogs_actual
      const net_income_forecast = gross_profit_forecast - opex_forecast
      const net_income_actual = gross_profit_actual - opex_actual

      return { month, revenue_forecast, revenue_actual, cogs_forecast, cogs_actual, opex_forecast, opex_actual, opex_by_cat_forecast, opex_by_cat_actual, gross_profit_forecast, gross_profit_actual, net_income_forecast, net_income_actual }
    })

    return (
      <div>
        {tabBar}
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', marginBottom: 8, letterSpacing: '-0.5px' }}>
          P&amp;L Statement
        </h1>
        <PnLClient
          months={monthData}
          opexCategories={opexCategories}
          hasExpenses={expenses.length > 0}
        />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB: CASH FLOW
  // ═══════════════════════════════════════════════════════════════
  if (activeTab === 'cashflow') {
    const { data: items } = await supabase
      .from('revenue_items')
      .select('*, engagement:engagements(id, name, company:companies(id, name))')
      .order('month', { ascending: true })

    const rows = items ?? []
    const currentMonth = new Date().toISOString().slice(0, 7)

    const monthSet = new Set<string>()
    rows.forEach(r => { if (r.month) monthSet.add(r.month) })
    const months = Array.from(monthSet).sort()

    type EngInfo = { id: string; name: string; shortName: string }
    const engMap = new Map<string, EngInfo>()
    rows.forEach(r => {
      const eng = r.engagement as { id: string; name: string } | null
      if (!eng || engMap.has(eng.id)) return
      const parts = eng.name.split(' — ')
      const shortName = parts.length > 1 ? parts.slice(1).join(' — ') : eng.name
      engMap.set(eng.id, { id: eng.id, name: eng.name, shortName: shortName.length > 22 ? shortName.slice(0, 21) + '…' : shortName })
    })
    const engagements = Array.from(engMap.values())

    type Cell = { forecast: number; actual: number | null }
    const matrix: Record<string, Record<string, Cell>> = {}
    months.forEach(m => {
      matrix[m] = {}
      engagements.forEach(e => { matrix[m][e.id] = { forecast: 0, actual: null } })
    })
    rows.forEach(r => {
      if (!r.month || !r.engagement) return
      const eng = r.engagement as { id: string }
      if (!matrix[r.month]?.[eng.id]) return
      matrix[r.month][eng.id].forecast += r.forecast_amount ?? 0
      if (r.actual_amount != null) {
        matrix[r.month][eng.id].actual = (matrix[r.month][eng.id].actual ?? 0) + r.actual_amount
      }
    })

    type MonthTot = { forecast: number; actual: number; hasActual: boolean; variance: number; cumulative: number }
    const monthTotals: Record<string, MonthTot> = {}
    let running = 0
    months.forEach(m => {
      let fc = 0, act = 0, hasAny = false
      engagements.forEach(e => {
        const cell = matrix[m][e.id]
        if (cell) { fc += cell.forecast; if (cell.actual != null) { act += cell.actual; hasAny = true } }
      })
      running += act
      monthTotals[m] = { forecast: fc, actual: act, hasActual: hasAny, variance: act - fc, cumulative: running }
    })

    const totalForecast = months.reduce((s, m) => s + monthTotals[m].forecast, 0)
    const totalActual = months.reduce((s, m) => s + monthTotals[m].actual, 0)
    const monthsWithActual = months.filter(m => monthTotals[m].hasActual)
    const avgMonthly = monthsWithActual.length > 0 ? Math.round(totalActual / monthsWithActual.length) : 0
    const bestMonthKey = monthsWithActual.reduce((best, m) => !best || monthTotals[m].actual > monthTotals[best].actual ? m : best, '')
    const bestMonth = bestMonthKey ? `${fmtMonth(bestMonthKey)}: ${fmtFull(monthTotals[bestMonthKey].actual)}` : '—'

    const svgW = 900, svgH = 260, padL = 72, padR = 24, padT = 20, padB = 48
    const chartW = svgW - padL - padR, chartH = svgH - padT - padB
    const allValues = months.flatMap(m => [monthTotals[m].forecast, monthTotals[m].actual])
    const maxVal = roundUpNice(Math.max(...allValues, 1))
    const n = months.length
    const xOf = (i: number) => padL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW)
    const yOf = (v: number) => padT + chartH - (v / maxVal) * chartH
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => ({ val: p * maxVal, y: padT + chartH - p * chartH }))
    const fcPath = months.length > 0 ? `M ${months.map((m, i) => `${xOf(i)},${yOf(monthTotals[m].forecast)}`).join(' L ')}` : ''

    const actualSegments: string[] = []
    let inSeg = false, segPath = ''
    months.forEach((m, i) => {
      if (monthTotals[m].hasActual) {
        const pt = `${xOf(i)},${yOf(monthTotals[m].actual)}`
        if (!inSeg) { segPath = `M ${pt}`; inSeg = true } else { segPath += ` L ${pt}` }
      } else { if (inSeg && segPath) { actualSegments.push(segPath); segPath = ''; inSeg = false } }
    })
    if (inSeg && segPath) actualSegments.push(segPath)

    return (
      <div>
        {tabBar}
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
          Monthly Cash Flow
        </h1>
        <p style={{ color: 'var(--ink-soft)', margin: '0 0 32px' }}>Month-by-month Vérité Revenue — forecast vs. actual received</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Forecast', value: fmt(totalForecast), sub: `${months.length} months`, color: 'var(--navy)' },
            { label: 'Total Received', value: fmt(totalActual), sub: `${monthsWithActual.length} months with actuals`, color: 'var(--success)' },
            { label: 'Best Month', value: bestMonth.includes(':') ? bestMonth.split(':')[0] : bestMonth, sub: bestMonth.includes(':') ? bestMonth.split(':')[1]?.trim() : '', color: 'var(--navy)' },
            { label: 'Avg Monthly Received', value: fmt(avgMonthly), sub: 'per month with actuals', color: 'var(--ink-soft)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 600, marginTop: 8, color: s.color, lineHeight: 1 }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {months.length > 1 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '20px 24px', marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="28" height="4" style={{ display: 'block' }}><rect width="28" height="4" rx="2" fill="#e3bca6" /></svg>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Forecast</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="28" height="4" style={{ display: 'block' }}><rect width="28" height="4" rx="2" fill="var(--navy)" /></svg>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Actual Received</span>
              </div>
            </div>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {yTicks.map(({ val, y }) => (
                <g key={val}>
                  <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#ead9cd" strokeWidth="0.8" />
                  <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#9a9aa5">{fmt(val)}</text>
                </g>
              ))}
              {months.map((m, i) => i % 2 === 0 ? (
                <text key={m} x={xOf(i)} y={svgH - 6} textAnchor="middle" fontSize="10" fill="#9a9aa5"
                  transform={`rotate(-30, ${xOf(i)}, ${svgH - 6})`}>
                  {fmtMonthShort(m)}
                </text>
              ) : null)}
              {fcPath && <path d={fcPath} fill="none" stroke="#e3bca6" strokeWidth="2" strokeLinejoin="round" />}
              {months.map((m, i) => <circle key={m} cx={xOf(i)} cy={yOf(monthTotals[m].forecast)} r="3" fill="#e3bca6" />)}
              {actualSegments.map((seg, si) => <path key={si} d={seg} fill="none" stroke="var(--navy)" strokeWidth="2.5" strokeLinejoin="round" />)}
              {months.filter(m => monthTotals[m].hasActual).map(m => {
                const i = months.indexOf(m)
                return <circle key={m} cx={xOf(i)} cy={yOf(monthTotals[m].actual)} r="4" fill="var(--success)" stroke="#fff" strokeWidth="1.5" />
              })}
            </svg>
          </div>
        )}

        {months.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
            No revenue data yet.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: Math.max(900, 130 + engagements.length * 120 + 300) }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--line-soft)', zIndex: 2, minWidth: 120 }}>Month</th>
                    {engagements.map(e => (
                      <th key={e.id} style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, minWidth: 110 }}>
                        {e.shortName}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, minWidth: 95 }}>Total Fc</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, minWidth: 95 }}>Actual</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, minWidth: 90 }}>Variance</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, minWidth: 105 }}>Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => {
                    const tot = monthTotals[m]
                    const isCurrent = m === currentMonth
                    const isFuture = m > currentMonth
                    const rowBg = isCurrent ? '#fffaf3' : ''
                    return (
                      <tr key={m} style={{ borderBottom: '1px solid var(--line-soft)', background: rowBg, opacity: isFuture ? 0.75 : 1 }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--navy)', position: 'sticky', left: 0, background: rowBg || 'var(--surface)', zIndex: 1, whiteSpace: 'nowrap' }}>
                          {fmtMonth(m)}
                          {isCurrent && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--warn-soft)', color: 'var(--warn)', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>NOW</span>}
                        </td>
                        {engagements.map(e => {
                          const cell = matrix[m][e.id]
                          const hasFc = cell?.forecast > 0
                          const hasAct = cell?.actual != null
                          return (
                            <td key={e.id} style={{ padding: '8px 12px', textAlign: 'right', verticalAlign: 'top' }}>
                              {hasFc ? (
                                <div>
                                  <div style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{fmtFull(cell.forecast)}</div>
                                  {hasAct && <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: 12, marginTop: 1 }}>{fmtFull(cell.actual!)}</div>}
                                </div>
                              ) : <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>}
                            </td>
                          )
                        })}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: 'var(--ink-soft)' }}>{fmt(tot.forecast)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: tot.hasActual ? 'var(--success)' : 'var(--ink-faint)' }}>
                          {tot.hasActual ? fmt(tot.actual) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: tot.hasActual ? (tot.variance >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--ink-faint)' }}>
                          {tot.hasActual ? ((tot.variance >= 0 ? '+' : '') + fmt(tot.variance)) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>
                          {tot.hasActual ? fmt(tot.cumulative) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--navy)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#fff', position: 'sticky', left: 0, background: 'var(--navy)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total</td>
                    {engagements.map(e => {
                      const fc = months.reduce((s, m) => s + (matrix[m][e.id]?.forecast ?? 0), 0)
                      const act = months.reduce((s, m) => s + (matrix[m][e.id]?.actual ?? 0), 0)
                      return (
                        <td key={e.id} style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{fmtFull(fc)}</div>
                          {act > 0 && <div style={{ color: '#7dd9a3', fontWeight: 600, fontSize: 12 }}>{fmtFull(act)}</div>}
                        </td>
                      )
                    })}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#fff' }}>{fmt(totalForecast)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#7dd9a3' }}>{fmt(totalActual)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: (totalActual - totalForecast) >= 0 ? '#7dd9a3' : '#f5a0a0' }}>
                      {(totalActual >= totalForecast ? '+' : '') + fmt(totalActual - totalForecast)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#7dd9a3' }}>{fmt(totalActual)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB: FORECAST
  // ═══════════════════════════════════════════════════════════════
  const [{ data: engagements }, { data: revenueItems }] = await Promise.all([
    supabase
      .from('engagements')
      .select('id, name, stage, contract_value, probability, company:companies(id, name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('revenue_items')
      .select('*')
      .order('month', { ascending: true }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engs: any[] = engagements ?? []
  const revItems: RevenueItem[] = revenueItems ?? []

  const contracted = engs
    .filter(e => e.stage === 'active')
    .reduce((s: number, e: any) => s + (e.contract_value ?? 0), 0)

  const weightedPipeline = engs
    .filter(e => e.stage !== 'closed')
    .reduce((s: number, e: any) => s + (e.contract_value ?? 0) * ((e.probability ?? STAGE_PROBABILITY[e.stage as EngagementStage] ?? 0) / 100), 0)

  const actualReceived = revItems.reduce((s, r) => s + (r.actual_amount ?? 0), 0)

  const closedWon = engs.filter(e => e.stage === 'closed' && (e.contract_value ?? 0) > 0).length
  const closedTotal = engs.filter(e => e.stage === 'closed').length
  const closeRate = closedTotal > 0 ? Math.round((closedWon / closedTotal) * 100) : null

  const stages: EngagementStage[] = ['lead', 'opportunity', 'active', 'paused', 'closed']
  const stageBreakdown = stages.map(stage => {
    const stageEngs = engs.filter(e => e.stage === stage)
    const totalValue = stageEngs.reduce((s: number, e: any) => s + (e.contract_value ?? 0), 0)
    const weightedValue = stageEngs.reduce((s: number, e: any) => s + (e.contract_value ?? 0) * ((e.probability ?? STAGE_PROBABILITY[stage]) / 100), 0)
    return { stage, count: stageEngs.length, totalValue, probability: STAGE_PROBABILITY[stage], weightedValue }
  })

  const barMax = Math.max(actualReceived + contracted + weightedPipeline, 1)

  const monthMap: Record<string, { forecast: number; actual: number }> = {}
  for (const item of revItems) {
    const key = item.month ?? 'Unscheduled'
    if (!monthMap[key]) monthMap[key] = { forecast: 0, actual: 0 }
    monthMap[key].forecast += item.forecast_amount ?? 0
    monthMap[key].actual += item.actual_amount ?? 0
  }
  const forecastMonths = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b))

  function fmtForecastMonth(key: string): string {
    if (key === 'Unscheduled') return 'Unscheduled'
    try {
      const d = new Date(key + '-01')
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    } catch { return key }
  }

  const stageColors: Record<EngagementStage, string> = {
    lead: 'var(--blush)', opportunity: 'var(--warn)', active: 'var(--success)', paused: 'var(--ink-faint)', closed: 'var(--ink-soft)',
  }

  const metricCardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '20px 24px', flex: 1, minWidth: 160,
  }

  const sectionHeadStyle: React.CSSProperties = {
    fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 14, marginTop: 0,
  }

  return (
    <div>
      {tabBar}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
          Forecast
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 15, fontFamily: 'var(--sans)', marginTop: 6, marginBottom: 0 }}>
          Revenue pipeline and forecast overview
        </p>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
        {[
          { label: 'Weighted Pipeline', value: fmtMoney(weightedPipeline), sub: `across ${engs.filter(e => e.stage !== 'closed').length} engagements`, accent: 'var(--wine)' },
          { label: 'Contracted', value: fmtMoney(contracted), sub: 'confirmed — active engagements', accent: 'var(--success)' },
          { label: 'Actual Received', value: fmtMoney(actualReceived), sub: 'revenue actuals to date', accent: 'var(--navy)' },
          { label: 'Close Rate', value: closeRate !== null ? `${closeRate}%` : '—', sub: closedTotal > 0 ? `${closedWon} of ${closedTotal} closed` : 'no closed data', accent: 'var(--indigo)' },
        ].map(m => (
          <div key={m.label} style={metricCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontFamily: 'var(--sans)', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 600, color: m.accent, lineHeight: 1, marginBottom: 6 }}>{m.value}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--sans)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '24px 28px', marginBottom: 28 }}>
        <p style={sectionHeadStyle}>Weighted Forecast Bar</p>
        <div style={{ height: 40, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 12, background: 'var(--line-soft)' }}>
          {actualReceived > 0 && (
            <div style={{ width: `${(actualReceived / barMax) * 100}%`, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)', minWidth: 40 }}>
              {fmtMoney(actualReceived)}
            </div>
          )}
          {contracted > 0 && (
            <div style={{ width: `${(contracted / barMax) * 100}%`, background: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)', minWidth: 40 }}>
              {fmtMoney(contracted)}
            </div>
          )}
          {weightedPipeline > 0 && (
            <div style={{ width: `${Math.min((weightedPipeline / barMax) * 100, 100 - ((actualReceived + contracted) / barMax) * 100)}%`, background: 'var(--blush)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wine)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)', minWidth: 40 }}>
              {fmtMoney(weightedPipeline)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { color: 'var(--navy)', label: 'Actual Received', value: fmtMoney(actualReceived) },
            { color: 'var(--wine)', label: 'Contracted (Active)', value: fmtMoney(contracted) },
            { color: 'var(--blush)', label: 'Weighted Pipeline', value: fmtMoney(weightedPipeline) },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--ink-soft)' }}>
                {item.label}: <strong style={{ color: 'var(--ink)' }}>{item.value}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line-soft)' }}>
            <p style={{ ...sectionHeadStyle, marginBottom: 0 }}>Pipeline by Stage</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['Stage', 'Count', 'Total Value', 'Prob.', 'Weighted'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stageBreakdown.map((row, i) => (
                <tr key={row.stage} style={{ background: i % 2 === 0 ? '#fff' : '#fdfcfb', borderBottom: '1px solid var(--line-soft)' }}>
                  <td style={{ padding: '9px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: stageColors[row.stage], flexShrink: 0 }} />
                      <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{ENGAGEMENT_STAGE_LABELS[row.stage]}</span>
                    </div>
                  </td>
                  <td style={{ padding: '9px 14px', color: 'var(--ink-soft)' }}>{row.count}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--ink)' }}>{row.totalValue > 0 ? fmtMoneyFull(row.totalValue) : '—'}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--ink-soft)' }}>{row.probability}%</td>
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--wine)' }}>{row.weightedValue > 0 ? fmtMoneyFull(row.weightedValue) : '—'}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--line-soft)', fontWeight: 700 }}>
                <td style={{ padding: '9px 14px', color: 'var(--ink)', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '9px 14px', color: 'var(--ink)' }}>{engs.length}</td>
                <td style={{ padding: '9px 14px', color: 'var(--ink)' }}>{fmtMoneyFull(stageBreakdown.reduce((s, r) => s + r.totalValue, 0))}</td>
                <td style={{ padding: '9px 14px' }} />
                <td style={{ padding: '9px 14px', color: 'var(--wine)' }}>{fmtMoneyFull(stageBreakdown.reduce((s, r) => s + r.weightedValue, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--line-soft)', border: '1px solid var(--line)', borderRadius: 10, padding: '18px 20px' }}>
            <p style={sectionHeadStyle}>Default Probability by Stage</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {stages.map(stage => (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 12px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: stageColors[stage] }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--ink)', fontWeight: 500 }}>{ENGAGEMENT_STAGE_LABELS[stage]}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--wine)', fontWeight: 700 }}>{STAGE_PROBABILITY[stage]}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {forecastMonths.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line-soft)' }}>
            <p style={{ ...sectionHeadStyle, marginBottom: 0 }}>Monthly Revenue Forecast</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['Month', 'Forecast', 'Actual', 'Variance'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecastMonths.map(([key, vals], i) => {
                const variance = vals.actual - vals.forecast
                return (
                  <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#fdfcfb', borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--ink)' }}>{fmtForecastMonth(key)}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--ink-soft)' }}>{fmtMoneyFull(vals.forecast)}</td>
                    <td style={{ padding: '10px 16px', color: vals.actual > 0 ? 'var(--success)' : 'var(--ink-faint)', fontWeight: vals.actual > 0 ? 600 : 400 }}>
                      {vals.actual > 0 ? fmtMoneyFull(vals.actual) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: variance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {vals.actual > 0 ? `${variance >= 0 ? '+' : ''}${fmtMoneyFull(variance)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
