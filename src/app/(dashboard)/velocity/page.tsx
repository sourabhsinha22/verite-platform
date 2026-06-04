export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

const PIPELINE_STAGES = ['prospect', 'engaged', 'qualified', 'proposal_sent', 'active'] as const
type PipelineStage = typeof PIPELINE_STAGES[number]

const STAGE_LABELS: Record<PipelineStage, string> = {
  prospect: 'Prospect',
  engaged: 'Engaged',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  active: 'Active',
}

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000)
}

function fmtDate(isoStr: string): string {
  const d = new Date(isoStr)
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

interface RawEngagement {
  id: string
  name: string
  stage: string
  stage_history: Record<string, string> | null
  created_at: string
  company: { name: string } | null
}

interface StageHealth {
  stage: PipelineStage
  count: number
  avgDays: number
  maxDays: number
}

interface StuckDeal {
  id: string
  name: string
  company: string
  stage: PipelineStage
  daysInStage: number
}

interface FunnelStep {
  from: PipelineStage
  to: PipelineStage
  fromCount: number
  toCount: number
  pct: number
}

interface DealRow {
  id: string
  name: string
  company: string
  stage: PipelineStage
  daysInStage: number
  stagePath: PipelineStage[]
}

const STAGE_DOT_COLORS: Record<PipelineStage, string> = {
  prospect: '#9a9aa5',
  engaged: '#e3bca6',
  qualified: '#b8841a',
  proposal_sent: '#7c6e9e',
  active: '#2e7d52',
}

export default async function VelocityPage() {
  const supabase = await createClient()

  const { data: engagements } = await supabase
    .from('engagements')
    .select('id, name, stage, stage_history, created_at, company:companies(name)')
    .order('created_at', { ascending: false })

  const rows = (engagements ?? []) as unknown as RawEngagement[]

  // Only include pipeline-relevant stages
  const pipelineRows = rows.filter(e => PIPELINE_STAGES.includes(e.stage as PipelineStage))

  // ── Stage health ──────────────────────────────────────────────────────────
  const stageHealth: StageHealth[] = PIPELINE_STAGES.map(stage => {
    const deals = pipelineRows.filter(e => e.stage === stage)
    const daysList = deals.map(e => {
      const history = e.stage_history ?? {}
      const dateSrc = history[stage] ?? e.created_at.slice(0, 10)
      return daysSince(dateSrc)
    })
    const count = deals.length
    const avgDays = count > 0 ? Math.round(daysList.reduce((a, b) => a + b, 0) / count) : 0
    const maxDays = count > 0 ? Math.max(...daysList) : 0
    return { stage, count, avgDays, maxDays }
  })

  // ── Stuck deals ────────────────────────────────────────────────────────────
  const stuckDeals: StuckDeal[] = []
  for (const e of pipelineRows) {
    const stage = e.stage as PipelineStage
    const history = e.stage_history ?? {}
    const dateSrc = history[stage] ?? e.created_at.slice(0, 10)
    const days = daysSince(dateSrc)
    if (days > 14) {
      stuckDeals.push({
        id: e.id,
        name: e.name,
        company: e.company?.name ?? '—',
        stage,
        daysInStage: days,
      })
    }
  }
  stuckDeals.sort((a, b) => b.daysInStage - a.daysInStage)

  // ── Conversion funnel ──────────────────────────────────────────────────────
  // Count deals that ever reached a given stage
  const dealsAtStage: Record<PipelineStage, number> = {
    prospect: 0,
    engaged: 0,
    qualified: 0,
    proposal_sent: 0,
    active: 0,
  }
  for (const e of rows) {
    const history = e.stage_history ?? {}
    for (const stage of PIPELINE_STAGES) {
      if (history[stage] !== undefined || e.stage === stage) {
        dealsAtStage[stage]++
      }
    }
  }

  const funnelSteps: FunnelStep[] = []
  for (let i = 0; i < PIPELINE_STAGES.length - 1; i++) {
    const from = PIPELINE_STAGES[i]
    const to = PIPELINE_STAGES[i + 1]
    const fromCount = dealsAtStage[from]
    const toCount = dealsAtStage[to]
    const pct = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0
    funnelSteps.push({ from, to, fromCount, toCount, pct })
  }

  // ── Full deal list ─────────────────────────────────────────────────────────
  const dealRows: DealRow[] = pipelineRows.map(e => {
    const stage = e.stage as PipelineStage
    const history = e.stage_history ?? {}
    const dateSrc = history[stage] ?? e.created_at.slice(0, 10)
    const daysInStage = daysSince(dateSrc)
    const stagePath = PIPELINE_STAGES.filter(s => history[s] !== undefined || s === stage)
    return {
      id: e.id,
      name: e.name,
      company: e.company?.name ?? '—',
      stage,
      daysInStage,
      stagePath,
    }
  })

  return (
    <>
      <style>{`
        .vel-row:hover { background: var(--line-soft) !important; }
        .vel-deal-row:hover { background: var(--line-soft) !important; }
      `}</style>

      <div style={{ padding: '32px 0' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--serif)',
            fontSize: 40,
            fontWeight: 600,
            color: 'var(--navy)',
            letterSpacing: '-0.5px',
            margin: 0,
          }}>
            Deal Velocity
          </h1>
          <p style={{
            color: 'var(--ink-soft)',
            fontSize: 15,
            fontFamily: 'var(--sans)',
            marginTop: 6,
            marginBottom: 0,
          }}>
            Time in each stage · Conversion funnel
          </p>
        </div>

        {/* Section 1: Stage health cards */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{
            fontFamily: 'var(--sans)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--wine)',
            margin: '0 0 14px',
          }}>
            Stage Health
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {stageHealth.map(sh => {
              const isDanger = sh.maxDays > 30
              const isWarn = !isDanger && sh.maxDays > 14
              return (
                <div
                  key={sh.stage}
                  style={{
                    borderRadius: 8,
                    padding: '16px 20px',
                    border: '1px solid var(--line)',
                    background: isDanger ? 'var(--danger-soft)' : 'var(--surface)',
                    minWidth: 140,
                    flex: '1 1 140px',
                  }}
                >
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: isDanger ? 'var(--danger)' : isWarn ? 'var(--warn)' : 'var(--ink-faint)',
                    fontFamily: 'var(--sans)',
                    marginBottom: 8,
                  }}>
                    {STAGE_LABELS[sh.stage]}
                  </div>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--navy)',
                    fontFamily: 'var(--serif)',
                    lineHeight: 1,
                    marginBottom: 4,
                  }}>
                    {sh.count}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
                    {sh.count === 0 ? 'No active deals' : (
                      <>
                        <span style={{
                          fontWeight: 600,
                          color: isDanger ? 'var(--danger)' : isWarn ? 'var(--warn)' : 'var(--ink)',
                        }}>
                          avg {sh.avgDays}d
                        </span>
                        {' in stage'}
                      </>
                    )}
                  </div>
                  {sh.maxDays > 14 && sh.count > 0 && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 11,
                      fontFamily: 'var(--sans)',
                      color: isDanger ? 'var(--danger)' : 'var(--warn)',
                      fontWeight: 600,
                    }}>
                      {isDanger ? '⚠ Longest: ' : '△ Longest: '}{sh.maxDays}d
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 2: Stuck deals */}
        {stuckDeals.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{
              fontFamily: 'var(--sans)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--wine)',
              margin: '0 0 14px',
            }}>
              Stuck Deals
            </h2>
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)' }}>
                    {['Engagement', 'Company', 'Stage', 'Days in Stage', 'Alert'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left',
                        padding: '10px 16px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--wine)',
                        borderBottom: '1px solid var(--line)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stuckDeals.map((deal, i) => {
                    const isDanger = deal.daysInStage > 30
                    return (
                      <tr
                        key={deal.id}
                        className="vel-row"
                        style={{
                          background: isDanger ? 'var(--danger-soft)' : 'var(--warn-soft)',
                          borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined,
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>
                          {deal.name}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>
                          {deal.company}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>
                          {STAGE_LABELS[deal.stage]}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: isDanger ? 'var(--danger)' : 'var(--warn)' }}>
                          {deal.daysInStage}d
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12 }}>
                          {isDanger ? (
                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>🔴 Critical — {deal.daysInStage}d stalled</span>
                          ) : (
                            <span style={{ color: 'var(--warn)', fontWeight: 600 }}>🟡 Needs attention</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 3: Conversion funnel */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{
            fontFamily: 'var(--sans)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--wine)',
            margin: '0 0 14px',
          }}>
            Conversion Funnel
          </h2>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '20px 24px',
          }}>
            {funnelSteps.map(step => (
              <div
                key={`${step.from}-${step.to}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginBottom: 14,
                  fontFamily: 'var(--sans)',
                }}
              >
                <div style={{
                  width: 240,
                  fontSize: 12,
                  color: 'var(--ink-soft)',
                  flexShrink: 0,
                }}>
                  {STAGE_LABELS[step.from]} → {STAGE_LABELS[step.to]}
                </div>
                <div style={{
                  width: 200,
                  height: 10,
                  background: 'var(--line-soft)',
                  borderRadius: 5,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  <div style={{
                    height: '100%',
                    width: `${step.pct}%`,
                    background: 'var(--wine)',
                    borderRadius: 5,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', width: 44, flexShrink: 0 }}>
                  {step.pct}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                  ({step.toCount}/{step.fromCount})
                </div>
              </div>
            ))}
            {funnelSteps.every(s => s.fromCount === 0) && (
              <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: 0 }}>
                No engagement data yet.
              </p>
            )}
          </div>
        </div>

        {/* Section 4: Full deal list */}
        <div>
          <h2 style={{
            fontFamily: 'var(--sans)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--wine)',
            margin: '0 0 14px',
          }}>
            All Active Pipeline Deals
          </h2>
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--line-soft)' }}>
                  {['Engagement', 'Company', 'Current Stage', 'Days in Stage', 'Stage Path'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left',
                      padding: '10px 16px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--wine)',
                      borderBottom: '1px solid var(--line)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealRows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                      No active pipeline deals.
                    </td>
                  </tr>
                )}
                {dealRows.map((deal, i) => {
                  const isDanger = deal.daysInStage > 30
                  const isWarn = !isDanger && deal.daysInStage > 14
                  return (
                    <tr
                      key={deal.id}
                      className="vel-deal-row"
                      style={{
                        borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined,
                        background: '#fff',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>
                        {deal.name}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>
                        {deal.company}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>
                        {STAGE_LABELS[deal.stage]}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: isDanger ? 'var(--danger)' : isWarn ? 'var(--warn)' : 'var(--ink)' }}>
                        {deal.daysInStage}d
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {PIPELINE_STAGES.map((s, si) => {
                            const reached = deal.stagePath.includes(s)
                            const isCurrent = s === deal.stage
                            return (
                              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {si > 0 && (
                                  <div style={{
                                    width: 14,
                                    height: 1,
                                    background: reached ? 'var(--line)' : 'var(--line-soft)',
                                  }} />
                                )}
                                <div
                                  title={STAGE_LABELS[s]}
                                  style={{
                                    width: isCurrent ? 10 : 8,
                                    height: isCurrent ? 10 : 8,
                                    borderRadius: '50%',
                                    background: reached ? STAGE_DOT_COLORS[s] : 'var(--line)',
                                    border: isCurrent ? '2px solid var(--navy)' : 'none',
                                    transition: 'all 0.15s',
                                  }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
