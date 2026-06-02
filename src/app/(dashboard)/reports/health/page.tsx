export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import ReportNav from '@/components/reports/ReportNav'
import PrintButton from '@/components/reports/PrintButton'
import { ENGAGEMENT_STAGE_LABELS } from '@/lib/types'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function relDate(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function generatedLabel(now: Date): string {
  return `${MO[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
}

const HEALTH_DOT: Record<string, string> = {
  red: 'var(--danger)',
  yellow: 'var(--warn)',
  green: 'var(--success)',
}
const HEALTH_LABEL: Record<string, string> = {
  red: 'At Risk',
  yellow: 'Needs Attention',
  green: 'On Track',
}
const HEALTH_ROW_BG: Record<string, string> = {
  red: '#fff8f8',
  yellow: '#fffaf0',
  green: '#ffffff',
}

interface TaskRow {
  id: string
  status: string
  due_date: string | null
}

interface EngRow {
  id: string
  name: string
  lead: string | null
  stage: string
  health: string
  engagement_type: string
  company: { name: string } | null
  tasks: TaskRow[]
}

interface ActivityRow {
  engagement_id: string
  content: string
  entry_type: string
  created_at: string
}

export default async function HealthReportPage() {
  const supabase = await createClient()
  const now = new Date()
  const nowMs = now.getTime()

  const [engagementsRes, activityRes] = await Promise.all([
    supabase.from('engagements')
      .select('id, name, lead, stage, health, engagement_type, company:companies(name), tasks(*)')
      .in('stage', ['active', 'paused'])
      .order('health')
      .order('name'),
    supabase.from('activity_log')
      .select('engagement_id, content, entry_type, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const engagements = (engagementsRes.data ?? []) as unknown as EngRow[]
  const activityLog = (activityRes.data ?? []) as unknown as ActivityRow[]

  // Latest activity per engagement
  const latestActivity: Record<string, ActivityRow> = {}
  for (const entry of activityLog) {
    if (!latestActivity[entry.engagement_id]) {
      latestActivity[entry.engagement_id] = entry
    }
  }

  // Summary counts
  const redCount = engagements.filter(e => e.health === 'red').length
  const yellowCount = engagements.filter(e => e.health === 'yellow').length
  const greenCount = engagements.filter(e => e.health === 'green').length

  const dateLabel = generatedLabel(now)

  return (
    <>
      <style>{`
        .health-row:hover { background: var(--line-soft) !important; }
        @media print {
          .no-print { display: none !important; }
          aside, nav { display: none !important; }
          main { margin-left: 0 !important; padding: 24px !important; }
          body { background: white !important; }
          table { font-size: 12px !important; }
          th, td { padding: 6px 10px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1100 }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="no-print" style={{ marginBottom: 4 }}>
          <ReportNav active="health" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 600,
              color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px', marginBottom: 6,
            }}>
              Health Snapshot
            </h1>
            <p style={{ color: 'var(--ink-soft)', margin: 0, fontSize: 13 }}>
              Engagement health at a glance · Generated {dateLabel}
            </p>
          </div>
          <div className="no-print">
            <PrintButton />
          </div>
        </div>

        {/* ── Summary pills ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20,
            background: '#fff0f0', border: '1px solid var(--danger)',
            fontSize: 13, fontWeight: 600, color: 'var(--danger)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
            {redCount} At Risk
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20,
            background: '#fffbea', border: '1px solid var(--warn)',
            fontSize: 13, fontWeight: 600, color: 'var(--warn)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', display: 'inline-block' }} />
            {yellowCount} Needs Attention
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20,
            background: '#f0faf0', border: '1px solid var(--success)',
            fontSize: 13, fontWeight: 600, color: 'var(--success)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            {greenCount} On Track
          </span>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {[
                  { label: 'Engagement', width: '22%' },
                  { label: 'Lead', width: '10%' },
                  { label: 'Health', width: '13%' },
                  { label: 'Progress', width: '11%' },
                  { label: 'Blocked', width: '8%' },
                  { label: 'Last Update', width: '24%' },
                  { label: 'Stage', width: '10%' },
                ].map(col => (
                  <th
                    key={col.label}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--wine)',
                      borderBottom: '1px solid var(--line)',
                      width: col.width,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {engagements.map((eng, i) => {
                const tasks = (eng.tasks ?? []) as unknown as TaskRow[]
                const totalTasks = tasks.length
                const doneTasks = tasks.filter(t => t.status === 'done').length
                const blockedCount = tasks.filter(t => t.status === 'blocked').length
                const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

                const latest = latestActivity[eng.id]
                const lastContent = latest
                  ? latest.content.length > 60
                    ? latest.content.slice(0, 60) + '…'
                    : latest.content
                  : null
                const lastDate = latest ? relDate(latest.created_at, nowMs) : null

                const dotColor = HEALTH_DOT[eng.health] ?? 'var(--success)'
                const healthLabel = HEALTH_LABEL[eng.health] ?? 'On Track'
                const rowBg = HEALTH_ROW_BG[eng.health] ?? '#ffffff'
                const stageLabel = ENGAGEMENT_STAGE_LABELS[eng.stage as keyof typeof ENGAGEMENT_STAGE_LABELS] ?? eng.stage

                return (
                  <tr
                    key={eng.id}
                    className="health-row"
                    style={{
                      background: rowBg,
                      borderBottom: i < engagements.length - 1 ? '1px solid var(--line-soft)' : undefined,
                    }}
                  >
                    {/* Engagement */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 2 }}>{eng.name}</div>
                      {eng.company?.name && (
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{eng.company.name}</div>
                      )}
                    </td>

                    {/* Lead */}
                    <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>
                      {eng.lead || '—'}
                    </td>

                    {/* Health */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: dotColor, display: 'inline-block', flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: dotColor }}>{healthLabel}</span>
                      </span>
                    </td>

                    {/* Progress */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
                        {doneTasks}/{totalTasks} tasks
                      </div>
                      <div style={{ width: 60, height: 4, background: 'var(--line-soft)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${progressPct}%`,
                          background: dotColor,
                          borderRadius: 2,
                        }} />
                      </div>
                    </td>

                    {/* Blocked */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {blockedCount > 0 ? (
                        <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 13 }}>{blockedCount}</span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>—</span>
                      )}
                    </td>

                    {/* Last Update */}
                    <td style={{ padding: '12px 16px' }}>
                      {lastContent ? (
                        <>
                          <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 2, lineHeight: 1.4 }}>
                            {lastContent}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{lastDate}</div>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No activity</span>
                      )}
                    </td>

                    {/* Stage */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: 'var(--line-soft)', color: 'var(--ink-soft)',
                        letterSpacing: '0.06em',
                      }}>
                        {stageLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}

              {engagements.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
                    No active or paused engagements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
