export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function stageBadgeColor(stage: string): string {
  const map: Record<string, string> = {
    active: '#d1fae5',
    proposal_sent: '#dbeafe',
    qualified: '#ede9fe',
    engaged: '#fef3c7',
    prospect: '#f3f4f6',
  }
  return map[stage] ?? '#f3f4f6'
}

function stageBadgeText(stage: string): string {
  const map: Record<string, string> = {
    active: '#065f46',
    proposal_sent: '#1e40af',
    qualified: '#5b21b6',
    engaged: '#92400e',
    prospect: '#374151',
  }
  return map[stage] ?? '#374151'
}

function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function healthDotColor(health: string | null): string {
  if (health === 'green') return '#10b981'
  if (health === 'yellow') return '#f59e0b'
  if (health === 'red') return '#ef4444'
  return '#d1d5db'
}

function loadBarColor(label: string): string {
  if (label === 'Light') return '#10b981'
  if (label === 'Normal') return '#25314a'
  if (label === 'Heavy') return '#f59e0b'
  return '#ef4444'
}

function fmtDate(d: string): string {
  const dt = new Date(d)
  return MO[dt.getUTCMonth()] + ' ' + dt.getUTCDate()
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export default async function TeamPage() {
  const supabase = await createClient()

  const [
    { data: engagements },
    { data: tasks },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from('engagements')
      .select('id, name, stage, lead, health, company:companies(name)')
      .in('stage', ['prospect','engaged','qualified','proposal_sent','active']),
    supabase.from('tasks')
      .select('id, engagement_id, owner, status, due_date, title, priority'),
    supabase.from('team_members')
      .select('id, name, role, email, calendly_url')
      .order('name'),
  ])

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const in7 = new Date(today)
  in7.setDate(in7.getDate() + 7)
  const in7Str = in7.toISOString().slice(0, 10)

  const engList = engagements ?? []
  const taskList = tasks ?? []
  const members = teamMembers ?? []

  const activeStages = new Set(['active','proposal_sent','qualified'])
  const pipelineStages = new Set(['prospect','engaged'])

  const memberStats = members.map(m => {
    const activeEngagements = engList.filter(e => e.lead === m.name && activeStages.has(e.stage))
    const pipelineEngagements = engList.filter(e => e.lead === m.name && pipelineStages.has(e.stage))
    const memberTasks = taskList.filter(t => t.owner === m.name)
    const openTasks = memberTasks.filter(t => t.status !== 'done')
    const overdueTasks = openTasks.filter(t => t.due_date && t.due_date < todayStr)
    const dueSoonTasks = openTasks.filter(t => t.due_date && t.due_date >= todayStr && t.due_date <= in7Str)
    const blockedTasks = memberTasks.filter(t => t.status === 'blocked')

    const raw = (activeEngagements.length * 20) + (openTasks.length * 3) + (overdueTasks.length * 10) + (blockedTasks.length * 15)
    const loadScore = Math.min(100, raw)
    const loadLabel = loadScore <= 30 ? 'Light' : loadScore <= 60 ? 'Normal' : loadScore <= 80 ? 'Heavy' : 'At Capacity'

    // Priority tasks: overdue first, then blocked
    const priorityTasks = [
      ...overdueTasks.slice(0, 3),
      ...blockedTasks.filter(t => !overdueTasks.find(o => o.id === t.id)).slice(0, 3 - overdueTasks.slice(0,3).length),
    ].slice(0, 3)

    return {
      ...m,
      activeEngagements,
      pipelineEngagements,
      openTasks,
      overdueTasks,
      dueSoonTasks,
      blockedTasks,
      loadScore,
      loadLabel,
      priorityTasks,
    }
  })

  // Unassigned items
  const unassignedTasks = taskList.filter(t => !t.owner || t.owner.trim() === '')
  const unassignedEngagements = engList.filter(e => !e.lead || e.lead.trim() === '')

  return (
    <>
      <style>{`
        .team-card:hover { box-shadow: 0 4px 16px rgba(37,49,74,0.10) !important; }
        .eng-row:hover { background: #faf6f2 !important; }
        .task-row-item:hover { background: #faf6f2 !important; }
        .cap-card:hover { box-shadow: 0 2px 8px rgba(37,49,74,0.12) !important; }
        .unassigned-row:hover td { background: #fdf8f5 !important; }
      `}</style>

      <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '48px 48px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '40px', fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>
            Team Capacity
          </h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontFamily: 'var(--sans)', fontSize: '15px' }}>
            Workload across active engagements
          </p>
        </div>

        {/* Section 1: Capacity Summary Bar */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 16px' }}>
            At a Glance
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {memberStats.map(m => (
              <div key={m.id} className="cap-card" style={{
                background: 'var(--surface)',
                border: '1px solid #ede8e3',
                borderRadius: '8px',
                padding: '16px 20px',
                minWidth: '160px',
                flex: '1 1 160px',
                maxWidth: '220px',
                transition: 'box-shadow 0.15s',
              }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.name}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px' }}>{m.role}</div>
                <div style={{ height: '6px', background: '#f0ebe6', borderRadius: '99px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ height: '100%', width: `${m.loadScore}%`, background: loadBarColor(m.loadLabel), borderRadius: '99px', transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: loadBarColor(m.loadLabel) }}>
                  {m.loadLabel} <span style={{ fontWeight: 400, color: '#9ca3af' }}>· {m.loadScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Member Detail Cards */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 20px' }}>
            Member Detail
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {memberStats.map(m => (
              <div key={m.id} className="team-card" style={{
                background: 'var(--surface)',
                border: '1px solid #ede8e3',
                borderRadius: '8px',
                padding: '24px',
                transition: 'box-shadow 0.15s',
              }}>
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'var(--blush)', color: 'var(--wine)',
                    fontFamily: 'var(--serif)', fontSize: '16px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{m.name}</div>
                    <span style={{
                      display: 'inline-block', marginTop: '3px',
                      background: '#f0ebe6', color: '#5f3e3f',
                      fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
                      padding: '2px 8px', borderRadius: '99px',
                    }}>
                      {m.role}
                    </span>
                  </div>
                </div>

                {/* Load Bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ height: '8px', background: '#f0ebe6', borderRadius: '99px', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{ height: '100%', width: `${m.loadScore}%`, background: loadBarColor(m.loadLabel), borderRadius: '99px' }} />
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: loadBarColor(m.loadLabel) }}>
                    {m.loadLabel} · {m.activeEngagements.length} active engagement{m.activeEngagements.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Active', value: m.activeEngagements.length, danger: false },
                    { label: 'Open Tasks', value: m.openTasks.length, danger: false },
                    { label: 'Overdue', value: m.overdueTasks.length, danger: m.overdueTasks.length > 0 },
                    { label: 'Blocked', value: m.blockedTasks.length, danger: m.blockedTasks.length > 0 },
                  ].map(stat => (
                    <div key={stat.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: stat.danger ? '#ef4444' : 'var(--ink)', fontFamily: 'var(--serif)', lineHeight: 1 }}>
                        {stat.value}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Active Engagements */}
                {m.activeEngagements.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>Active Engagements</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {m.activeEngagements.map(eng => (
                        <div key={eng.id} className="eng-row" style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 8px', borderRadius: '5px', transition: 'background 0.12s',
                        }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthDotColor(eng.health), flexShrink: 0 }} />
                          <Link href={`/engagements/${eng.id}`} style={{
                            fontSize: '13px', fontWeight: 500, color: 'var(--wine)',
                            textDecoration: 'none', flex: 1, minWidth: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {eng.name}
                          </Link>
                          <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                            {(Array.isArray(eng.company) ? (eng.company[0] ?? null) : eng.company as { name: string } | null)?.name ?? ''}
                          </span>
                          <span style={{
                            fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '99px',
                            background: stageBadgeColor(eng.stage), color: stageBadgeText(eng.stage),
                            whiteSpace: 'nowrap',
                          }}>
                            {stageLabel(eng.stage)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority Tasks */}
                {m.priorityTasks.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>Needs Attention</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {m.priorityTasks.map(t => {
                        const isOverdue = t.due_date && t.due_date < todayStr
                        const isBlocked = t.status === 'blocked'
                        return (
                          <div key={t.id} className="task-row-item" style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '5px 8px', borderRadius: '5px', transition: 'background 0.12s',
                          }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '99px',
                              background: isBlocked ? '#fee2e2' : '#fef3c7',
                              color: isBlocked ? '#991b1b' : '#92400e',
                              flexShrink: 0,
                            }}>
                              {isBlocked ? 'Blocked' : 'Overdue'}
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.title}
                            </span>
                            {t.due_date && (
                              <span style={{ fontSize: '11px', color: isOverdue ? '#ef4444' : '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {fmtDate(t.due_date)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Unassigned Items */}
        {(unassignedTasks.length > 0 || unassignedEngagements.length > 0) && (
          <div>
            <h2 style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 16px' }}>
              Unassigned — Nothing Should Fall Through
            </h2>
            <div style={{ background: 'var(--surface)', border: '1px solid #ede8e3', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0ebe6' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>Name / Title</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedEngagements.map(e => (
                    <tr key={`eng-${e.id}`} className="unassigned-row">
                      <td style={{ padding: '10px 16px', color: '#9ca3af' }}>
                        <span style={{ background: '#ede9fe', color: '#5b21b6', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px' }}>Engagement</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Link href={`/engagements/${e.id}`} style={{ color: 'var(--wine)', textDecoration: 'none', fontWeight: 500 }}>{e.name}</Link>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: stageBadgeColor(e.stage), color: stageBadgeText(e.stage), fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px' }}>
                          {stageLabel(e.stage)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#9ca3af' }}>—</td>
                    </tr>
                  ))}
                  {unassignedTasks.map(t => (
                    <tr key={`task-${t.id}`} className="unassigned-row">
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px' }}>Task</span>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink)', fontWeight: 500 }}>{t.title}</td>
                      <td style={{ padding: '10px 16px', color: '#9ca3af' }}>{t.status}</td>
                      <td style={{ padding: '10px 16px', color: t.due_date && t.due_date < todayStr ? '#ef4444' : '#9ca3af' }}>
                        {t.due_date ? fmtDate(t.due_date) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
