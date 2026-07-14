'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Task, TaskStatus, TASK_STATUS_LABELS } from '@/lib/types'
import Badge from '@/components/ui/Badge'

interface TaskRow extends Task {
  engagement?: { id: string; name: string }
}

interface NextActionRow {
  id: string; name: string; stage: string; next_action: string
  next_action_date: string | null; company: { name: string } | null; lead: string
}

interface Props {
  tasks: TaskRow[]
  currentUserName?: string
  nextActions?: NextActionRow[]
  engagements?: { id: string; name: string }[]
}

type Filter = TaskStatus | 'all' | 'overdue' | 'next_actions'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const PRIORITY_COLORS: Record<string, { dot: string; label: string }> = {
  high:   { dot: 'var(--danger)', label: 'High' },
  medium: { dot: 'var(--warn)',   label: 'Med'  },
  low:    { dot: 'var(--ink-faint)', label: 'Low' },
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'next_actions', label: 'Next Actions' },
  { value: 'all',          label: 'All Tasks'    },
  { value: 'overdue',      label: 'Overdue'      },
  { value: 'blocked',      label: 'Blocked'      },
  { value: 'in-progress',  label: 'In Progress'  },
  { value: 'not-started',  label: 'Not Started'  },
  { value: 'done',         label: 'Done'         },
]

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false
  return task.due_date < new Date().toISOString().slice(0, 10)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return `${MO[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`
}

// ── Quick-Add Task Modal ──────────────────────────────────────────────────────

interface QuickAddProps {
  engagements: { id: string; name: string }[]
  owners: string[]
  onClose: () => void
  onCreated: (task: TaskRow) => void
}

