'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Engagement, Task, RevenueItem, TaskStatus, EngagementStage,
  TASK_STATUS_LABELS, ENGAGEMENT_STAGE_LABELS, ENGAGEMENT_TYPE_LABELS,
  ActivityEntry, ActivityEntryType, ACTIVITY_TYPE_LABELS,
  OUTREACH_SOURCE_LABELS, OutreachSource,
  WIN_LOSS_LABELS, NOUVELLEED_ONBOARDING_TASKS,
} from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { Trash2, Plus } from 'lucide-react'

interface Props {
  engagement: Engagement & { company?: { id: string; name: string } }
  tasks: Task[]
  revenueItems: RevenueItem[]
  activityLog: ActivityEntry[]
  leadCalendlyUrl?: string
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
  background: 'transparent', border: '1px solid transparent',
  borderRadius: 4, padding: '4px 8px', width: '100%', boxSizing: 'border-box',
}

const inputActiveStyle: React.CSSProperties = {
  ...inputStyle,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
}

const selectStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink)',
  background: 'var(--bg)', border: '1px solid var(--line)',
  borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
}

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const min = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hour}:${min} ${ampm}`
}

function fmtDateShort(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function daysDiff(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const ENTRY_TYPE_COLORS: Record<ActivityEntryType, string> = {
  note: 'var(--navy)',
  call: 'var(--success)',
  meeting: 'var(--wine)',
  email: 'var(--indigo)',
  status: 'var(--warn)',
  milestone: 'var(--success)',
}

const ENTRY_TYPE_PLACEHOLDERS: Record<ActivityEntryType, string> = {
  note: 'Add a note about this engagement…',
  call: 'Summarize the call…',
  meeting: 'What was discussed?',
  email: 'Email summary or content…',
  status: 'Describe the status update…',
  milestone: 'Describe the milestone reached…',
}

const ENTRY_TYPES: ActivityEntryType[] = ['note', 'call', 'meeting', 'email', 'status', 'milestone']

export default function EngagementDetailClient({ engagement: initialEng, tasks: initialTasks, revenueItems: initialRevenue, activityLog: initialLog, leadCalendlyUrl }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [eng, setEng] = useState(initialEng)
  const [tasks, setTasks] = useState(initialTasks)
  const [revenue, setRevenue] = useState(initialRevenue)
  const [saveMsg, setSaveMsg] = useState('')
  const [log, setLog] = useState<ActivityEntry[]>(initialLog)

  // Activity log form state
  const [newEntryType, setNewEntryType] = useState<ActivityEntryType>('note')
  const [newEntryContent, setNewEntryContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Win/loss form state
  const [showWinLossForm, setShowWinLossForm] = useState(false)
  const [winLossCategory, setWinLossCategory] = useState(eng.win_loss_category ?? '')
  const [winLossReason, setWinLossReason] = useState(eng.win_loss_reason ?? '')

  const saveEng = async (field: keyof Engagement, value: string | number | null | Record<string, unknown>) => {
    setEng(prev => ({ ...prev, [field]: value }))
    await supabase.from('engagements').update({ [field]: value }).eq('id', eng.id)
    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(''), 2000)
    startTransition(() => router.refresh())
  }

  const updateTask = async (task: Task, field: keyof Task, value: string | boolean) => {
    const updated = { ...task, [field]: value }
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    await supabase.from('tasks').update({ [field]: value }).eq('id', task.id)
  }

  const addTask = async (group: Task['task_group']) => {
    const { data } = await supabase.from('tasks').insert({
      engagement_id: eng.id,
      title: 'New task',
      task_group: group,
      status: 'not-started',
      sort_order: tasks.filter(t => t.task_group === group).length,
    }).select().single()
    if (data) setTasks(prev => [...prev, data])
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const addRevenueRow = async () => {
    const { data } = await supabase.from('revenue_items').insert({
      engagement_id: eng.id,
      label: 'New item',
      forecast_amount: 0,
      sort_order: revenue.length,
    }).select().single()
    if (data) setRevenue(prev => [...prev, data])
  }

  const updateRevenue = async (item: RevenueItem, field: keyof RevenueItem, value: string | number) => {
    const updated = { ...item, [field]: value }
    setRevenue(prev => prev.map(r => r.id === item.id ? updated : r))
    await supabase.from('revenue_items').update({ [field]: value }).eq('id', item.id)
  }

  const deleteRevenue = async (id: string) => {
    await supabase.from('revenue_items').delete().eq('id', id)
    setRevenue(prev => prev.filter(r => r.id !== id))
  }

  const submitActivityEntry = async () => {
    if (!newEntryContent.trim()) return
    setSubmitting(true)
    const optimistic: ActivityEntry = {
      id: `temp-${Date.now()}`,
      engagement_id: eng.id,
      author: eng.lead || 'Team',
      author_id: null,
      entry_type: newEntryType,
      content: newEntryContent.trim(),
      metadata: {},
      created_at: new Date().toISOString(),
    }
    setLog(prev => [optimistic, ...prev])
    setNewEntryContent('')

    const { data } = await supabase.from('activity_log').insert({
      engagement_id: eng.id,
      author: eng.lead || 'Team',
      entry_type: newEntryType,
      content: optimistic.content,
    }).select().single()

    if (data) {
      setLog(prev => prev.map(e => e.id === optimistic.id ? data : e))
    }
    setSubmitting(false)
  }

  const handleStageChange = async (newStage: EngagementStage) => {
    const prevStage = eng.stage
    setEng(prev => ({ ...prev, stage: newStage }))
    await supabase.from('engagements').update({ stage: newStage }).eq('id', eng.id)
    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(''), 2000)

    // Stage velocity tracking
    const now = new Date().toISOString().slice(0, 10)
    const updatedHistory = { ...(eng.stage_history ?? {}), [newStage]: now }
    setEng(prev => ({ ...prev, stage_history: updatedHistory }))
    await supabase.from('engagements').update({ stage_history: updatedHistory }).eq('id', eng.id)

    // Win/loss capture
    if (newStage === 'closed') {
      setShowWinLossForm(true)
    }

    // Auto onboarding tasks when going active
    if (newStage === 'active' && (prevStage === 'proposal_sent' || prevStage === 'qualified')) {
      const onboardingTasks = NOUVELLEED_ONBOARDING_TASKS.map((title, i) => ({
        engagement_id: eng.id,
        title,
        task_group: 'project' as const,
        status: 'not-started' as const,
        sort_order: 100 + i,
      }))
      const { data: newTasks } = await supabase.from('tasks').insert(onboardingTasks).select()
      if (newTasks) setTasks(prev => [...prev, ...newTasks])
    }

    startTransition(() => router.refresh())
  }

  const saveOutcome = async (field: string, value: unknown) => {
    const updated = { ...(eng.outcomes ?? {}), [field]: value }
    setEng(prev => ({ ...prev, outcomes: updated }))
    await supabase.from('engagements').update({ outcomes: updated }).eq('id', eng.id)
  }

  const salesTasks = tasks.filter(t => t.task_group === 'sales')
  const projectTasks = tasks.filter(t => t.task_group === 'project')
  const customTasks = tasks.filter(t => t.task_group === 'custom')

  const typeLabel = ENGAGEMENT_TYPE_LABELS[eng.engagement_type]

  // Next action date helpers
  const nextActionDays = eng.next_action_date ? daysDiff(eng.next_action_date) : null
  const nextActionOverdue = nextActionDays !== null && nextActionDays < 0
  const nextActionBorderColor = (eng.next_action && nextActionOverdue)
    ? 'var(--warn)'
    : 'var(--line)'
  const nextActionBg = (eng.next_action && nextActionOverdue)
    ? 'var(--warn-soft)'
    : 'var(--surface)'

  // Outcomes
  const outcomes = (eng.outcomes ?? {}) as Record<string, unknown>

  const detailColCount = (() => {
    let count = 4
    if (eng.source && eng.source !== 'unknown') count++
    if (leadCalendlyUrl) count++
    return count
  })()

  return (
    <div>
      {/* Name + meta */}
      <div style={{ marginBottom: 8 }}>
        <input
          defaultValue={eng.name}
          onBlur={e => saveEng('name', e.target.value)}
          style={{
            fontFamily: 'var(--serif)', fontSize: 38, fontWeight: 600, color: 'var(--navy)',
            letterSpacing: '-0.5px', border: 'none', borderBottom: '2px solid transparent',
            background: 'transparent', width: '100%', padding: '2px 0', outline: 'none',
          }}
          onFocus={e => (e.target.style.borderBottomColor = 'var(--wine)')}
          onBlurCapture={e => (e.target.style.borderBottomColor = 'transparent')}
        />
      </div>

      {/* Type + Stage row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Badge type={eng.engagement_type} />
        <select
          value={eng.stage}
          onChange={async e => {
            await handleStageChange(e.target.value as EngagementStage)
          }}
          style={selectStyle}
        >
          {Object.entries(ENGAGEMENT_STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {eng.next_action && (
          <span style={{
            display: 'inline-block',
            background: 'var(--line-soft)',
            color: 'var(--ink-soft)',
            fontSize: 11,
            padding: '3px 9px',
            borderRadius: 20,
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            → {eng.next_action.length > 40 ? eng.next_action.slice(0, 40) + '…' : eng.next_action}
          </span>
        )}
        {saveMsg && <span style={{ fontSize: 11, color: 'var(--success)' }}>{saveMsg}</span>}
      </div>

      {/* Win/Loss form (shown when stage = closed) */}
      {showWinLossForm && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--warn)',
          borderRadius: 8, padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 12 }}>
            Why is this deal closing?
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <select
              value={winLossCategory}
              onChange={e => setWinLossCategory(e.target.value)}
              style={{ ...selectStyle, width: '100%', fontSize: 13, padding: '8px 10px' }}
            >
              <option value="">— Select reason —</option>
              {Object.entries(WIN_LOSS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <textarea
              value={winLossReason}
              onChange={e => setWinLossReason(e.target.value)}
              rows={2}
              placeholder="Additional notes (optional)"
              style={{
                fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
                background: 'var(--bg)', border: '1px solid var(--line)',
                borderRadius: 4, padding: '8px 10px', width: '100%', boxSizing: 'border-box', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await supabase.from('engagements').update({
                    win_loss_category: winLossCategory || null,
                    win_loss_reason: winLossReason,
                  }).eq('id', eng.id)
                  setEng(prev => ({ ...prev, win_loss_category: winLossCategory || null, win_loss_reason: winLossReason }))
                  setShowWinLossForm(false)
                  setSaveMsg('Saved')
                  setTimeout(() => setSaveMsg(''), 2000)
                }}
                style={{
                  background: 'var(--wine)', color: '#fff', border: 'none',
                  borderRadius: 4, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Save & Close
              </button>
              <button
                onClick={() => setShowWinLossForm(false)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)',
                  borderRadius: 4, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${detailColCount}, 1fr)`,
        gap: 0,
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
        overflow: 'hidden', marginBottom: 24,
      }}>
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>Lead</div>
          <input
            defaultValue={eng.lead ?? ''}
            onBlur={e => saveEng('lead', e.target.value)}
            style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--navy)', border: 'none', background: 'transparent', width: '100%', padding: 0, outline: 'none' }}
          />
        </div>
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>Start Date</div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ fontSize: 14, color: 'var(--navy)', fontWeight: 500 }}>
              {eng.start_date
                ? fmtDateShort(eng.start_date)
                : <span style={{ color: 'var(--ink-faint)' }}>Not set</span>}
            </div>
            <input
              type="date"
              defaultValue={eng.start_date ?? ''}
              onBlur={e => saveEng('start_date', e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              title="Click to change start date"
            />
          </div>
        </div>
        {/* Real task progress */}
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 8 }}>Progress</div>
          <div style={{ fontSize: 14, color: 'var(--navy)', fontWeight: 600 }}>
            {tasks.filter(t => t.status === 'done').length} / {tasks.length} tasks
          </div>
          <div style={{ marginTop: 8, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: tasks.length > 0 ? `${Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100)}%` : '0%',
              height: '100%', background: 'var(--success)', transition: 'width 0.3s',
            }} />
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderRight: (eng.source && eng.source !== 'unknown') || leadCalendlyUrl ? '1px solid var(--line-soft)' : undefined }}>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>Health</div>
          <select
            value={eng.health}
            onChange={async e => {
              const v = e.target.value as Engagement['health']
              setEng(prev => ({ ...prev, health: v }))
              await saveEng('health', v)
            }}
            style={selectStyle}
          >
            <option value="green">🟢 Green</option>
            <option value="yellow">🟡 Yellow</option>
            <option value="red">🔴 Red</option>
          </select>
        </div>
        {eng.source && eng.source !== 'unknown' && (
          <div style={{ padding: '16px 20px', borderRight: leadCalendlyUrl ? '1px solid var(--line-soft)' : undefined }}>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>Source</div>
            <div style={{ fontSize: 13, color: 'var(--navy)' }}>
              {OUTREACH_SOURCE_LABELS[eng.source as OutreachSource]}
            </div>
            {eng.source_detail && (
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{eng.source_detail}</div>
            )}
          </div>
        )}
        {leadCalendlyUrl && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>Book a Call</div>
            <a
              href={leadCalendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--wine)', textDecoration: 'none', fontWeight: 500 }}
            >
              📅 Schedule with {eng.lead || 'Lead'}
            </a>
          </div>
        )}
      </div>

      {/* Next Action Card */}
      <div style={{
        background: nextActionBg,
        border: `1px solid ${nextActionBorderColor}`,
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 32,
      }}>
        <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 10 }}>Next Action</div>
        <input
          key={`na-${eng.id}`}
          defaultValue={eng.next_action ?? ''}
          onBlur={e => saveEng('next_action', e.target.value)}
          placeholder="Book discovery call with Dr. Hayes…"
          style={{
            fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)',
            background: 'var(--bg)', border: '1px solid var(--line)',
            borderRadius: 4, padding: '8px 12px', width: '100%', boxSizing: 'border-box',
            marginBottom: 8,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Due:</span>
            <input
              type="date"
              key={`nad-${eng.id}`}
              defaultValue={eng.next_action_date ?? ''}
              onBlur={e => saveEng('next_action_date', e.target.value || null)}
              style={{
                fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
                background: 'var(--bg)', border: '1px solid var(--line)',
                borderRadius: 4, padding: '5px 8px',
              }}
            />
          </div>
          {eng.next_action_date && (
            <span style={{
              fontSize: 12,
              color: nextActionOverdue ? 'var(--warn)' : 'var(--ink-faint)',
              fontWeight: nextActionOverdue ? 600 : 400,
            }}>
              {nextActionOverdue
                ? `⚠ overdue by ${Math.abs(nextActionDays!)} day${Math.abs(nextActionDays!) !== 1 ? 's' : ''}`
                : `due in ${nextActionDays} day${nextActionDays !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      </div>

      {/* Task Sections */}
      {[
        { group: 'sales' as Task['task_group'], label: 'Sales & Contracting', rows: salesTasks },
        { group: 'project' as Task['task_group'], label: `${typeLabel} Tasks`, rows: projectTasks },
        { group: 'custom' as Task['task_group'], label: 'Additional Tasks', rows: customTasks },
      ].map(({ group, label, rows }) => (
        <div key={group} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>{label}</h2>
            <button
              onClick={() => addTask(group)}
              style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--navy)', padding: '5px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={12} /> Add task
            </button>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            {rows.length === 0 ? (
              <div style={{ padding: '20px 16px', color: 'var(--ink-faint)', fontSize: 13 }}>No tasks yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)' }}>
                    {['', 'Task', 'Owner', 'Due Date', 'Status', ''].map((h, i) => (
                      <th key={i} style={{
                        textAlign: 'left', padding: '10px 12px', fontSize: 10,
                        color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600,
                        width: i === 0 ? 32 : i === 5 ? 36 : 'auto',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((task, i) => (
                    <tr key={task.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                      <td style={{ padding: '10px 12px', width: 32 }}>
                        <input
                          type="checkbox"
                          checked={task.status === 'done'}
                          onChange={e => updateTask(task, 'status', e.target.checked ? 'done' : 'not-started')}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        <input
                          defaultValue={task.title}
                          onBlur={e => updateTask(task, 'title', e.target.value)}
                          style={{
                            ...inputStyle,
                            textDecoration: task.status === 'done' ? 'line-through' : 'none',
                            color: task.status === 'done' ? 'var(--ink-faint)' : 'var(--ink)',
                          }}
                          onFocus={e => Object.assign(e.target.style, { border: '1px solid var(--line)', background: 'var(--bg)' })}
                          onBlurCapture={e => Object.assign(e.target.style, { border: '1px solid transparent', background: 'transparent' })}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        <input
                          defaultValue={task.owner ?? ''}
                          onBlur={e => updateTask(task, 'owner', e.target.value)}
                          style={{ ...inputStyle, width: 140 }}
                          placeholder="Owner"
                          onFocus={e => Object.assign(e.target.style, { border: '1px solid var(--line)', background: 'var(--bg)' })}
                          onBlurCapture={e => Object.assign(e.target.style, { border: '1px solid transparent', background: 'transparent' })}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        <input
                          type="date"
                          defaultValue={task.due_date ?? ''}
                          onBlur={e => updateTask(task, 'due_date', e.target.value)}
                          style={{ ...inputStyle, width: 130, fontSize: 12 }}
                          onFocus={e => Object.assign(e.target.style, { border: '1px solid var(--line)', background: 'var(--bg)' })}
                          onBlurCapture={e => Object.assign(e.target.style, { border: '1px solid transparent', background: 'transparent' })}
                        />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <select
                          value={task.status}
                          onChange={e => updateTask(task, 'status', e.target.value as TaskStatus)}
                          style={selectStyle}
                        >
                          {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 12px', width: 36 }}>
                        <button
                          onClick={() => deleteTask(task.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', padding: 0 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ))}

      {/* Revenue Schedule */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Revenue Schedule</h2>
          <button
            onClick={addRevenueRow}
            style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--navy)', padding: '5px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={12} /> Add row
          </button>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          {revenue.length === 0 ? (
            <div style={{ padding: '20px 16px', color: 'var(--ink-faint)', fontSize: 13 }}>No revenue items yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--line-soft)' }}>
                  {['Label', 'Month', 'Forecast', 'Actual', 'Variance', ''].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 16px', fontSize: 10,
                      color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revenue.map((item, i) => {
                  const variance = (item.actual_amount ?? 0) - item.forecast_amount
                  return (
                    <tr key={item.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>
                        <input
                          defaultValue={item.label}
                          onBlur={e => updateRevenue(item, 'label', e.target.value)}
                          style={inputStyle}
                          onFocus={e => Object.assign(e.target.style, { border: '1px solid var(--line)', background: 'var(--bg)' })}
                          onBlurCapture={e => Object.assign(e.target.style, { border: '1px solid transparent', background: 'transparent' })}
                        />
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>
                        <input
                          type="month"
                          defaultValue={item.month ?? ''}
                          onBlur={e => updateRevenue(item, 'month', e.target.value)}
                          style={{ ...inputStyle, width: 130 }}
                          onFocus={e => Object.assign(e.target.style, { border: '1px solid var(--line)', background: 'var(--bg)' })}
                          onBlurCapture={e => Object.assign(e.target.style, { border: '1px solid transparent', background: 'transparent' })}
                        />
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>
                        <input
                          type="number"
                          defaultValue={item.forecast_amount}
                          onBlur={e => updateRevenue(item, 'forecast_amount', parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, width: 100 }}
                          onFocus={e => Object.assign(e.target.style, { border: '1px solid var(--line)', background: 'var(--bg)' })}
                          onBlurCapture={e => Object.assign(e.target.style, { border: '1px solid transparent', background: 'transparent' })}
                        />
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>
                        <input
                          type="number"
                          defaultValue={item.actual_amount ?? ''}
                          onBlur={e => updateRevenue(item, 'actual_amount', parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, width: 100 }}
                          onFocus={e => Object.assign(e.target.style, { border: '1px solid var(--line)', background: 'var(--bg)' })}
                          onBlurCapture={e => Object.assign(e.target.style, { border: '1px solid transparent', background: 'transparent' })}
                        />
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: variance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                        {item.actual_amount != null ? fmtCurrency(variance) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <button
                          onClick={() => deleteRevenue(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', padding: 0 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {/* Totals */}
                <tr style={{ borderTop: '2px solid var(--line)', background: 'var(--line-soft)' }}>
                  <td colSpan={2} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                    {fmtCurrency(revenue.reduce((s, r) => s + r.forecast_amount, 0))}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                    {fmtCurrency(revenue.reduce((s, r) => s + (r.actual_amount ?? 0), 0))}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                    {fmtCurrency(revenue.reduce((s, r) => s + ((r.actual_amount ?? 0) - r.forecast_amount), 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', marginBottom: 12 }}>Notes</h2>
        <textarea
          defaultValue={eng.notes ?? ''}
          onBlur={e => saveEng('notes', e.target.value)}
          rows={5}
          style={{
            fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 4, padding: '10px 12px', width: '100%', boxSizing: 'border-box', resize: 'vertical',
          }}
          placeholder="Notes about this engagement…"
        />
      </div>

      {/* Activity Log */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', marginBottom: 16 }}>
          Activity Log
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-faint)', marginLeft: 10, fontFamily: 'var(--sans)' }}>
            {log.length} {log.length === 1 ? 'entry' : 'entries'}
          </span>
        </h2>

        {/* Add entry form */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
          padding: '16px 20px', marginBottom: 20,
        }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {ENTRY_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setNewEntryType(t)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', border: 'none',
                  background: newEntryType === t ? ENTRY_TYPE_COLORS[t] : 'var(--line-soft)',
                  color: newEntryType === t ? '#fff' : 'var(--ink-soft)',
                  transition: 'all 0.15s',
                }}
              >
                {ACTIVITY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={newEntryContent}
            onChange={e => setNewEntryContent(e.target.value)}
            rows={3}
            placeholder={ENTRY_TYPE_PLACEHOLDERS[newEntryType]}
            style={{
              fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
              background: 'var(--bg)', border: '1px solid var(--line)',
              borderRadius: 4, padding: '10px 12px', width: '100%', boxSizing: 'border-box',
              resize: 'vertical', marginBottom: 10,
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={submitActivityEntry}
              disabled={submitting || !newEntryContent.trim()}
              style={{
                padding: '8px 20px', borderRadius: 4, fontSize: 13, fontWeight: 600,
                background: 'var(--wine)', color: '#fff', border: 'none', cursor: 'pointer',
                opacity: submitting || !newEntryContent.trim() ? 0.6 : 1,
              }}
            >
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>

        {/* Log entries */}
        {log.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
            padding: '40px 32px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13,
          }}>
            No activity yet. Add the first entry above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {log.map(entry => (
              <div
                key={entry.id}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
                  padding: '14px 18px',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: ENTRY_TYPE_COLORS[entry.entry_type],
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {entry.author}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      background: ENTRY_TYPE_COLORS[entry.entry_type] + '22',
                      color: ENTRY_TYPE_COLORS[entry.entry_type],
                      border: `1px solid ${ENTRY_TYPE_COLORS[entry.entry_type]}44`,
                    }}>
                      {ACTIVITY_TYPE_LABELS[entry.entry_type]}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    {fmtDateTime(entry.created_at)}
                  </span>
                </div>
                {/* Content */}
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', paddingLeft: 20 }}>
                  {entry.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outcomes & Case Study Data — only shown for active engagements */}
      {eng.stage === 'active' && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
              Outcomes & Case Study Data
            </h2>
            {!!(outcomes as Record<string, unknown>).case_study_ready && (
              <span style={{
                background: 'var(--success-soft)', color: 'var(--success)',
                border: '1px solid rgba(45,106,62,0.3)',
                borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Case study ready ✓
              </span>
            )}
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>
                  Hours saved / competency build
                </label>
                <input
                  type="number"
                  defaultValue={(outcomes.hours_saved as number) ?? ''}
                  onBlur={e => saveOutcome('hours_saved', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0"
                  style={{
                    fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)',
                    background: 'var(--bg)', border: '1px solid var(--line)',
                    borderRadius: 4, padding: '7px 10px', width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>
                  Modules created
                </label>
                <input
                  type="number"
                  defaultValue={(outcomes.modules_created as number) ?? ''}
                  onBlur={e => saveOutcome('modules_created', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="0"
                  style={{
                    fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)',
                    background: 'var(--bg)', border: '1px solid var(--line)',
                    borderRadius: 4, padding: '7px 10px', width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>
                  CE certificates issued
                </label>
                <input
                  type="number"
                  defaultValue={(outcomes.ce_certificates as number) ?? ''}
                  onBlur={e => saveOutcome('ce_certificates', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="0"
                  style={{
                    fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)',
                    background: 'var(--bg)', border: '1px solid var(--line)',
                    borderRadius: 4, padding: '7px 10px', width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!outcomes.case_study_ready}
                  onChange={e => saveOutcome('case_study_ready', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>Case study ready?</span>
              </label>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>
                Outcome notes
              </label>
              <textarea
                defaultValue={(outcomes.notes as string) ?? ''}
                onBlur={e => saveOutcome('notes', e.target.value)}
                rows={3}
                placeholder="Describe key outcomes, wins, or lessons…"
                style={{
                  fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
                  background: 'var(--bg)', border: '1px solid var(--line)',
                  borderRadius: 4, padding: '8px 12px', width: '100%', boxSizing: 'border-box', resize: 'vertical',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
