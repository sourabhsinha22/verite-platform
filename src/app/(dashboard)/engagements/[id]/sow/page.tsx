export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SowClient from '@/components/sow/SowClient'
import { Engagement, Sow } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SowPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: engagement }, { data: sows }, { data: teamMembers }] = await Promise.all([
    supabase
      .from('engagements')
      .select('*, company:companies(id, name)')
      .eq('id', id)
      .single(),
    supabase
      .from('sows')
      .select('*, phases:sow_phases(*, deliverables:sow_deliverables(*)), deliverables:sow_deliverables(*)')
      .eq('engagement_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('team_members')
      .select('id, name')
      .order('name'),
  ])

  if (!engagement) {
    return (
      <div style={{ padding: 48, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
        Engagement not found.{' '}
        <Link href="/engagements" style={{ color: 'var(--wine)', textDecoration: 'underline' }}>
          Back to engagements
        </Link>
      </div>
    )
  }

  const sow: Sow | null = sows && sows.length > 0 ? sows[0] : null
  const companyName = (engagement as Engagement & { company?: { id: string; name: string } }).company?.name ?? 'Client'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 8px' }}>
      {/* Back link */}
      <Link
        href={`/engagements/${id}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--ink-soft)',
          fontSize: 14,
          fontFamily: 'var(--sans)',
          textDecoration: 'none',
          marginBottom: 24,
        }}
      >
        ← {engagement.name}
      </Link>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 40,
            fontWeight: 600,
            color: 'var(--navy)',
            letterSpacing: '-0.5px',
            margin: 0,
          }}
        >
          Statement of Work
        </h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 6, marginBottom: 0, fontFamily: 'var(--sans)', fontSize: 15 }}>
          {engagement.name}
          {companyName ? ` · ${companyName}` : ''}
        </p>
      </div>

      <SowClient
        engagement={engagement as Engagement & { company?: { id: string; name: string } }}
        sow={sow}
        teamMembers={teamMembers ?? []}
        engagementId={id}
      />
    </div>
  )
}
