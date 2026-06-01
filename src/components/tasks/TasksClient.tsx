'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Task, TaskStatus, TASK_STATUS_LABELS } from '@/lib/types'
import Badge from '@/components/ui/Badge'

interface TaskRow extends Task {
  engagement?: { id: string; name: string }
}

interface Props {
  tasks: TaskRow[]
}

type Filter = TaskStatus | 'all' | 'overdue'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'done', label: 'Done' },
]

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false
  return new Date(task.due_date) < new Date()
}

export default function TasksClient({ tasks }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true
    if (filter === 'overdue') return isOverdue(t)
    return t.status === filter
  })

  return (
    <div>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', border: 'none',
              background: filter === f.value ? 'var(--navy)' : 'var(--line-soft)',
              color: filter === f.value ? '#fff' : 'var(--ink-soft)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
          padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)',
        }}>
          No tasks found.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['Task', 'Engagement', 'Owner', 'Due Date', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px', fontSize: 10,
                    color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((task, i) => {
                const overdue = isOverdue(task)
                return (
                  <tr
                    key={task.id}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined,
                      background: overdue ? 'var(--danger-soft)' : undefined,
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                      {task.title}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13 }}>
                      {task.engagement ? (
                        <Link href={`/engagements/${task.engagement.id}`} style={{ color: 'var(--wine)', textDecoration: 'none' }}>
                          {task.engagement.name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>
                      {task.owner || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: overdue ? 'var(--danger)' : 'var(--ink-soft)', fontWeight: overdue ? 600 : 400 }}>
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Badge status={task.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
