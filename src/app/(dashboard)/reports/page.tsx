export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Engagement, Task, ActivityEntryType, ENGAGEMENT_TYPE_LABELS, ENGAGEMENT_STAGE_LABELS } from '@/lib/types'
import PrintButton from '@/components/reports/PrintButton'
import ReportFilters from '@/components/reports/ReportFilters'
import PreparedFor from '@/components/reports/PreparedFor'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso)
  return `${MO[d.getMonth()]} ${d.getDate()}`
}

function relativeDate(iso: string, now: number): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((now - then) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return fmtDate(iso)
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n.toLocaleString()}`
}

function fmtGeneratedDate(now: Date): string {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return `${weekdays[now.getDay()]}, ${MO[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEALTH_COLORS: Record<string, string> = {
  red: 'var(--danger)',
  yellow: 'var(--warn)',
  green: 'var(--success)',
}
const HEALTH_BG: Record<string, string> = {
  red: 'var(--danger-soft)',
  yellow: 'var(--warn-soft)',
  green: 'var(--success-soft)',
}
const HEALTH_LABELS: Record<string, string> = {
  red: 'At Risk',
  yellow: 'Needs Attention',
  green: 'On Track',
}

const HEALTH_SORT: Record<string, number> = { red: 0, yellow: 1, green: 2 }
const STAGE_SORT: Record<string, number> = { active: 0, paused: 1, closed: 2, lead: 3, opportunity: 4 }

const ACTIVITY_ICONS: Record<ActivityEntryType, string> = {
  note: '📝',
  call: '📞',
  meeting: '🤝',
  email: '✉️',
  status: '🔄',
  milestone: '🎯',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EngRow = Engagement & { company?: { id: string; name: string } }

interface ActivityRow {
  engagement_id: string
  entry_type: string
  content: string
  author: string
  created_at: string
}

interface InvoiceRow {
  engagement_id: string
  amount: number
  paid_date: string | null
  due_date: string | null
  status: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; lead?: string }>
}) {
  const supabase = await createClient()
  const { filter = 'all', lead = '' } = await searchParams

  const [engagementsRes, activityRes, invoicesRes, membersRes] = await Promise.all([
    supabase
      .from('engagements')
      .select('*, company:companies(id, name), tasks(*), revenue_items(*)')
      .order('stage')
      .order('health')
      .order('name'),
    supabase
      .from('activity_log')
      .select('engagement_id, entry_type, content, author, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('invoices')
      .select('engagement_id, amount, paid_date, due_date, status')
      .is('paid_date', null),
    supabase.from('team_members').select('name').order('name'),
  ])

  const allEngagements = (engagementsRes.data ?? []) as EngRow[]
  const activityLog = (activityRes.data ?? []) as ActivityRow[]
  const unpaidInvoices = (invoicesRes.data ?? []) as InvoiceRow[]
  const teamMembers = (membersRes.data ?? []) as { name: string }[]
  const leads = teamMembers.map(m => m.name).filter(Boolean)

  // ── Filter ──────────────────────────────────────────────────────────────────
  let filtered = allEngagements.filter(e => {
    if (filter === 'active') return e.stage === 'active'
    if (filter === 'atrisk') return e.health === 'red' || e.health === 'yellow'
    if (filter === 'yellow') return e.health === 'yellow'
    return true
  })
  if (lead) filtered = filtered.filter(e => e.lead === lead)

  // ── Sort: red → yellow → green, then active → paused/closed ─────────────────
  filtered.sort((a, b) => {
    const hd = (HEALTH_SORT[a.health] ?? 2) - (HEALTH_SORT[b.health] ?? 2)
    if (hd !== 0) return hd
    return (STAGE_SORT[a.stage] ?? 5) - (STAGE_SORT[b.stage] ?? 5)
  })

  // ── Group activity by engagement_id (first 3 per engagement) ────────────────
  const activityByEng: Record<string, ActivityRow[]> = {}
  for (const entry of activityLog) {
    if (!activityByEng[entry.engagement_id]) activityByEng[entry.engagement_id] = []
    if (activityByEng[entry.engagement_id].length < 3) {
      activityByEng[entry.engagement_id].push(entry)
    }
  }

  // ── Map unpaid invoices by engagement_id ─────────────────────────────────────
  const invoicesByEng: Record<string, InvoiceRow[]> = {}
  let totalOutstanding = 0
  for (const inv of unpaidInvoices) {
    if (!invoicesByEng[inv.engagement_id]) invoicesByEng[inv.engagement_id] = []
    invoicesByEng[inv.engagement_id].push(inv)
    totalOutstanding += inv.amount ?? 0
  }

  // ── Portfolio-level stats ────────────────────────────────────────────────────
  const redCount = filtered.filter(e => e.health === 'red').length
  const yellowCount = filtered.filter(e => e.health === 'yellow').length
  const activeCount = filtered.filter(e => e.stage === 'active').length

  let totalForecast = 0
  let totalActual = 0
  for (const e of filtered) {
    const rev = e.revenue_items ?? []
    const fc = rev.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
    const ac = rev.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
    totalForecast += fc || (e.contract_value ?? 0)
    totalActual += ac
  }
  const collectedPct = totalForecast > 0 ? Math.round((totalActual / totalForecast) * 100) : 0

  // ── Blocked tasks across all filtered engagements ────────────────────────────
  const allBlockedTasks: { title: string; owner: string; engName: string }[] = []
  for (const e of filtered) {
    for (const t of (e.tasks ?? []) as Task[]) {
      if (t.status === 'blocked') {
        allBlockedTasks.push({ title: t.title, owner: t.owner || '—', engName: e.name })
      }
    }
  }

  const showSummary = redCount > 0 || yellowCount > 0 || allBlockedTasks.length > 0 || unpaidInvoices.length > 0

  const now = new Date()
  const nowMs = now.getTime()
  const generatedLabel = fmtGeneratedDate(now)
  const generatedIso = now.toISOString()

  return (
    <>
      {/* ── Print styles ────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-header { display: block !important; margin-bottom: 24px; border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; }
          aside, nav { display: none !important; }
          main { margin-left: 0 !important; padding: 24px !important; max-width: 100% !important; }
          body { background: white !important; }
          .print-break { page-break-before: always; }
          .eng-section { break-inside: avoid; }
          h1 { font-size: 28px !important; }
          .print-letterhead { font-family: Georgia, serif; font-size: 22px; font-weight: 600; color: #25314a; }
          .print-sub { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin-top: 4px; }
        }
      `}</style>

      {/* ── Print-only letterhead ────────────────────────────────────────────── */}
      <div className="print-header" style={{ display: 'none' }}>
        <div className="print-letterhead">Vérité Health Collective</div>
        <div className="print-sub">Engagement Status Report</div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
          Generated: {generatedLabel}
        </div>
      </div>

      <div style={{ maxWidth: 900 }}>

        {/* ── Screen header ──────────────────────────────────────────────────── */}
        <div className="no-print" style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600,
            color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0, marginBottom: 8,
          }}>
            Status Report
          </h1>
          <p style={{ color: 'var(--ink-soft)', margin: 0, fontSize: 14 }}>
            Generated {generatedLabel} · {filtered.length} engagement{filtered.length !== 1 ? 's' : ''} shown
          </p>
        </div>

        {/* ── Filter bar + Print button + PreparedFor ─────────────────────────── */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexWrap: 'wrap', gap: 16, marginBottom: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ReportFilters
              currentFilter={filter}
              currentLead={lead}
              leads={leads}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <PreparedFor />
            <PrintButton />
          </div>
        </div>

        {/* ── Executive summary card ───────────────────────────────────────────── */}
        {showSummary && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: 24,
            marginBottom: 32,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 16,
            }}>
              Portfolio Overview
            </div>

            {/* Health + revenue summary */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: allBlockedTasks.length > 0 || unpaidInvoices.length > 0 ? 20 : 0 }}>
              {redCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)' }} />
                  {redCount} At Risk
                </span>
              )}
              {yellowCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--warn)' }} />
                  {yellowCount} Needs Attention
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                {activeCount} Active
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                {fmtCurrency(totalForecast)} forecast · {fmtCurrency(totalActual)} received · {collectedPct}% collected
              </span>
            </div>

            {/* Blocked items */}
            {allBlockedTasks.length > 0 && (
              <div style={{ marginBottom: unpaidInvoices.length > 0 ? 16 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: 8 }}>
                  ⚠ Blocked Items
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {allBlockedTasks.map((t, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--ink)' }}>
                      <span style={{ color: 'var(--danger)', marginRight: 6 }}>●</span>
                      <strong>{t.title}</strong>
                      <span style={{ color: 'var(--ink-soft)' }}> — {t.engName} — {t.owner}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Outstanding invoices */}
            {unpaidInvoices.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>
                  💳 Outstanding Invoices
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  {fmtCurrency(totalOutstanding)} across {unpaidInvoices.length} open invoice{unpaidInvoices.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Per-engagement sections ──────────────────────────────────────────── */}
        {filtered.map((eng, idx) => {
          const tasks = (eng.tasks ?? []) as Task[]
          const rev = eng.revenue_items ?? []
          const activity = activityByEng[eng.id] ?? []

          const doneTasks = tasks.filter(t => t.status === 'done').length
          const totalTasks = tasks.length
          const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

          const forecastTotal = rev.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
          const actualTotal = rev.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
          const displayForecast = forecastTotal > 0 ? forecastTotal : (eng.contract_value ?? 0)
          const margin = displayForecast > 0 ? Math.round(((displayForecast - actualTotal) / displayForecast) * 100) : 0

          const blockedTasks = tasks.filter(t => t.status === 'blocked')
          const inProgressTasks = tasks.filter(t => t.status === 'in-progress')
          const doneSorted = tasks.filter(t => t.status === 'done')
          const notStartedCount = tasks.filter(t => t.status === 'not-started').length
          const visibleTasks = [...blockedTasks, ...inProgressTasks, ...doneSorted]

          const healthColor = HEALTH_COLORS[eng.health] ?? 'var(--success)'
          const healthLabel = HEALTH_LABELS[eng.health] ?? 'On Track'

          return (
            <div
              key={eng.id}
              className={`eng-section${idx > 0 ? ' print-break' : ''}`}
              style={{
                marginBottom: 28,
                borderRadius: 8,
                border: '1px solid var(--line)',
                borderLeft: `6px solid ${healthColor}`,
                overflow: 'hidden',
                contentVisibility: 'auto',
                containIntrinsicSize: '0 400px',
              } as React.CSSProperties}
            >
              {/* Header */}
              <div style={{
                background: 'var(--line-soft)',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 12,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10,
                      borderRadius: '50%', background: healthColor, flexShrink: 0,
                    }} />
                    <h2 style={{
                      fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600,
                      color: 'var(--navy)', margin: 0,
                    }}>
                      {eng.name}
                    </h2>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                      background: HEALTH_BG[eng.health] ?? 'var(--success-soft)',
                      color: healthColor,
                      letterSpacing: '0.06em',
                    }}>
                      {healthLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {eng.company?.name && <span>{eng.company.name}</span>}
                    <span>Lead: {eng.lead || '—'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    color: 'var(--ink-soft)', letterSpacing: '0.06em',
                  }}>
                    {ENGAGEMENT_TYPE_LABELS[eng.engagement_type] ?? eng.engagement_type}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    color: 'var(--ink-soft)', letterSpacing: '0.06em',
                  }}>
                    {ENGAGEMENT_STAGE_LABELS[eng.stage] ?? eng.stage}
                  </span>
                </div>
              </div>

              {/* Stats bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                borderTop: '1px solid var(--line)',
                borderBottom: '1px solid var(--line)',
                background: 'var(--surface)',
              }}>
                {[
                  { label: 'Progress', value: `${doneTasks} / ${totalTasks} tasks` },
                  { label: 'Forecast', value: fmtCurrency(displayForecast) },
                  { label: 'Actual', value: fmtCurrency(actualTotal) },
                  { label: 'Margin', value: `${margin}%` },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding: '12px 20px',
                    borderRight: i < 3 ? '1px solid var(--line-soft)' : undefined,
                  }}>
                    <div style={{
                      fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase',
                      letterSpacing: '0.14em', fontWeight: 600, marginBottom: 4,
                    }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy)', fontFamily: 'var(--serif)' }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Activity */}
              {activity.length > 0 && (
                <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line-soft)', background: 'var(--surface)' }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--ink-faint)', marginBottom: 10,
                  }}>
                    Recent Activity
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activity.map((entry, i) => {
                      const icon = ACTIVITY_ICONS[entry.entry_type as ActivityEntryType] ?? '📝'
                      const dateLabel = relativeDate(entry.created_at, nowMs)
                      return (
                        <li key={i} style={{ fontSize: 13, color: 'var(--ink)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ flexShrink: 0 }}>{icon}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                            background: 'var(--line-soft)', color: 'var(--ink-soft)',
                            letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'center',
                          }}>
                            {entry.entry_type}
                          </span>
                          <span style={{ flex: 1 }}>{entry.content}</span>
                          <span style={{ fontSize: 12, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                            {entry.author}{entry.author ? ', ' : ''}{dateLabel}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* Tasks */}
              {(visibleTasks.length > 0 || notStartedCount > 0) && (
                <div style={{ padding: '14px 24px', borderBottom: eng.notes ? '1px solid var(--line-soft)' : undefined, background: 'var(--surface)' }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--ink-faint)', marginBottom: 10,
                  }}>
                    Tasks
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {visibleTasks.map(task => {
                      const isBlocked = task.status === 'blocked'
                      const isInProgress = task.status === 'in-progress'
                      const isDone = task.status === 'done'
                      const dotColor = isBlocked
                        ? 'var(--danger)'
                        : isInProgress
                        ? 'var(--warn)'
                        : 'var(--success)'
                      return (
                        <li key={task.id} style={{ fontSize: 13, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ color: dotColor, fontSize: 10, flexShrink: 0, lineHeight: '18px' }}>●</span>
                          <span style={{
                            color: isDone ? 'var(--ink-faint)' : 'var(--ink)',
                            textDecoration: isDone ? 'line-through' : 'none',
                            flex: 1,
                          }}>
                            {task.title}
                          </span>
                          {task.owner && (
                            <span style={{ fontSize: 12, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                              {task.owner}
                            </span>
                          )}
                        </li>
                      )
                    })}
                    {notStartedCount > 0 && (
                      <li style={{ fontSize: 12, color: 'var(--ink-faint)', paddingLeft: 18 }}>
                        + {notStartedCount} not started
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {eng.notes && (
                <div style={{ padding: '14px 24px', background: 'var(--surface)' }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--ink-faint)', marginBottom: 6,
                  }}>
                    Notes
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                    {eng.notes}
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
            padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)',
          }}>
            No engagements match the current filters.
          </div>
        )}
      </div>
    </>
  )
}
