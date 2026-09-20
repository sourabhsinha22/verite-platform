export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import EngagementsClient from '@/components/engagements/EngagementsClient'
import { computeHealth } from '@/lib/types'

export default async function EngagementsPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: engagements }, { data: tasks }, { data: invoices }, { data: activityRaw }, { data: teamMembers }, { data: orgMemberships }] = await Promise.all([
    supabase.from('engagements').select('*, org_id, company:companies(id, name)').order('created_at', { ascending: false }),
    supabase.from('tasks').select('engagement_id, status, due_date'),
    supabase.from('invoices').select('engagement_id, due_date, paid_date'),
    supabase.from('activity_log').select('engagement_id, created_at').order('created_at', { ascending: false }),
    supabase.from('team_members').select('id, name').order('name'),
    supabase.from('org_members').select('org_id, orgs(id, name)'),
  ])

  // Build org map: org_id -> org name
  const orgsMap: Record<string, string> = {}
  for (const m of orgMemberships ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = (m.orgs as any) as { id: string; name: string } | null
    if (org) orgsMap[org.id] = org.name
  }
  const isMultiOrg = Object.keys(orgsMap).length > 1

  // Progress map: engagementId -> % done
  const progressMap: Record<string, number> = {}
  const taskCountMap: Record<string, number> = {}
  const countMap: Record<string, { done: number; total: number }> = {}
  for (const t of tasks ?? []) {
    if (!countMap[t.engagement_id]) countMap[t.engagement_id] = { done: 0, total: 0 }
    countMap[t.engagement_id].total++
    if (t.status === 'done') countMap[t.engagement_id].done++
  }
  for (const [id, { done, total }] of Object.entries(countMap)) {
    progressMap[id] = total > 0 ? Math.round((done / total) * 100) : 0
    taskCountMap[id] = total
  }

  // Last activity map: engagementId -> latest created_at
  const lastActivityMap: Record<string, string> = {}
  for (const a of activityRaw ?? []) {
    if (!lastActivityMap[a.engagement_id]) lastActivityMap[a.engagement_id] = a.created_at
  }

  // Health maps
  const healthMap: Record<string, 'green' | 'yellow' | 'red'> = {}
  const healthFactorsMap: Record<string, { blockedTasks: number; overdueTasks: number; overdueInvoiceAging: number; sowExpiryDays: number | null; daysSinceActivity: number | null }> = {}
  for (const eng of engagements ?? []) {
    const engTasks = (tasks ?? []).filter(t => t.engagement_id === eng.id)
    const engInvoices = (invoices ?? []).filter(inv => inv.engagement_id === eng.id)

    const blockedTasks = engTasks.filter(t => t.status === 'blocked').length
    const overdueTasks = engTasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length
    const lastAct = lastActivityMap[eng.id]
    const daysSinceActivity = lastAct ? Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000) : null

    let overdueInvoiceAging = 0
    for (const inv of engInvoices) {
      if (!inv.paid_date && inv.due_date && inv.due_date < today) {
        const aging = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
        if (aging > overdueInvoiceAging) overdueInvoiceAging = aging
      }
    }

    const sowExpiryDays = eng.end_date ? Math.floor((new Date(eng.end_date).getTime() - Date.now()) / 86400000) : null
    healthMap[eng.id] = computeHealth({ blockedTasks, overdueTasks, daysSinceActivity, overdueInvoiceAging, sowExpiryDays })
    healthFactorsMap[eng.id] = { blockedTasks, overdueTasks, overdueInvoiceAging, sowExpiryDays, daysSinceActivity }
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
      <Suspense fallback={<div style={{ color: 'var(--ink-faint)', fontFamily: 'var(--sans)', fontSize: 14 }}>Loading…</div>}>
        <EngagementsClient
          engagements={engagements ?? []}
          progressMap={progressMap}
          taskCountMap={taskCountMap}
          lastActivityMap={lastActivityMap}
          healthMap={healthMap}
          healthFactorsMap={healthFactorsMap}
          teamMembers={teamMembers ?? []}
          orgs={orgsMap}
          isMultiOrg={isMultiOrg}
        />
      </Suspense>
    </div>
  )
}
