export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import { Engagement, Task, Invoice, ActivityEntry, ActivityEntryType, EngagementStage, EngagementType, HealthStatus, ACTIVITY_TYPE_ICONS } from '@/lib/types'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toLocaleString()
}

function isOverdue(task: Task) {
  if (task.status === 'done') return false
  if (!task.due_date) return false
  return new Date(task.due_date) < new Date()
}

function calcProgress(tasks: Task[]) {
  if (tasks.length === 0) return 0
  return Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100)
}

function relativeTime(isoStr: string): string {
  const now = new Date()
  const then = new Date(isoStr)
  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)

  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`

  // Check if yesterday
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thenStart = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const dayDiff = Math.floor((todayStart.getTime() - thenStart.getTime()) / 86400000)
  if (dayDiff === 1) return 'Yesterday'

  return `${MO[then.getMonth()]} ${then.getDate()}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function truncate(str: string, len: number): string {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayPlus7 = new Date(today)
  todayPlus7.setDate(today.getDate() + 7)
  const todayMinus30 = new Date(today)
  todayMinus30.setDate(today.getDate() - 30)

  const [
    { data: engagements },
    { data: tasks },
    { data: revenue },
    { data: invoicesRaw },
    { data: activityRaw },
  ] = await Promise.all([
    supabase.from('engagements').select('*, company:companies(name, tag)').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*'),
    supabase.from('revenue_items').select('forecast_amount, actual_amount'),
    supabase.from('invoices').select('id, engagement_id, amount, status, due_date, company_id'),
    supabase.from('activity_log').select('id, engagement_id, author, entry_type, content, created_at').order('created_at', { ascending: false }).limit(15),
  ])

  const engs = (engagements || []) as (Engagement & { company: { name: string; tag: string } })[]
  const allTasks = (tasks || []) as Task[]
  const revItems = revenue || []
  const invoices = (invoicesRaw || []) as Pick<Invoice, 'id' | 'engagement_id' | 'amount' | 'status' | 'due_date' | 'company_id'>[]
  const activityLog = (activityRaw || []) as Pick<ActivityEntry, 'id' | 'engagement_id' | 'author' | 'entry_type' | 'content' | 'created_at'>[]

  // Build engagement name map for activity feed
  const engNameMap: Record<string, string> = {}
  engs.forEach(e => { engNameMap[e.id] = e.name })

  const activeEngs = engs.filter(e => e.stage === 'active')
  const overdueTasks = allTasks.filter(isOverdue)
  const blockedTasks = allTasks.filter(t => t.status === 'blocked')
  const totalForecast = revItems.reduce((s, r) => s + (r.forecast_amount || 0), 0)
  const totalActual = revItems.reduce((s, r) => s + (r.actual_amount || 0), 0)

  // Build task map per engagement
  const tasksByEng: Record<string, Task[]> = {}
  allTasks.forEach(t => {
    if (!tasksByEng[t.engagement_id]) tasksByEng[t.engagement_id] = []
    tasksByEng[t.engagement_id].push(t)
  })

  // --- Needs Attention counts ---
  // Unpaid invoices >30 days overdue
  const lateInvoices = invoices.filter(inv => {
    if (inv.status === 'paid' || inv.status === 'draft') return false
    if (!inv.due_date) return false
    const dueDate = new Date(inv.due_date)
    return dueDate < todayMinus30
  })

  // Red-health engagements
  const redHealthEngs = activeEngs.filter(e => (e.health as HealthStatus) === 'red')

  // Stuck pipeline deals: not active/closed, same stage > 14 days
  // We use stage_history — if not available, fall back to created_at
  const stuckDeals = engs.filter(e => {
    if (e.stage === 'active' || e.stage === 'closed' || e.stage === 'paused') return false
    // Try stage_history to get when they entered current stage
    const stageHistory = e.stage_history as Record<string, string> | null
    if (stageHistory && stageHistory[e.stage]) {
      const enteredAt = new Date(stageHistory[e.stage])
      const daysDiff = (today.getTime() - enteredAt.getTime()) / 86400000
      return daysDiff > 14
    }
    // Fallback: use created_at
    const created = new Date(e.created_at)
    const daysDiff = (today.getTime() - created.getTime()) / 86400000
    return daysDiff > 14
  })

  // This Week: engagements with next_action_date in next 7 days
  const thisWeekActions = engs.filter(e => {
    if (!e.next_action || !e.next_action_date) return false
    const d = new Date(e.next_action_date)
    d.setHours(0, 0, 0, 0)
    return d <= todayPlus7
  }).sort((a, b) => {
    const da = new Date(a.next_action_date!).getTime()
    const db = new Date(b.next_action_date!).getTime()
    return da - db
  })

  // Attention card helper
  type AttentionCard = { count: number; label: string; href: string; alert: boolean }
  const attentionCards: AttentionCard[] = [
    { count: overdueTasks.length, label: 'Overdue Tasks', href: '/tasks', alert: overdueTasks.length > 0 },
    { count: blockedTasks.length, label: 'Blocked Tasks', href: '/tasks', alert: blockedTasks.length > 0 },
    { count: lateInvoices.length, label: 'Invoices >30d Overdue', href: '/invoices', alert: lateInvoices.length > 0 },
    { count: redHealthEngs.length, label: 'At-Risk Engagements', href: '/engagements', alert: redHealthEngs.length > 0 },
    { count: stuckDeals.length, label: 'Stuck Pipeline Deals', href: '/pipeline', alert: stuckDeals.length > 0 },
  ]

  return (
    <div style={{ fontFamily: 'var(--sans)' }}>
      <style>{`
        .hover-row:hover { background: var(--line-soft) !important; }
        .hover-row { cursor: pointer; transition: background 0.12s; }
        .attn-card-alert:hover { filter: brightness(0.96); }
        .attn-card-grey:hover { filter: brightness(0.97); }
        .week-pill:hover { filter: brightness(0.95); }
      `}</style>

      <h1 style={{ fontFamily: 'var(--serif)', fontSize: '42px', fontWeight: 600, color: 'var(--navy)', marginBottom: '6px', letterSpacing: '-0.5px' }}>
        Command Center
      </h1>
      <p style={{ color: 'var(--ink-soft)', marginBottom: '32px', fontSize: '14px' }}>
        {MO[today.getMonth()]} {today.getDate()}, {today.getFullYear()} — full overview across all client engagements
      </p>

      {/* ── Section 0: Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <StatCard label="Active Engagements" value={activeEngs.length} />
        <StatCard label="Overdue Tasks" value={overdueTasks.length} accent={overdueTasks.length > 0 ? 'rose' : undefined} />
        <StatCard label="Total Forecast" value={fmt(totalForecast)} accent="info" />
        <StatCard label="Actual Received" value={fmt(totalActual)} accent="green" />
      </div>

      {/* ── Section 1: Needs Attention Banner ── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: '18px', fontWeight: 600, color: 'var(--navy)' }}>Needs Attention</span>
          <span style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>— action required</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {attentionCards.map(card => (
            <Link
              key={card.label}
              href={card.href}
              style={{ textDecoration: 'none', flex: '1 1 160px', minWidth: '140px', maxWidth: '220px' }}
            >
              <div
                className={card.alert ? 'attn-card-alert' : 'attn-card-grey'}
                style={{
                  background: card.alert ? 'var(--danger-soft)' : 'var(--line-soft)',
                  border: `1px solid ${card.alert ? '#e8c5c5' : 'var(--line)'}`,
                  borderRadius: '10px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'filter 0.1s',
                }}
              >
                <div style={{ fontFamily: 'var(--serif)', fontSize: '36px', fontWeight: 700, color: card.alert ? 'var(--danger)' : 'var(--ink-faint)', lineHeight: 1 }}>
                  {card.count}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: card.alert ? 'var(--danger)' : 'var(--ink-faint)', marginTop: '2px' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '11px', color: card.alert ? 'var(--wine)' : 'var(--ink-faint)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {card.alert ? 'View →' : '✓ All clear'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Section 2: Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 1fr', gap: '20px', marginBottom: '28px' }}>

        {/* Left: Active Engagements table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--line-soft)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
              Active Engagements
            </h2>
            <Link href="/engagements" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--wine)', textDecoration: 'none', fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['', 'Engagement', 'Stage', 'Progress'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '10px', color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, padding: '10px 14px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeEngs.slice(0, 10).map(eng => {
                const engTasks = tasksByEng[eng.id] || []
                const progress = calcProgress(engTasks)
                const nextAction = eng.next_action ? truncate(eng.next_action, 40) : null
                return (
                  <tr key={eng.id} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '12px 8px 12px 14px', width: '16px' }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                        background: eng.health === 'red' ? 'var(--danger)' : eng.health === 'yellow' ? 'var(--warn)' : 'var(--success)',
                      }} />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Link href={`/engagements/${eng.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontWeight: 500, color: 'var(--ink)', fontSize: '13px' }}>{eng.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '1px' }}>{eng.company?.name}</div>
                        {nextAction && (
                          <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '3px', fontStyle: 'italic' }}>
                            ↳ {nextAction}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge stage={eng.stage as EngagementStage} />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '72px', height: '4px', background: 'var(--line)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--ink-soft)', minWidth: '28px' }}>{progress}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {activeEngs.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '13px' }}>
              No active engagements yet.{' '}
              <Link href="/engagements" style={{ color: 'var(--wine)', textDecoration: 'none' }}>Create one →</Link>
            </div>
          )}
        </div>

        {/* Right: Recent Activity feed */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--line-soft)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
              Recent Activity
            </h2>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {activityLog.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '13px' }}>
                No activity recorded yet.
              </div>
            )}
            {activityLog.map((entry, idx) => {
              const icon = ACTIVITY_TYPE_ICONS[entry.entry_type as ActivityEntryType] || '📝'
              const engName = engNameMap[entry.entry_type ? entry.engagement_id : ''] || engNameMap[entry.engagement_id]
              const inits = initials(entry.author || 'Unknown')
              const timeStr = relativeTime(entry.created_at)
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: idx < activityLog.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Initials circle */}
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    background: 'var(--blush)', color: 'var(--wine)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {inits}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px' }}>{icon}</span>
                      <span style={{ fontSize: '12px', color: 'var(--ink)', fontWeight: 500 }}>{entry.author}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '3px', wordBreak: 'break-word' }}>
                      {truncate(entry.content, 80)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      {engName ? (
                        <Link href={`/engagements/${entry.engagement_id}`} style={{ fontSize: '11px', color: 'var(--wine)', textDecoration: 'none', fontWeight: 500 }}>
                          {truncate(engName, 28)}
                        </Link>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>—</span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--ink-faint)', flexShrink: 0 }}>{timeStr}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Section 3: This Week strip ── */}
      {thisWeekActions.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: '18px', fontWeight: 600, color: 'var(--navy)' }}>This Week</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>— next actions due in 7 days</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {thisWeekActions.map(eng => {
              const actionDate = new Date(eng.next_action_date!)
              actionDate.setHours(0, 0, 0, 0)
              const isToday = actionDate.getTime() === today.getTime()
              const isPast = actionDate < today
              const isAlert = isToday || isPast
              const dateLabel = isToday
                ? 'Today'
                : isPast
                ? `${MO[actionDate.getMonth()]} ${actionDate.getDate()} (overdue)`
                : `${MO[actionDate.getMonth()]} ${actionDate.getDate()}`

              return (
                <Link key={eng.id} href={`/engagements/${eng.id}`} style={{ textDecoration: 'none' }}>
                  <div
                    className="week-pill"
                    style={{
                      background: isAlert ? 'var(--warn-soft)' : 'var(--line-soft)',
                      border: `1px solid ${isAlert ? '#f0d8a0' : 'var(--line)'}`,
                      borderRadius: '20px',
                      padding: '7px 14px',
                      fontSize: '12px',
                      color: isAlert ? 'var(--warn)' : 'var(--ink)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'filter 0.1s',
                      maxWidth: '320px',
                    }}
                  >
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{eng.name}:</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {truncate(eng.next_action || '', 35)}
                    </span>
                    <span style={{ flexShrink: 0, fontSize: '11px', color: isAlert ? 'var(--warn)' : 'var(--ink-faint)', marginLeft: '4px' }}>
                      {dateLabel}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
