export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, FileText } from 'lucide-react'
import { Engagement, Task, RevenueItem } from '@/lib/types'
import EngagementDetailClient from '@/components/engagements/EngagementDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EngagementDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: engagement }, { data: tasks }, { data: revenueItems }, { data: sows }] = await Promise.all([
    supabase.from('engagements').select('*, company:companies(id, name)').eq('id', id).single(),
    supabase.from('tasks').select('*').eq('engagement_id', id).order('sort_order'),
    supabase.from('revenue_items').select('*').eq('engagement_id', id).order('sort_order'),
    supabase.from('sows').select('id, title, status, version').eq('engagement_id', id).order('created_at', { ascending: false }).limit(1),
  ])

  if (!engagement) notFound()

  const eng = engagement as Engagement & { company?: { id: string; name: string } }
  const taskList = (tasks ?? []) as Task[]
  const revenue = (revenueItems ?? []) as RevenueItem[]
  const latestSow = sows?.[0] ?? null

  return (
    <div>
      {/* Back + breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Link href="/engagements" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          color: 'var(--ink-soft)', textDecoration: 'none', fontSize: 13,
        }}>
          <ChevronLeft size={14} /> Engagements
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {eng.company && (
            <Link href={`/directory/${eng.company.id}`} style={{ fontSize: 13, color: 'var(--wine)', textDecoration: 'none' }}>
              {eng.company.name} →
            </Link>
          )}
          <Link
            href={`/engagements/${id}/sow`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 4, fontSize: 12, fontWeight: 500,
              background: latestSow ? 'var(--success-soft)' : 'var(--surface)',
              border: `1px solid ${latestSow ? 'rgba(45,106,62,0.3)' : 'var(--line)'}`,
              color: latestSow ? 'var(--success)' : 'var(--ink-soft)',
              textDecoration: 'none',
            }}
          >
            <FileText size={13} />
            {latestSow ? `SOW · ${latestSow.status.charAt(0).toUpperCase() + latestSow.status.slice(1)}` : 'Create SOW'}
          </Link>
        </div>
      </div>

      <EngagementDetailClient engagement={eng} tasks={taskList} revenueItems={revenue} />
    </div>
  )
}
