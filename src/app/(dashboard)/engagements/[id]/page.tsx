import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Engagement, Task, RevenueItem } from '@/lib/types'
import EngagementDetailClient from '@/components/engagements/EngagementDetailClient'

interface Props {
  params: { id: string }
}

export default async function EngagementDetailPage({ params }: Props) {
  const supabase = await createClient()

  const { data: engagement } = await supabase
    .from('engagements')
    .select('*, company:companies(id, name)')
    .eq('id', params.id)
    .single()

  if (!engagement) notFound()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('engagement_id', params.id)
    .order('sort_order')

  const { data: revenueItems } = await supabase
    .from('revenue_items')
    .select('*')
    .eq('engagement_id', params.id)
    .order('sort_order')

  const eng = engagement as Engagement & { company?: { id: string; name: string } }
  const taskList = (tasks ?? []) as Task[]
  const revenue = (revenueItems ?? []) as RevenueItem[]

  return (
    <div style={{ padding: '40px 56px' }}>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Link href="/engagements" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          color: 'var(--ink-soft)', textDecoration: 'none', fontSize: 13,
        }}>
          <ChevronLeft size={14} /> Engagements
        </Link>
        {eng.company && (
          <Link href={`/directory/${eng.company.id}`} style={{ fontSize: 13, color: 'var(--wine)', textDecoration: 'none' }}>
            {eng.company.name} →
          </Link>
        )}
      </div>

      <EngagementDetailClient engagement={eng} tasks={taskList} revenueItems={revenue} />
    </div>
  )
}
