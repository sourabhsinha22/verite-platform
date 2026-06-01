export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import EngagementsClient from '@/components/engagements/EngagementsClient'

export default async function EngagementsPage() {
  const supabase = await createClient()

  const [{ data: engagements }, { data: tasks }] = await Promise.all([
    supabase.from('engagements').select('*, company:companies(id, name)').order('created_at', { ascending: false }),
    supabase.from('tasks').select('engagement_id, status'),
  ])

  // Build progress map: engagementId → % done
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

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
          Engagements
        </h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 8, marginBottom: 0 }}>
          {(engagements ?? []).length} total · {(engagements ?? []).filter(e => e.stage === 'active').length} active
        </p>
      </div>
      <EngagementsClient engagements={engagements ?? []} progressMap={progressMap} />
    </div>
  )
}
