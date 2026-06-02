export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import EngagementsClient from '@/components/engagements/EngagementsClient'
import { computeHealth } from '@/lib/types'

export default async function EngagementsPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: engagements }, { data: tasks }, { data: invoices }, { data: activityMax }] = await Promise.all([
    supabase.from('engagements').select('*, company:companies(id, name)').order('created_at', { ascending: false }),
    supabase.from('tasks').select('engagement_id, status, due_date'),
    supabase.from('invoices').select('engagement_id, due_date, paid_date'),
    supabase.from('activity_log').select('engagement_id, created_at').order('created_at', { ascending: false }),
  ])

  // Build progress map: engagementId -> % done
  const progressMap: Record<string, number> = {}
  const countMap: Record<string, { done: number; total: number }> = {}
  for (const t of tasks ?? []) {
    if (!countMap[t.engagement_id]) countMap[t.engagement_id] = { done: 0, total: 0 }
    countMap[t.engagement_id].total++
    if (t.status === 'done') countMap[t.engagement_id].done++
  }
  for (const [id, { done, total }] of Object.entries(countMap)) {
    progressMap[id] = total > 0 ? Math.round((done / total) * 100) : 0
  }

  // Build last activity map: engagementId -> latest created_at
  const lastActivityMap: Record<string, string> = {}
  for (const a of activityMax ?? []) {
    if (!lastActivityMap[a.engagement_id]) {
      lastActivityMap[a.engagement_id] = a.created_at
    }
  }

  // Build health map
  const healthMap: Record<string, 'green' | 'yellow' | 'red'> = {}
  for (const eng of engagements ?? []) {
    const engTasks = (tasks ?? []).filter(t => t.engagement_id === eng.id)
    const engInvoices = (invoices ?? []).filter(inv => inv.engagement_id === eng.id)

    const blockedTasks = engTasks.filter(t => t.status === 'blocked').length
    const overdueTasks = engTasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length

    const lastAct = lastActivityMap[eng.id]
    const daysSinceActivity = lastAct
      ? Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000)
      : null

    let overdueInvoiceAging = 0
    for (const inv of engInvoices) {
      if (!inv.paid_date && inv.due_date && inv.due_date < today) {
        const aging = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
        if (aging > overdueInvoiceAging) overdueInvoiceAging = aging
      }
    }

    const sowExpiryDays = eng.end_date
      ? Math.floor((new Date(eng.end_date).getTime() - Date.now()) / 86400000)
      : null

    healthMap[eng.id] = computeHealth({ blockedTasks, overdueTasks, daysSinceActivity, overdueInvoiceAging, sowExpiryDays })
  }

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
          Engagements
        </h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 8, marginBottom: 0 }}>
          {(engagements ?? []).length} total &middot; {(engagements ?? []).filter(e => e.stage === 'active').length} active
        </p>
      </div>
      <EngagementsClient engagements={engagements ?? []} progressMap={progressMap} healthMap={healthMap} />
    </div>
  )
}
