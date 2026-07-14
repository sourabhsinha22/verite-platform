export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import Link from 'next/link'
import PeriodFilter from '@/components/velocity/PeriodFilter'
import { WIN_LOSS_LABELS } from '@/lib/types'

// ── Shared helpers ────────────────────────────────────────────────────────────
const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(d: string) { const dt = new Date(d); return `${MO[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}` }
function fmt(n: number) { if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M'; if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K'; return '$' + n.toLocaleString() }
function toNum(v: unknown) { return typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0 }

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wine)',
  borderBottom: '1px solid var(--line)', background: 'var(--line-soft)',
}
const SH: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--wine)',
  margin: '0 0 14px',
}

// ── Velocity types ────────────────────────────────────────────────────────────
const PIPELINE_STAGES = ['prospect', 'engaged', 'qualified', 'proposal_sent', 'active'] as const
type PipelineStage = typeof PIPELINE_STAGES[number]
const STAGE_LABELS: Record<PipelineStage, string> = {
  prospect: 'Prospect', engaged: 'Engaged', qualified: 'Qualified',
  proposal_sent: 'Proposal Sent', active: 'Active',
}
const STAGE_DOT_COLORS: Record<PipelineStage, string> = {
  prospect: '#9a9aa5', engaged: '#e3bca6', qualified: '#b8841a',
  proposal_sent: '#7c6e9e', active: '#2e7d52',
}
function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000)
}

interface RawEng {
  id: string; name: string; stage: string
  stage_history: Record<string, string> | null; created_at: string
  company: { name: string }[] | null
}

