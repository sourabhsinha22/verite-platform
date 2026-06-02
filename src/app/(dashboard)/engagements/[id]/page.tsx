export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, FileText } from 'lucide-react'
import { Engagement, Task, RevenueItem, ActivityEntry, Document } from '@/lib/types'
import EngagementDetailClient from '@/components/engagements/EngagementDetailClient'
import DocumentsSection from '@/components/documents/DocumentsSection'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EngagementDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: engagement }, { data: tasks }, { data: revenueItems }, { data: sows }, { data: activityLog }, { data: documents }, { data: teamMember }] = await Promise.all([
    supabase.from('engagements').select('*, company:companies(id, name)').eq('id', id).single(),
    supabase.from('tasks').select('*').eq('engagement_id', id).order('sort_order'),
    supabase.from('revenue_items').select('*').eq('engagement_id', id).order('sort_order'),
    supabase.from('sows').select('id, title, status, version').eq('engagement_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('activity_log').select('*').eq('engagement_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('documents').select('*').eq('engagement_id', id).order('created_at', { ascending: false }),
    user ? supabase.from('team_members').select('name').eq('auth_user_id', user.id).single() : Promise.resolve({ data: null }),
  ])

  if (!engagement) notFound()

  const eng = engagement as Engagement & { company?: { id: string; name: string } }
  const taskList = (tasks ?? []) as Task[]
  const revenue = (revenueItems ?? []) as RevenueItem[]
  const latestSow = sows?.[0] ?? null
  const log = (activityLog ?? []) as ActivityEntry[]
  const docList = (documents ?? []) as Document[]
  const currentUserName = (teamMember as { name: string } | null)?.name ?? ''

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

      <EngagementDetailClient engagement={eng} tasks={taskList} revenueItems={revenue} activityLog={log} />
      <DocumentsSection engagementId={id} currentUserName={currentUserName} initialDocuments={docList} />
    </div>
  )
}
