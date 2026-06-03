export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Engagement, RevenueItem, EngagementStage, ENGAGEMENT_STAGE_LABELS } from '@/lib/types'

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${Math.round(v).toLocaleString()}`
}

function fmtMoneyFull(v: number): string {
  return `$${Math.round(v).toLocaleString()}`
}

const STAGE_PROBABILITY: Record<EngagementStage, number> = {
  prospect: 5, engaged: 15, qualified: 35, proposal_sent: 60, lead: 10, opportunity: 30, active: 80, paused: 40, closed: 0,
}

export default async function ForecastPage() {
  const supabase = await createClient()

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

  // Hero metrics
  const contracted = engs
    .filter(e => e.stage === 'active')
    .reduce((s, e) => s + (e.contract_value ?? 0), 0)

  const weightedPipeline = engs
    .filter(e => e.stage !== 'closed')
    .reduce((s, e) => s + (e.contract_value ?? 0) * ((e.probability ?? STAGE_PROBABILITY[e.stage as EngagementStage] ?? 0) / 100), 0)

  const actualReceived = revItems.reduce((s, r) => s + (r.actual_amount ?? 0), 0)

  const closedWon = engs.filter(e => e.stage === 'closed' && (e.contract_value ?? 0) > 0).length
  const closedTotal = engs.filter(e => e.stage === 'closed').length
  const closeRate = closedTotal > 0 ? Math.round((closedWon / closedTotal) * 100) : null

  // By stage breakdown
  const stages: EngagementStage[] = ['lead', 'opportunity', 'active', 'paused', 'closed']
  const stageBreakdown = stages.map(stage => {
    const stageEngs = engs.filter(e => e.stage === stage)
    const totalValue = stageEngs.reduce((s, e) => s + (e.contract_value ?? 0), 0)
    const weightedValue = stageEngs.reduce((s, e) => s + (e.contract_value ?? 0) * ((e.probability ?? STAGE_PROBABILITY[stage]) / 100), 0)
    return {
      stage,
      count: stageEngs.length,
      totalValue,
      probability: STAGE_PROBABILITY[stage],
      weightedValue,
    }
  })

  // Bar chart segments
  const barMax = Math.max(actualReceived + contracted + weightedPipeline, 1)

  // Monthly revenue grouping
  const monthMap: Record<string, { forecast: number; actual: number }> = {}
  for (const item of revItems) {
    const key = item.month ?? 'Unscheduled'
    if (!monthMap[key]) monthMap[key] = { forecast: 0, actual: 0 }
    monthMap[key].forecast += item.forecast_amount ?? 0
    monthMap[key].actual += item.actual_amount ?? 0
  }
  const months = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b))

  function fmtMonth(key: string): string {
    if (key === 'Unscheduled') return 'Unscheduled'
    try {
      const d = new Date(key + '-01')
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    } catch { return key }
  }

  const stageColors: Record<EngagementStage, string> = {
    prospect: 'var(--indigo)',
    engaged: 'var(--blush)',
    qualified: 'var(--warn)',
    proposal_sent: 'var(--mauve)',
    lead: 'var(--blush)',
    opportunity: 'var(--warn)',
    active: 'var(--success)',
    paused: 'var(--ink-faint)',
    closed: 'var(--ink-soft)',
  }

  const metricCardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--line)',
    borderRadius: 10,
    padding: '20px 24px',
    flex: 1,
    minWidth: 160,
  }

  const sectionHeadStyle: React.CSSProperties = {
    fontFamily: 'var(--sans)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--ink-soft)',
    marginBottom: 14,
    marginTop: 0,
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 0' }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
          Forecast
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 15, fontFamily: 'var(--sans)', marginTop: 6, marginBottom: 0 }}>
          Revenue pipeline and forecast overview
        </p>
      </div>

      {/* Hero metrics */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
        {[
          {
            label: 'Weighted Pipeline',
            value: fmtMoney(weightedPipeline),
            sub: `across ${engs.filter(e => e.stage !== 'closed').length} engagements`,
            accent: 'var(--wine)',
          },
          {
            label: 'Contracted',
            value: fmtMoney(contracted),
            sub: 'confirmed — active engagements',
            accent: 'var(--success)',
          },
          {
            label: 'Actual Received',
            value: fmtMoney(actualReceived),
            sub: 'revenue actuals to date',
            accent: 'var(--navy)',
          },
          {
            label: 'Close Rate',
            value: closeRate !== null ? `${closeRate}%` : '—',
            sub: closedTotal > 0 ? `${closedWon} of ${closedTotal} closed` : 'no closed data',
            accent: 'var(--indigo)',
          },
        ].map(m => (
          <div key={m.label} style={metricCardStyle}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontFamily: 'var(--sans)', marginBottom: 8 }}>
              {m.label}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 600, color: m.accent, lineHeight: 1, marginBottom: 6 }}>
              {m.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--sans)' }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Forecast bar */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '24px 28px', marginBottom: 28 }}>
        <p style={sectionHeadStyle}>Weighted Forecast Bar</p>
        <div style={{ height: 40, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 12, background: 'var(--line-soft)' }}>
          {actualReceived > 0 && (
            <div style={{
              width: `${(actualReceived / barMax) * 100}%`,
              background: 'var(--navy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)',
              minWidth: 40,
            }}>
              {fmtMoney(actualReceived)}
            </div>
          )}
          {contracted > 0 && (
            <div style={{
              width: `${(contracted / barMax) * 100}%`,
              background: 'var(--wine)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)',
              minWidth: 40,
            }}>
              {fmtMoney(contracted)}
            </div>
          )}
          {weightedPipeline > 0 && (
            <div style={{
              width: `${Math.min((weightedPipeline / barMax) * 100, 100 - ((actualReceived + contracted) / barMax) * 100)}%`,
              background: 'var(--blush)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--wine)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)',
              minWidth: 40,
            }}>
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
        {/* Pipeline by stage table */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line-soft)' }}>
            <p style={{ ...sectionHeadStyle, marginBottom: 0 }}>Pipeline by Stage</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['Stage', 'Count', 'Total Value', 'Prob.', 'Weighted'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
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
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--wine)' }}>
                    {row.weightedValue > 0 ? fmtMoneyFull(row.weightedValue) : '—'}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--line-soft)', fontWeight: 700 }}>
                <td style={{ padding: '9px 14px', color: 'var(--ink)', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '9px 14px', color: 'var(--ink)' }}>{engs.length}</td>
                <td style={{ padding: '9px 14px', color: 'var(--ink)' }}>
                  {fmtMoneyFull(stageBreakdown.reduce((s, r) => s + r.totalValue, 0))}
                </td>
                <td style={{ padding: '9px 14px' }} />
                <td style={{ padding: '9px 14px', color: 'var(--wine)' }}>
                  {fmtMoneyFull(stageBreakdown.reduce((s, r) => s + r.weightedValue, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Stage probability guide + monthly forecast */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--line-soft)', border: '1px solid var(--line)', borderRadius: 10, padding: '18px 20px' }}>
            <p style={sectionHeadStyle}>Default Probability by Stage</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {stages.map(stage => (
                <div key={stage} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: '#fff', border: '1px solid var(--line)',
                  borderRadius: 6, padding: '6px 12px',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: stageColors[stage] }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--ink)', fontWeight: 500 }}>
                    {ENGAGEMENT_STAGE_LABELS[stage]}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--wine)', fontWeight: 700 }}>
                    {STAGE_PROBABILITY[stage]}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly revenue forecast table */}
      {months.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line-soft)' }}>
            <p style={{ ...sectionHeadStyle, marginBottom: 0 }}>Monthly Revenue Forecast</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['Month', 'Forecast', 'Actual', 'Variance'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map(([key, vals], i) => {
                const variance = vals.actual - vals.forecast
                return (
                  <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#fdfcfb', borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--ink)' }}>{fmtMonth(key)}</td>
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
