export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Engagement } from '@/lib/types'
import PipelineClient from '@/components/pipeline/PipelineClient'

function fmtWeighted(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value).toLocaleString()}`
}

export default async function PipelinePage() {
  const supabase = await createClient()

  const [{ data: engagements }, { data: teamMembers }, { data: teamMembersCalendly }] = await Promise.all([
    supabase
      .from('engagements')
      .select('*, company:companies(id, name), tasks(*)')
      .order('created_at', { ascending: false }),
    supabase
      .from('team_members')
      .select('id, name')
      .order('name'),
    supabase
      .from('team_members')
      .select('name, calendly_url'),
  ])

  const calendlyMap: Record<string, string> = {}
  ;(teamMembersCalendly ?? []).forEach((m: { name: string; calendly_url: string | null }) => {
    if (m.calendly_url) calendlyMap[m.name] = m.calendly_url
  })

  type RawEngagement = Engagement & {
    company?: { id: string; name: string }
    tasks?: { status: string }[]
  }

  const engagementCards = (engagements ?? []).map((eng: RawEngagement) => {
    const tasks = eng.tasks ?? []
    const total = tasks.length
    const done = tasks.filter(t => t.status === 'done').length
    const progress = total > 0 ? Math.round((done / total) * 100) : 0
    const { tasks: _t, ...rest } = eng
    return { ...rest, _progress: progress }
  })

  const totalWeighted = engagementCards.reduce((sum, e) => {
    if (e.stage === 'closed') return sum
    return sum + (e.contract_value ?? 0) * ((e.probability ?? 0) / 100)
  }, 0)

  return (
    <div style={{ padding: '32px 0' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--serif)',
          fontSize: 40,
          fontWeight: 600,
          color: 'var(--navy)',
          letterSpacing: '-0.5px',
          margin: 0,
        }}>
          Pipeline
        </h1>
        <p style={{
          color: 'var(--ink-soft)',
          fontSize: 15,
          fontFamily: 'var(--sans)',
          marginTop: 6,
          marginBottom: 0,
        }}>
          Weighted pipeline value: <strong style={{ color: 'var(--wine)' }}>{fmtWeighted(totalWeighted)}</strong>
        </p>
      </div>

      <PipelineClient
        engagements={engagementCards}
        teamMembers={teamMembers ?? []}
        calendlyMap={calendlyMap}
      />
    </div>
  )
}
