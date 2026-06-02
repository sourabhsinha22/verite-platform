export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import { Engagement, Task, EngagementStage, EngagementType, HealthStatus } from '@/lib/types'
import { AlertCircle, Clock, ArrowRight } from 'lucide-react'

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

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: engagements }, { data: tasks }, { data: revenue }] = await Promise.all([
    supabase.from('engagements').select('*, company:companies(name, tag)').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*'),
    supabase.from('revenue_items').select('forecast_amount, actual_amount'),
  ])

  const engs = (engagements || []) as (Engagement & { company: { name: string; tag: string } })[]
  const allTasks = (tasks || []) as Task[]
  const revItems = revenue || []

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

  // Health summary counts
  const healthCounts = { green: 0, yellow: 0, red: 0 }
  for (const eng of activeEngs) {
    const h = (eng.health as HealthStatus) || 'green'
    healthCounts[h]++
  }

  return (
    <div>
      <style>{`
        .dash-row:hover { background: var(--line-soft) !important; }
        .dash-row { cursor: pointer; transition: background 0.1s; }
      `}</style>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: '42px', fontWeight: 600, color: 'var(--navy)', marginBottom: '8px', letterSpacing: '-0.5px' }}>
        Dashboard
      </h1>
      <p style={{ color: 'var(--ink-soft)', marginBottom: '36px', fontSize: '14px' }}>
        Overview across all client engagements
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Active Engagements" value={activeEngs.length} />
        <StatCard label="Overdue Tasks" value={overdueTasks.length} accent={overdueTasks.length > 0 ? 'rose' : undefined} />
        <StatCard label="Total Forecast" value={fmt(totalForecast)} accent="info" />
        <StatCard label="Actual Received" value={fmt(totalActual)} accent="green" />
      </div>

      {/* Health summary row */}
      {activeEngs.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'var(--danger-soft)', borderRadius: '8px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--danger)' }}>{healthCounts.red}</span>
            <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500 }}>At Risk</span>
          </div>
          <div style={{ background: 'var(--warn-soft)', borderRadius: '8px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--warn)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--warn)' }}>{healthCounts.yellow}</span>
            <span style={{ fontSize: '12px', color: 'var(--warn)', fontWeight: 500 }}>Needs Attention</span>
          </div>
          <div style={{ background: 'var(--success-soft)', borderRadius: '8px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)' }}>{healthCounts.green}</span>
            <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>On Track</span>
          </div>
        </div>
      )}

      {/* Alerts row */}
      {(overdueTasks.length > 0 || blockedTasks.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          {overdueTasks.length > 0 && (
            <div style={{ background: 'var(--danger-soft)', border: '1px solid #e8c5c5', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <AlertCircle size={15} color="var(--danger)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)' }}>Overdue ({overdueTasks.length})</span>
              </div>
              {overdueTasks.slice(0, 3).map(t => (
                <div key={t.id} style={{ fontSize: '12px', color: 'var(--danger)', padding: '4px 0', borderTop: '1px solid rgba(161,48,48,0.1)' }}>
                  {t.title}
                </div>
              ))}
            </div>
          )}
          {blockedTasks.length > 0 && (
            <div style={{ background: 'var(--warn-soft)', border: '1px solid #f0d8a0', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Clock size={15} color="var(--warn)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warn)' }}>Blocked ({blockedTasks.length})</span>
              </div>
              {blockedTasks.slice(0, 3).map(t => (
                <div key={t.id} style={{ fontSize: '12px', color: 'var(--warn)', padding: '4px 0', borderTop: '1px solid rgba(184,132,26,0.1)' }}>
                  {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Engagements table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--line-soft)' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 600, color: 'var(--navy)' }}>
            Active Engagements
          </h2>
          <Link href="/engagements" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--wine)', textDecoration: 'none', fontWeight: 500 }}>
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
              {['', 'Engagement', 'Type', 'Lead', 'Progress', 'Stage'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: '10px', color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600, padding: '12px 16px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeEngs.slice(0, 8).map(eng => {
              const engTasks = tasksByEng[eng.id] || []
              const progress = calcProgress(engTasks)
              return (
                <tr key={eng.id} className="dash-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <td style={{ padding: '14px 8px 14px 16px', width: '20px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
                      background: eng.health === 'red' ? 'var(--danger)' : eng.health === 'yellow' ? 'var(--warn)' : 'var(--success)',
                    }} />
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Link href={`/engagements/${eng.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontWeight: 500, color: 'var(--ink)', fontSize: '13px' }}>{eng.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px' }}>{eng.company?.name}</div>
                    </Link>
                  </td>
                  <td style={{ padding: '14px 16px' }}><Badge type={eng.engagement_type as EngagementType} /></td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--ink-soft)' }}>{eng.lead || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '80px', height: '4px', background: 'var(--line)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}><Badge stage={eng.stage as EngagementStage} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {activeEngs.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '13px' }}>
            No active engagements yet.{' '}
            <Link href="/engagements" style={{ color: 'var(--wine)', textDecoration: 'none' }}>Create one &rarr;</Link>
          </div>
        )}
      </div>
    </div>
  )
}