export default async function SalesIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string }>
}) {
  const { tab = 'velocity', period = 'all' } = await searchParams
  const supabase = await createClient()

  // ── Velocity data ─────────────────────────────────────────────────────────
  const { data: velData } = await supabase
    .from('engagements')
    .select('id, name, stage, stage_history, created_at, company:companies(name)')
    .order('created_at', { ascending: false })

  const now = new Date()
  let startDate: string | null = null
  if (period === '30d') { const d = new Date(now); d.setDate(d.getDate()-30); startDate = d.toISOString().slice(0,10) }
  else if (period === '90d') { const d = new Date(now); d.setDate(d.getDate()-90); startDate = d.toISOString().slice(0,10) }
  else if (period === 'ytd') { startDate = `${now.getFullYear()}-01-01` }

  const allEngs = (velData ?? []) as unknown as RawEng[]
  const velRows = startDate ? allEngs.filter(e => e.created_at.slice(0,10) >= startDate!) : allEngs
  const pipelineRows = velRows.filter(e => PIPELINE_STAGES.includes(e.stage as PipelineStage))

  const stageHealth = PIPELINE_STAGES.map(stage => {
    const deals = pipelineRows.filter(e => e.stage === stage)
    const daysList = deals.map(e => {
      const h = e.stage_history ?? {}
      return daysSince(h[stage] ?? e.created_at.slice(0,10))
    })
    const count = deals.length
    const avgDays = count > 0 ? Math.round(daysList.reduce((a,b)=>a+b,0)/count) : 0
    const maxDays = count > 0 ? Math.max(...daysList) : 0
    return { stage, count, avgDays, maxDays }
  })

  const stuckDeals = pipelineRows
    .map(e => {
      const stage = e.stage as PipelineStage
      const h = e.stage_history ?? {}
      const days = daysSince(h[stage] ?? e.created_at.slice(0,10))
      return { id: e.id, name: e.name, company: (Array.isArray(e.company) ? e.company[0] : e.company)?.name ?? '—', stage, daysInStage: days }
    })
    .filter(d => d.daysInStage > 14)
    .sort((a,b) => b.daysInStage - a.daysInStage)

  const cycleTimes: number[] = []
  for (const eng of allEngs) {
    const sh = eng.stage_history ?? {}
    if (sh.engaged && sh.active) {
      const days = Math.floor((new Date(sh.active).getTime() - new Date(sh.engaged).getTime()) / 86400000)
      if (days >= 0) cycleTimes.push(days)
    }
  }
  const avgCycle = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((a,b)=>a+b,0)/cycleTimes.length) : null

  const dealsAtStage: Record<PipelineStage, number> = { prospect:0, engaged:0, qualified:0, proposal_sent:0, active:0 }
  for (const e of velRows) {
    const h = e.stage_history ?? {}
    for (const stage of PIPELINE_STAGES) {
      if (h[stage] !== undefined || e.stage === stage) dealsAtStage[stage]++
    }
  }
  const funnelSteps = PIPELINE_STAGES.slice(0,-1).map((from, i) => {
    const to = PIPELINE_STAGES[i+1]
    const fromCount = dealsAtStage[from], toCount = dealsAtStage[to]
    return { from, to, fromCount, toCount, pct: fromCount > 0 ? Math.round(toCount/fromCount*100) : 0 }
  })

  const dealRows = pipelineRows.map(e => {
    const stage = e.stage as PipelineStage
    const h = e.stage_history ?? {}
    return {
      id: e.id, name: e.name,
      company: (Array.isArray(e.company) ? e.company[0] : e.company)?.name ?? '—',
      stage, daysInStage: daysSince(h[stage] ?? e.created_at.slice(0,10)),
      stagePath: PIPELINE_STAGES.filter(s => h[s] !== undefined || s === stage),
    }
  })

  // ── Win/Loss data ─────────────────────────────────────────────────────────
  const { data: wlData } = await supabase
    .from('engagements')
    .select('id,name,win_loss_category,win_loss_reason,competitor_name,contract_value,stage,company:companies(name),created_at')
    .not('win_loss_category', 'is', null)
    .order('created_at', { ascending: false })

  const wlRows = ((wlData ?? []) as unknown as {
    id: string; name: string; win_loss_category: string; win_loss_reason: string | null
    competitor_name: string | null; contract_value: number | null; stage: string
    company: { name: string }[] | null; created_at: string
  }[]).map(r => ({ ...r, company: Array.isArray(r.company) ? (r.company[0] ?? null) : r.company }))

  const won = wlRows.filter(r => r.win_loss_category === 'won')
  const lost = wlRows.filter(r => r.win_loss_category !== 'won')
  const wonArr = won.reduce((s,r) => s + (r.contract_value ?? 0), 0)
  const lostArr = lost.reduce((s,r) => s + (r.contract_value ?? 0), 0)
  const winRate = Math.round(won.length / Math.max(won.length + lost.length, 1) * 100)
  const avgWonDeal = won.length > 0 ? wonArr / won.length : 0

  const lossByCat = new Map<string,{count:number;arr:number}>()
  for (const r of lost) {
    const prev = lossByCat.get(r.win_loss_category) ?? {count:0,arr:0}
    lossByCat.set(r.win_loss_category, {count:prev.count+1, arr:prev.arr+(r.contract_value??0)})
  }
  const lossByCategory = [...lossByCat.entries()].map(([cat,v]) => ({cat,...v})).sort((a,b)=>b.count-a.count)
  const maxLossCount = lossByCategory.length > 0 ? Math.max(...lossByCategory.map(r=>r.count)) : 1

  const compMap = new Map<string,{count:number;arr:number}>()
  for (const r of lost) {
    const comp = r.competitor_name?.trim(); if (!comp) continue
    const prev = compMap.get(comp) ?? {count:0,arr:0}
    compMap.set(comp, {count:prev.count+1, arr:prev.arr+(r.contract_value??0)})
  }
  const competitorData = [...compMap.entries()].map(([name,v]) => ({name,...v})).sort((a,b)=>b.count-a.count)

  // ── Outcomes data ─────────────────────────────────────────────────────────
  const { data: outData } = await supabase
    .from('engagements')
    .select('id,name,stage,outcomes,company:companies(name),engagement_category,company_id')
    .eq('stage', 'active')

  type OutcomesShape = { time_saved_hours?: unknown; modules_created?: unknown; ce_certs_issued?: unknown; case_study_ready?: unknown; notes?: string }
  type EngRow = { id: string; name: string; stage: string; outcomes: OutcomesShape | null; company: {name:string}[]|{name:string}|null; engagement_category: string|null; company_id: string|null }

  const outRows = ((outData ?? []) as unknown as EngRow[])
    .map(r => ({ ...r, company: Array.isArray(r.company) ? (r.company[0] ?? null) : r.company as {name:string}|null }))
    .filter(r => r.outcomes && Object.keys(r.outcomes).length > 0)

  const totalHours = outRows.reduce((s,r) => s + toNum(r.outcomes?.time_saved_hours), 0)
  const totalModules = outRows.reduce((s,r) => s + toNum(r.outcomes?.modules_created), 0)
  const totalCerts = outRows.reduce((s,r) => s + toNum(r.outcomes?.ce_certs_issued), 0)
  const caseStudyCount = outRows.filter(r => r.outcomes?.case_study_ready === true).length

  // ── Tab nav ───────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'velocity', label: 'Velocity' },
    { id: 'win-loss', label: 'Win / Loss' },
    { id: 'outcomes', label: 'Outcomes' },
  ]

  const todayStr = now.toISOString().slice(0,10)
  const in3 = new Date(now); in3.setDate(in3.getDate()+3)
  const in3Str = in3.toISOString().slice(0,10)

  const { data: nextActionsData } = await supabase
    .from('engagements')
    .select('id,name,stage,next_action,next_action_date,company:companies(name)')
    .not('next_action', 'is', null).neq('next_action', '')
    .in('stage', ['prospect','engaged','qualified','proposal_sent'])
    .order('next_action_date', { nullsFirst: false }).limit(20)

  type NARow = { id:string; name:string; stage:string; next_action:string; next_action_date:string|null; company:{name:string}[]|null }
  const nextActions = (nextActionsData ?? []) as unknown as NARow[]

  return (
    <>
      <style>{`
        .si-row:hover { background: var(--line-soft) !important; }
        .si-tab { transition: all 0.15s; }
        .si-tab:hover { color: var(--navy) !important; }
      `}</style>

      <div style={{ padding: '32px 0' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 6px' }}>
            Sales Intelligence
          </h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 15, fontFamily: 'var(--sans)', margin: 0 }}>
            Velocity · Win / Loss · Outcomes
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--line)', marginBottom: 36 }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <Link
                key={t.id}
                href={`/sales-intelligence?tab=${t.id}`}
                className="si-tab"
                style={{
                  display: 'block',
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'var(--sans)',
                  color: active ? 'var(--wine)' : 'var(--ink-soft)',
                  textDecoration: 'none',
                  borderBottom: active ? '2px solid var(--wine)' : '2px solid transparent',
                  marginBottom: -2,
                }}
              >
                {t.label}
              </Link>
            )
          })}
        </div>

        {/* ── VELOCITY TAB ──────────────────────────────────────────────── */}
        {tab === 'velocity' && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <Suspense fallback={<div style={{ height: 34 }} />}>
                <PeriodFilter />
              </Suspense>
            </div>

            {/* Stage health */}
            <div style={{ marginBottom: 40 }}>
              <h2 style={SH}>Stage Health</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {stageHealth.map(sh => {
                  const isDanger = sh.maxDays > 30, isWarn = !isDanger && sh.maxDays > 14
                  return (
                    <div key={sh.stage} style={{ borderRadius: 8, padding: '16px 20px', border: '1px solid var(--line)', background: isDanger ? 'var(--danger-soft)' : 'var(--surface)', minWidth: 140, flex: '1 1 140px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: isDanger ? 'var(--danger)' : isWarn ? 'var(--warn)' : 'var(--ink-faint)', fontFamily: 'var(--sans)', marginBottom: 8 }}>{STAGE_LABELS[sh.stage]}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--serif)', lineHeight: 1, marginBottom: 4 }}>{sh.count}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
                        {sh.count === 0 ? 'No active deals' : <><span style={{ fontWeight: 600, color: isDanger ? 'var(--danger)' : isWarn ? 'var(--warn)' : 'var(--ink)' }}>avg {sh.avgDays}d</span> in stage</>}
                      </div>
                      {sh.maxDays > 14 && sh.count > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--sans)', color: isDanger ? 'var(--danger)' : 'var(--warn)', fontWeight: 600 }}>
                          {isDanger ? '⚠ Longest: ' : '△ Longest: '}{sh.maxDays}d
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Avg deal cycle */}
            <div style={{ marginBottom: 40 }}>
              <h2 style={SH}>Average Time to Close</h2>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '24px 28px', display: 'inline-block', minWidth: 260 }}>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--navy)', lineHeight: 1, marginBottom: 6 }}>
                  {avgCycle ?? '—'}{avgCycle != null ? ' days' : ''}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>from first reply to signed contract</div>
                {cycleTimes.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--sans)', marginTop: 4 }}>
                    based on {cycleTimes.length} closed deal{cycleTimes.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Stuck deals */}
            {stuckDeals.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h2 style={SH}>Stuck Deals</h2>
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                    <thead><tr style={{ background: 'var(--line-soft)' }}>{['Engagement','Company','Stage','Days in Stage','Alert'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>
                      {stuckDeals.map((d, i) => {
                        const isDanger = d.daysInStage > 30
                        return (
                          <tr key={d.id} className="si-row" style={{ background: isDanger ? 'var(--danger-soft)' : 'var(--warn-soft)', borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                            <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>{d.name}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{d.company}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{STAGE_LABELS[d.stage]}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: isDanger ? 'var(--danger)' : 'var(--warn)' }}>{d.daysInStage}d</td>
                            <td style={{ padding: '12px 16px', fontSize: 12 }}>
                              {isDanger ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>🔴 Critical — {d.daysInStage}d stalled</span> : <span style={{ color: 'var(--warn)', fontWeight: 600 }}>🟡 Needs attention</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Conversion funnel */}
            <div style={{ marginBottom: 40 }}>
              <h2 style={SH}>Conversion Funnel</h2>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '20px 24px' }}>
                {funnelSteps.map(step => (
                  <div key={`${step.from}-${step.to}`} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, fontFamily: 'var(--sans)' }}>
                    <div style={{ width: 240, fontSize: 12, color: 'var(--ink-soft)', flexShrink: 0 }}>{STAGE_LABELS[step.from]} → {STAGE_LABELS[step.to]}</div>
                    <div style={{ width: 200, height: 10, background: 'var(--line-soft)', borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${step.pct}%`, background: 'var(--wine)', borderRadius: 5 }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', width: 44, flexShrink: 0 }}>{step.pct}%</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>({step.toCount}/{step.fromCount})</div>
                  </div>
                ))}
                {funnelSteps.every(s => s.fromCount === 0) && <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: 0 }}>No engagement data yet.</p>}
              </div>
            </div>

            {/* All active deals */}
            <div style={{ marginBottom: 40 }}>
              <h2 style={SH}>All Active Pipeline Deals</h2>
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--line-soft)' }}>{['Engagement','Company','Current Stage','Days in Stage','Stage Path'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {dealRows.length === 0 && <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic' }}>No active pipeline deals.</td></tr>}
                    {dealRows.map((d, i) => {
                      const isDanger = d.daysInStage > 30, isWarn = !isDanger && d.daysInStage > 14
                      return (
                        <tr key={d.id} className="si-row" style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, background: '#fff' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>{d.name}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{d.company}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{STAGE_LABELS[d.stage]}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: isDanger ? 'var(--danger)' : isWarn ? 'var(--warn)' : 'var(--ink)' }}>{d.daysInStage}d</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {PIPELINE_STAGES.map((s, si) => {
                                const reached = d.stagePath.includes(s), isCurrent = s === d.stage
                                return (
                                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {si > 0 && <div style={{ width: 14, height: 1, background: reached ? 'var(--line)' : 'var(--line-soft)' }} />}
                                    <div title={STAGE_LABELS[s]} style={{ width: isCurrent ? 10 : 8, height: isCurrent ? 10 : 8, borderRadius: '50%', background: reached ? STAGE_DOT_COLORS[s] : 'var(--line)', border: isCurrent ? '2px solid var(--navy)' : 'none' }} />
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

            {/* Next actions */}
            {nextActions.length > 0 && (
              <div>
                <h2 style={SH}>Next Actions</h2>
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                    <thead><tr style={{ background: 'var(--line-soft)' }}>{['Engagement','Company','Stage','Next Action','Due Date'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>
                      {nextActions.map((row, i) => {
                        const co = Array.isArray(row.company) ? row.company[0] : row.company
                        const overdue = !!row.next_action_date && row.next_action_date < todayStr
                        const soon = !overdue && !!row.next_action_date && row.next_action_date <= in3Str
                        return (
                          <tr key={row.id} className="si-row" style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, background: overdue ? 'var(--danger-soft)' : soon ? 'var(--warn-soft)' : '#fff' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>{row.name}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{co?.name ?? '—'}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{row.stage.replace('_',' ')}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink)' }}>{row.next_action}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: overdue ? 'var(--danger)' : 'var(--ink-soft)', fontWeight: overdue ? 600 : 400 }}>
                              {row.next_action_date ? fmtDate(row.next_action_date) + (overdue ? ' — overdue' : '') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WIN/LOSS TAB ──────────────────────────────────────────────── */}
        {tab === 'win-loss' && (
          <div>
            <p style={{ color: 'var(--ink-soft)', fontSize: 15, fontFamily: 'var(--sans)', margin: '0 0 32px' }}>
              Deal outcomes and patterns · {wlRows.length} closed deals
            </p>

            {wlRows.length === 0 ? (
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '48px 32px', textAlign: 'center', color: 'var(--ink-faint)', fontFamily: 'var(--sans)', fontSize: 14 }}>
                No closed deals recorded yet.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
                  {[
                    { label: 'Won', value: `${won.length} deals`, sub: fmt(wonArr), color: 'var(--success)', bg: 'var(--success-soft)' },
                    { label: 'Lost', value: `${lost.length} deals`, sub: fmt(lostArr), color: 'var(--danger)', bg: 'var(--danger-soft)' },
                    { label: 'Win Rate', value: `${winRate}%`, sub: 'of closed deals', color: 'var(--navy)', bg: 'var(--surface)' },
                    { label: 'Avg Won Deal', value: fmt(avgWonDeal), sub: 'per won engagement', color: 'var(--wine)', bg: 'var(--surface)' },
                  ].map(card => (
                    <div key={card.label} style={{ borderRadius: 8, padding: '20px 22px', border: '1px solid var(--line)', background: card.bg }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontFamily: 'var(--sans)', marginBottom: 8 }}>{card.label}</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--serif)', color: card.color, lineHeight: 1, marginBottom: 4 }}>{card.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                {lost.length > 0 && (
                  <div style={{ marginBottom: 40 }}>
                    <h2 style={SH}>Loss Reasons</h2>
                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                        <thead><tr>{['Category','Count','% of Lost','ARR Lost',''].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                        <tbody>
                          {lossByCategory.map((row, i) => {
                            const pct = Math.round(row.count / lost.length * 100)
                            const barWidth = Math.round(row.count / maxLossCount * 180)
                            return (
                              <tr key={row.cat} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, background: '#fff' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>{WIN_LOSS_LABELS[row.cat] ?? row.cat}</td>
                                <td style={{ padding: '12px 16px', color: 'var(--ink-soft)', fontWeight: 600 }}>{row.count}</td>
                                <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{pct}%</td>
                                <td style={{ padding: '12px 16px', color: 'var(--ink)', fontWeight: 600 }}>{fmt(row.arr)}</td>
                                <td style={{ padding: '12px 16px' }}><div style={{ height: 6, width: barWidth, background: 'var(--wine)', borderRadius: 3, minWidth: 2 }} /></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {competitorData.length > 0 && (
                  <div style={{ marginBottom: 40 }}>
                    <h2 style={SH}>Competitor Analysis</h2>
                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                        <thead><tr>{['Competitor','Times Lost','ARR Lost'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                        <tbody>
                          {competitorData.map((comp, i) => (
                            <tr key={comp.name} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, background: '#fff' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>{comp.name}</td>
                              <td style={{ padding: '12px 16px', color: 'var(--ink-soft)', fontWeight: 600 }}>{comp.count}</td>
                              <td style={{ padding: '12px 16px', color: 'var(--danger)', fontWeight: 600 }}>{fmt(comp.arr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <h2 style={SH}>All Closed Deals</h2>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                      <thead><tr>{['Engagement','Company','Outcome','Reason','Competitor','Value','Date'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                      <tbody>
                        {wlRows.map((row, i) => {
                          const isWon = row.win_loss_category === 'won'
                          return (
                            <tr key={row.id} className="si-row" style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, background: '#fff' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>{row.name}</td>
                              <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{row.company?.name ?? '—'}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{ display: 'inline-block', background: isWon ? 'var(--success-soft)' : 'var(--danger-soft)', color: isWon ? 'var(--success)' : 'var(--danger)', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 4 }}>
                                  {isWon ? 'Won' : 'Lost'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', color: 'var(--ink-soft)', fontSize: 12 }}>{row.win_loss_reason ? WIN_LOSS_LABELS[row.win_loss_reason] ?? row.win_loss_reason : '—'}</td>
                              <td style={{ padding: '12px 16px', color: 'var(--ink-soft)', fontSize: 12 }}>{row.competitor_name?.trim() || '—'}</td>
                              <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink)' }}>{row.contract_value != null ? fmt(row.contract_value) : '—'}</td>
                              <td style={{ padding: '12px 16px', color: 'var(--ink-faint)', fontSize: 12 }}>{fmtDate(row.created_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── OUTCOMES TAB ──────────────────────────────────────────────── */}
        {tab === 'outcomes' && (
          <div>
            <p style={{ color: 'var(--ink-soft)', fontSize: 15, fontFamily: 'var(--sans)', margin: '0 0 32px' }}>
              Value delivered across active engagements
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
              {[
                { label: 'Total Hours Saved', value: Math.round(totalHours).toLocaleString(), sub: 'across active engagements', color: 'var(--success)', bg: 'var(--success-soft)' },
                { label: 'Total Modules Created', value: Math.round(totalModules).toLocaleString(), sub: 'across active engagements', color: 'var(--success)', bg: 'var(--success-soft)' },
                { label: 'Total CE Certs Issued', value: Math.round(totalCerts).toLocaleString(), sub: 'continuing education', color: 'var(--success)', bg: 'var(--success-soft)' },
                { label: 'Case Studies Ready', value: String(caseStudyCount), sub: 'ready to publish', color: '#2e7d52', bg: '#e8f5e9' },
              ].map(card => (
                <div key={card.label} style={{ borderRadius: 8, padding: '20px 22px', border: '1px solid var(--line)', background: card.bg }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontFamily: 'var(--sans)', marginBottom: 8 }}>{card.label}</div>
                  <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--serif)', color: card.color, lineHeight: 1, marginBottom: 4 }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>{card.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 40 }}>
              <h2 style={SH}>Per-Client Outcomes</h2>
              {outRows.length === 0 ? (
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '48px 32px', textAlign: 'center', color: 'var(--ink-faint)', fontFamily: 'var(--sans)', fontSize: 14 }}>
                  No outcomes logged yet. Add outcome data in the Outcomes section of each active engagement.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                    <thead><tr>{['Client','Engagement','Hours Saved','Modules','CE Certs','Case Study','Notes'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>
                      {outRows.map((row, i) => {
                        const o = row.outcomes!
                        const caseStudy = o.case_study_ready === true
                        return (
                          <tr key={row.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, background: '#fff' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--navy)' }}>{row.company?.name ?? '—'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <Link href={`/engagements/${row.id}`} style={{ color: 'var(--wine)', textDecoration: 'none', fontWeight: 500 }}>{row.name}</Link>
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink)', fontWeight: 600 }}>{toNum(o.time_saved_hours) > 0 ? toNum(o.time_saved_hours).toLocaleString() : '—'}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{toNum(o.modules_created) > 0 ? toNum(o.modules_created).toLocaleString() : '—'}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{toNum(o.ce_certs_issued) > 0 ? toNum(o.ce_certs_issued).toLocaleString() : '—'}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {caseStudy ? <span style={{ color: '#2e7d52', fontWeight: 700, fontSize: 15 }}>✓</span> : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--ink-soft)', fontSize: 12 }}>{o.notes ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {caseStudyCount > 0 && (
              <div>
                <h2 style={SH}>Ready for Case Study</h2>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                  {outRows.filter(r => r.outcomes?.case_study_ready === true).map(eng => {
                    const o = eng.outcomes!
                    const parts: string[] = []
                    if (toNum(o.time_saved_hours) > 0) parts.push(`${toNum(o.time_saved_hours).toLocaleString()}h saved`)
                    if (toNum(o.modules_created) > 0) parts.push(`${toNum(o.modules_created).toLocaleString()} modules`)
                    if (toNum(o.ce_certs_issued) > 0) parts.push(`${toNum(o.ce_certs_issued).toLocaleString()} certs`)
                    return (
                      <div key={eng.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '20px 22px', background: 'var(--surface)' }}>
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--sans)', marginBottom: 2, fontWeight: 500 }}>{eng.company?.name ?? '—'}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--sans)', marginBottom: 8 }}>{eng.name}</div>
                        {parts.length > 0 && <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, fontFamily: 'var(--sans)', marginBottom: 10 }}>{parts.join(' · ')}</div>}
                        {o.notes && <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', marginBottom: 14, lineHeight: 1.5 }}>{o.notes}</div>}
                        <Link href={`/reports/client?company_id=${eng.company_id ?? ''}`} style={{ display: 'inline-block', background: 'var(--navy)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'var(--sans)', padding: '8px 16px', borderRadius: 5, textDecoration: 'none' }}>
                          Generate Client Report →
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
