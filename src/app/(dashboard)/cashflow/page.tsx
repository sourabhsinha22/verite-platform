export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtFull(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMonth(m: string) {
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

export default async function CashFlowPage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('revenue_items')
    .select('*, engagement:engagements(id, name, company:companies(id, name))')
    .order('month', { ascending: true })

  const rows = items ?? []
  const currentMonth = new Date().toISOString().slice(0, 7)

  // Build month list
  const monthSet = new Set<string>()
  rows.forEach(r => { if (r.month) monthSet.add(r.month) })
  const months = Array.from(monthSet).sort()

  // Build engagement list
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

  // Matrix: month → engId → { forecast, actual }
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

  // Per-month totals
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

  // SVG chart
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
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
        Monthly Cash Flow
      </h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 32px' }}>
        Month-by-month Vérité Revenue — forecast vs. actual received
      </p>

      {/* Stats */}
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

      {/* Line chart */}
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

      {/* Table */}
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
