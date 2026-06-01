export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import TasksClient from '@/components/tasks/TasksClient'

export default async function TasksPage() {
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, engagement:engagements(id, name)')
    .order('due_date', { ascending: true, nullsFirst: false })

  const open = (tasks ?? []).filter(t => t.status !== 'done').length
  const overdue = (tasks ?? []).filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()).length

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
        My Tasks
      </h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 36px' }}>
        {open} open &middot; {overdue > 0 ? <span style={{ color: 'var(--danger)' }}>{overdue} overdue</span> : '0 overdue'} &middot; {(tasks ?? []).length} total
      </p>
      <TasksClient tasks={tasks ?? []} />
    </div>
  )
}

