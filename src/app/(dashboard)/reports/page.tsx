export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Engagement, Task } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import PrintButton from '@/components/reports/PrintButton'
import { ENGAGEMENT_TYPE_LABELS, ENGAGEMENT_STAGE_LABELS, TASK_STATUS_LABELS } from '@/lib/types'

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const { data: engagements } = await supabase
    .from('engagements')
    .select('*, company:companies(id, name), tasks(*), revenue_items(*)')
    .order('created_at', { ascending: false })

  const rows = (engagements ?? []) as (Engagement & { company?: { id: string; name: string } })[]

  const totalEngagements = rows.length
  const activeEngagements = rows.filter(e => e.stage === 'active').length
  const totalForecast = rows.reduce((s, e) => s + (e.revenue_items ?? []).reduce((rs, r) => rs + r.forecast_amount, 0), 0)
  const totalActual = rows.reduce((s, e) => s + (e.revenue_items ?? []).reduce((rs, r) => rs + (r.actual_amount ?? 0), 0), 0)

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          aside, nav { display: none !important; }
          main { margin-left: 0 !important; padding: 24px !important; }
          body { background: white !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0, marginBottom: 8 }}>
              Status Report
            </h1>
            <p style={{ color: 'var(--ink-soft)', margin: 0 }}>
              Generated {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <PrintButton />
        </div>

        {/* Portfolio summary */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48,
        }}>
          {[
            { label: 'Total Engagements', value: totalEngagements },
            { label: 'Active', value: activeEngagements },
            { label: 'Total Forecast', value: fmtCurrency(totalForecast) },
            { label: 'Total Actual', value: fmtCurrency(totalActual) },
          ].map(card => (
            <div key={card.label} style={{
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{card.label}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 600, color: 'var(--navy)', marginTop: 8, lineHeight: 1 }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Per engagement */}
        {rows.map((eng, idx) => {
          const tasks = (eng.tasks ?? []) as Task[]
          const revenue = eng.revenue_items ?? []
          const salesTasks = tasks.filter(t => t.task_group === 'sales')
          const projectTasks = tasks.filter(t => t.task_group === 'project')
          const customTasks = tasks.filter(t => t.task_group === 'custom')
          const doneTasks = tasks.filter(t => t.status === 'done').length
          const totalTasks = tasks.length
          const revenueForcast = revenue.reduce((s, r) => s + r.forecast_amount, 0)
          const revenueActual = revenue.reduce((s, r) => s + (r.actual_amount ?? 0), 0)

          return (
            <div key={eng.id} className={idx > 0 ? 'print-break' : ''} style={{ marginBottom: 48 }}>
              {/* Engagement header */}
              <div style={{
                background: 'var(--line-soft)', border: '1px solid var(--line)', borderRadius: '8px 8px 0 0',
                padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>{eng.name}</h2>
                    <Badge health={eng.health} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    {eng.company?.name && <span style={{ marginRight: 16 }}>{eng.company.name}</span>}
                    Lead: {eng.lead || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Badge type={eng.engagement_type} />
                  <Badge stage={eng.stage} />
                </div>
              </div>

              {/* Stats row */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                border: '1px solid var(--line)', borderTop: 'none',
                background: 'var(--surface)',
              }}>
                {[
                  { label: 'Tasks Done', value: `${doneTasks} / ${totalTasks}` },
                  { label: 'Progress', value: `${totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0}%` },
                  { label: 'Forecast', value: fmtCurrency(revenueForcast) },
                  { label: 'Actual', value: fmtCurrency(revenueActual) },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding: '14px 20px',
                    borderRight: i < 3 ? '1px solid var(--line-soft)' : undefined,
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--navy)', fontFamily: 'var(--serif)' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Task groups */}
              {[
                { label: 'Sales & Contracting', rows: salesTasks },
                { label: `${ENGAGEMENT_TYPE_LABELS[eng.engagement_type]} Tasks`, rows: projectTasks },
                { label: 'Additional Tasks', rows: customTasks },
              ].filter(g => g.rows.length > 0).map(group => (
                <div key={group.label} style={{ border: '1px solid var(--line)', borderTop: 'none', background: 'var(--surface)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 20px', background: 'var(--line-soft)', borderBottom: '1px solid var(--line-soft)' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{group.label}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {group.rows.map((task, i) => (
                        <tr key={task.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                          <td style={{ padding: '10px 20px', width: 24 }}>
                            <div style={{
                              width: 14, height: 14, borderRadius: '50%',
                              background: task.status === 'done' ? 'var(--success)' : 'var(--line)',
                              border: task.status === 'done' ? 'none' : '2px solid var(--line)',
                              flexShrink: 0,
                            }} />
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: task.status === 'done' ? 'var(--ink-faint)' : 'var(--ink)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                            {task.title}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-faint)' }}>{task.owner || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-faint)' }}>
                            {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </td>
                          <td style={{ padding: '10px 20px' }}><Badge status={task.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Notes */}
              {eng.notes && (
                <div style={{ border: '1px solid var(--line)', borderTop: 'none', background: 'var(--surface)', padding: '14px 20px', borderRadius: '0 0 8px 8px' }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>Notes</div>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>{eng.notes}</p>
                </div>
              )}
              {!eng.notes && <div style={{ borderRadius: '0 0 8px 8px', border: '1px solid var(--line)', borderTop: 'none' }} />}
            </div>
          )
        })}

        {rows.length === 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
            No engagements to report.
          </div>
        )}
      </div>
    </>
  )
}