function QuickAddModal({ engagements, owners, onClose, onCreated }: QuickAddProps) {
  const supabase = createClient()
  const [form, setForm] = useState({
    title: '', engagement_id: '', owner: owners[1] ?? '',
    due_date: '', priority: 'medium' as Task['priority'], notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.title.trim()) { setError('Task title is required.'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('tasks').insert({
      title: form.title.trim(),
      engagement_id: form.engagement_id || null,
      owner: form.owner || null,
      due_date: form.due_date || null,
      priority: form.priority,
      notes: form.notes || '',
      status: 'not-started',
      task_group: 'custom',
      sort_order: 0,
    }).select('*, engagement:engagements(id, name)').single()
    setSaving(false)
    if (err || !data) { setError(err?.message ?? 'Failed to save'); return }
    onCreated(data as TaskRow)
    onClose()
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'var(--sans)',
    fontSize: 13, color: 'var(--ink)', background: '#fff',
    border: '1px solid var(--line)', borderRadius: 5, padding: '8px 10px',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 4,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(37,49,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 480, maxWidth: '94vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>New Task</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-faint)', lineHeight: 1 }}>×</button>
        </div>
        {error && <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 5, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={lbl}>Task Title *</label>
            <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Send proposal to client" autoFocus />
          </div>
          <div>
            <label style={lbl}>Engagement</label>
            <select style={inp} value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))}>
              <option value="">— None —</option>
              {engagements.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Owner</label>
              <select style={inp} value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                <option value="">— Unassigned —</option>
                {owners.filter(o => o !== 'all').map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Due Date</label>
              <input type="date" style={inp} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <select style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Task['priority'] }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, height: 68, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Context, blockers, or next steps…" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Convert Next Action to Task Modal ─────────────────────────────────────────

interface ConvertModalProps {
  row: NextActionRow
  owners: string[]
  onClose: () => void
  onConverted: () => void
}

function ConvertModal({ row, owners, onClose, onConverted }: ConvertModalProps) {
  const supabase = createClient()
  const [form, setForm] = useState({
    title: row.next_action,
    owner: row.lead || (owners[1] ?? ''),
    due_date: row.next_action_date ?? '',
    priority: 'medium' as Task['priority'],
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await supabase.from('tasks').insert({
      title: form.title.trim(),
      engagement_id: row.id,
      owner: form.owner || null,
      due_date: form.due_date || null,
      priority: form.priority,
      status: 'not-started',
      task_group: 'sales',
      sort_order: 0,
      notes: '',
    })
    setSaving(false)
    onConverted()
    onClose()
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'var(--sans)',
    fontSize: 13, color: 'var(--ink)', background: '#fff',
    border: '1px solid var(--line)', borderRadius: 5, padding: '8px 10px',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 4,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(37,49,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 440, maxWidth: '94vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Convert to Task</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-faint)', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', margin: '0 0 18px' }}>
          Creating a task on <strong>{row.name}</strong>
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={lbl}>Task Title</label>
            <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Owner</label>
              <select style={inp} value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                <option value="">— None —</option>
                {owners.filter(o => o !== 'all').map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Due Date</label>
              <input type="date" style={inp} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <select style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Task['priority'] }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Row (expandable, inline status + date) ───────────────────────────────

interface TaskRowProps {
  task: TaskRow
  onStatusChange: (id: string, status: TaskStatus) => void
  onDateChange: (id: string, date: string) => void
  rowBg?: string
}

function TaskRowItem({ task, onStatusChange, onDateChange, rowBg }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [dateVal, setDateVal] = useState(task.due_date ?? '')
  const dateRef = useRef<HTMLInputElement>(null)
  const overdue = isOverdue(task)
  const pri = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium

  function handleDateBlur() {
    setEditingDate(false)
    if (dateVal !== (task.due_date ?? '')) onDateChange(task.id, dateVal)
  }

  return (
    <>
      <tr style={{ borderTop: '1px solid var(--line-soft)', background: rowBg ?? (overdue ? 'var(--danger-soft)' : '#fff') }}>
        {/* Checkbox */}
        <td style={{ padding: '12px 8px 12px 16px', width: 32 }}>
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={() => onStatusChange(task.id, task.status === 'done' ? 'not-started' : 'done')}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--wine)' }}
          />
        </td>
        {/* Priority dot */}
        <td style={{ padding: '12px 4px', width: 16 }}>
          <span title={pri.label} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: pri.dot }} />
        </td>
        {/* Title + notes toggle */}
        <td style={{ padding: '12px 12px 12px 4px', fontSize: 13, color: task.status === 'done' ? 'var(--ink-faint)' : 'var(--ink)', fontWeight: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
            {task.notes && (
              <button onClick={() => setExpanded(e => !e)} style={{ border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--ink-faint)', padding: '1px 5px', borderRadius: 3, background: 'var(--line-soft)' }}>
                {expanded ? '▲' : '▼'} note
              </button>
            )}
          </div>
        </td>
        {/* Engagement */}
        <td style={{ padding: '12px 16px', fontSize: 13 }}>
          {task.engagement
            ? <Link href={`/engagements/${task.engagement.id}`} style={{ color: 'var(--wine)', textDecoration: 'none' }}>{task.engagement.name}</Link>
            : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
        </td>
        {/* Owner */}
        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{task.owner || '—'}</td>
        {/* Due date — inline editable */}
        <td style={{ padding: '12px 16px', fontSize: 13, color: overdue ? 'var(--danger)' : 'var(--ink-soft)', fontWeight: overdue ? 600 : 400 }}>
          {editingDate ? (
            <input
              ref={dateRef}
              type="date"
              value={dateVal}
              autoFocus
              onChange={e => setDateVal(e.target.value)}
              onBlur={handleDateBlur}
              onKeyDown={e => { if (e.key === 'Enter') dateRef.current?.blur(); if (e.key === 'Escape') { setDateVal(task.due_date ?? ''); setEditingDate(false) } }}
              style={{ fontSize: 12, border: '1px solid var(--blush)', borderRadius: 4, padding: '2px 6px', fontFamily: 'var(--sans)' }}
            />
          ) : (
            <span
              onClick={() => setEditingDate(true)}
              title="Click to edit date"
              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--line)' }}
            >
              {task.due_date ? fmtDate(task.due_date) : <span style={{ color: 'var(--ink-faint)' }}>Set date</span>}
            </span>
          )}
        </td>
        {/* Status select */}
        <td style={{ padding: '12px 16px' }}>
          <select
            value={task.status}
            onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
            style={{ fontSize: 12, border: '1px solid var(--line)', borderRadius: 4, padding: '3px 6px', fontFamily: 'var(--sans)', color: 'var(--ink)', background: '#fff', cursor: 'pointer' }}
          >
            {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map(s => (
              <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </td>
      </tr>
      {expanded && task.notes && (
        <tr style={{ background: rowBg ?? (overdue ? 'var(--danger-soft)' : '#fff') }}>
          <td colSpan={7} style={{ padding: '0 16px 12px 56px', fontSize: 12, color: 'var(--ink-soft)', fontStyle: 'italic', lineHeight: 1.5 }}>
            {task.notes}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Table wrapper ─────────────────────────────────────────────────────────────

function TaskTable({ tasks, onStatusChange, onDateChange, rowBg }: {
  tasks: TaskRow[]
  onStatusChange: (id: string, status: TaskStatus) => void
  onDateChange: (id: string, date: string) => void
  rowBg?: string
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: 'var(--line-soft)' }}>
          {['', '', 'Task', 'Engagement', 'Owner', 'Due Date', 'Status'].map((h, i) => (
            <th key={i} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tasks.map(task => (
          <TaskRowItem key={task.id} task={task} onStatusChange={onStatusChange} onDateChange={onDateChange} rowBg={rowBg} />
        ))}
      </tbody>
    </table>
  )
}

// ── Grouped view ──────────────────────────────────────────────────────────────

function GroupedView({ tasks, onStatusChange, onDateChange }: {
  tasks: TaskRow[]
  onStatusChange: (id: string, status: TaskStatus) => void
  onDateChange: (id: string, date: string) => void
}) {
  const [doneOpen, setDoneOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10)

  const overdue: TaskRow[] = [], dueToday: TaskRow[] = [], dueThisWeek: TaskRow[] = [], later: TaskRow[] = [], done: TaskRow[] = []
  for (const t of tasks) {
    if (t.status === 'done') { done.push(t); continue }
    if (!t.due_date) { later.push(t); continue }
    if (t.due_date < today) { overdue.push(t); continue }
    if (t.due_date === today) { dueToday.push(t); continue }
    if (t.due_date >= tomorrow && t.due_date <= weekEnd) { dueThisWeek.push(t); continue }
    later.push(t)
  }

  const SHOWN_DONE = 20
  const shownDone = done.slice(0, SHOWN_DONE)

  const sections = [
    { key: 'overdue',   label: 'Overdue',        tasks: overdue,      labelColor: 'var(--danger)', bg: 'var(--danger-soft)' },
    { key: 'today',     label: 'Due Today',       tasks: dueToday,     labelColor: 'var(--warn)',   bg: 'var(--warn-soft)' },
    { key: 'thisweek',  label: 'Due This Week',   tasks: dueThisWeek,  labelColor: 'var(--navy)',   bg: undefined },
    { key: 'later',     label: 'Later / No Date', tasks: later,        labelColor: 'var(--ink-soft)', bg: undefined },
  ]

  const totalOpen = overdue.length + dueToday.length + dueThisWeek.length + later.length

  if (totalOpen === 0 && done.length === 0) {
    return <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>No tasks found.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sections.map(s => s.tasks.length === 0 ? null : (
        <div key={s.key} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', background: s.bg ?? 'var(--line-soft)', borderBottom: '1px solid var(--line-soft)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.labelColor, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{s.label}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>· {s.tasks.length} task{s.tasks.length !== 1 ? 's' : ''}</span>
          </div>
          <TaskTable tasks={s.tasks} onStatusChange={onStatusChange} onDateChange={onDateChange} rowBg={s.bg} />
        </div>
      ))}
      {done.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setDoneOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', background: 'var(--line-soft)', border: 'none', cursor: 'pointer', borderBottom: doneOpen ? '1px solid var(--line-soft)' : 'none', textAlign: 'left' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Done</span>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>· {done.length} task{done.length !== 1 ? 's' : ''}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-faint)' }}>{doneOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {doneOpen && (
            <>
              <TaskTable tasks={shownDone} onStatusChange={onStatusChange} onDateChange={onDateChange} />
              {done.length > SHOWN_DONE && (
                <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink-faint)', borderTop: '1px solid var(--line-soft)', textAlign: 'center' }}>
                  Showing {SHOWN_DONE} of {done.length} completed tasks
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TasksClient({ tasks: initialTasks, currentUserName, nextActions = [], engagements = [] }: Props) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks)
  const [filter, setFilter] = useState<Filter>('next_actions')
  const [ownerFilter, setOwnerFilter] = useState<string>(currentUserName ?? 'all')
  const [showAdd, setShowAdd] = useState(false)
  const [convertRow, setConvertRow] = useState<NextActionRow | null>(null)

  // Unique owners from tasks
  const owners: string[] = ['all']
  for (const t of tasks) {
    if (t.owner && !owners.includes(t.owner)) owners.push(t.owner)
  }

  // Inline status update
  async function handleStatusChange(id: string, status: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    await supabase.from('tasks').update({ status }).eq('id', id)
  }

  // Inline date update
  async function handleDateChange(id: string, due_date: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: due_date || null } : t))
    await supabase.from('tasks').update({ due_date: due_date || null }).eq('id', id)
  }

  const today = new Date().toISOString().slice(0, 10)

  // Filtered tasks for non-grouped views
  const filtered = tasks.filter(t => {
    const ownerMatch = ownerFilter === 'all' || t.owner === ownerFilter
    if (!ownerMatch) return false
    if (filter === 'all') return true
    if (filter === 'overdue') return isOverdue(t)
    return t.status === filter
  })

  // Counts for the header — reflects current filter
  const myTasks = ownerFilter === 'all' ? tasks : tasks.filter(t => t.owner === ownerFilter)
  const openCount = myTasks.filter(t => t.status !== 'done').length
  const overdueCount = myTasks.filter(t => isOverdue(t)).length

  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', border: 'none',
    background: active ? 'var(--wine)' : 'var(--line-soft)',
    color: active ? '#fff' : 'var(--ink-soft)',
  })

  const statusChipBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', border: 'none',
    background: active ? 'var(--navy)' : 'var(--line-soft)',
    color: active ? '#fff' : 'var(--ink-soft)',
  })

  // ── Next Actions view ──────────────────────────────────────────────────────
  if (filter === 'next_actions') {
    return (
      <div>
        {showAdd && (
          <QuickAddModal
            engagements={engagements}
            owners={owners}
            onClose={() => setShowAdd(false)}
            onCreated={task => setTasks(prev => [task, ...prev])}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>View</span>
            {FILTERS.map(f => <button key={f.value} onClick={() => setFilter(f.value)} style={statusChipBtn(filter === f.value)}>{f.label}</button>)}
          </div>
          <button onClick={() => setShowAdd(true)} style={{ background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Task</button>
        </div>
        {nextActions.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
            No pending next actions.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--line-soft)' }}>
                  {['Engagement', 'Company', 'Stage', 'Lead', 'Next Action', 'Due', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nextActions.map((eng, i) => {
                  const overdue = !!eng.next_action_date && eng.next_action_date < today
                  return (
                    <tr key={eng.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, background: overdue ? 'var(--warn-soft)' : '#fff' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>
                        <Link href={`/engagements/${eng.id}`} style={{ color: 'var(--wine)', textDecoration: 'none', fontWeight: 500 }}>{eng.name}</Link>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{eng.company?.name ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-soft)', textTransform: 'capitalize' }}>{eng.stage.replace('_', ' ')}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{eng.lead || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink)', maxWidth: 260 }}>{eng.next_action}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: overdue ? 'var(--warn)' : 'var(--ink-soft)', fontWeight: overdue ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {eng.next_action_date ? fmtDate(eng.next_action_date) : '—'}
                        {overdue && <span style={{ display: 'block', fontSize: 10, color: 'var(--warn)' }}>Overdue</span>}
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => setConvertRow(eng)}
                          title="Convert to task"
                          style={{ fontSize: 11, background: 'var(--line-soft)', border: 'none', borderRadius: 4, padding: '3px 9px', cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}
                        >
                          → Task
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {convertRow && (
          <ConvertModal
            row={convertRow}
            owners={owners}
            onClose={() => setConvertRow(null)}
            onConverted={() => {}}
          />
        )}
      </div>
    )
  }

  // ── Tasks views ────────────────────────────────────────────────────────────
  return (
    <div>
      {showAdd && (
        <QuickAddModal
          engagements={engagements}
          owners={owners}
          onClose={() => setShowAdd(false)}
          onCreated={task => setTasks(prev => [task, ...prev])}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>Owner</span>
          {owners.map(o => <button key={o} onClick={() => setOwnerFilter(o)} style={chipBtn(ownerFilter === o)}>{o === 'all' ? 'All' : o}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {openCount} open{overdueCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {overdueCount} overdue</span>}
          </span>
          <button onClick={() => setShowAdd(true)} style={{ background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 5, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Task</button>
        </div>
      </div>

      {/* View filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>View</span>
        {FILTERS.map(f => <button key={f.value} onClick={() => setFilter(f.value)} style={statusChipBtn(filter === f.value)}>{f.label}</button>)}
      </div>

      {/* Priority legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Priority</span>
        {Object.entries(PRIORITY_COLORS).map(([k, v]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-soft)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot, display: 'inline-block' }} />
            {v.label}
          </span>
        ))}
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 8 }}>· Click date to edit · Click note to expand</span>
      </div>

      {/* Content */}
      {filter === 'all' ? (
        <GroupedView tasks={filtered} onStatusChange={handleStatusChange} onDateChange={handleDateChange} />
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
          No tasks found.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <TaskTable tasks={filtered} onStatusChange={handleStatusChange} onDateChange={handleDateChange} />
        </div>
      )}
    </div>
  )
}
