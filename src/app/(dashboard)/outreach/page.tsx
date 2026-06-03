export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import ProspectSearch from '@/components/outreach/ProspectSearch'

export default async function OutreachPage() {
  // Fetch sequences from Apollo (server-side)
  let sequences: { id: string; name: string; status: string }[] = []
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const seqResp = await fetch(`${baseUrl}/api/apollo/sequences`, { cache: 'no-store' })
    if (seqResp.ok) {
      const seqData = await seqResp.json()
      sequences = seqData.sequences ?? []
    }
  } catch {
    // sequences stays empty — handled gracefully in the client component
  }

  // Fetch team members for assigning leads
  const supabase = await createClient()
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('id, name')
    .order('name')

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--serif)',
          fontSize: 26,
          fontWeight: 600,
          color: 'var(--navy)',
          margin: 0,
          marginBottom: 6,
        }}>
          Outreach
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: 0 }}>
          Search Apollo&#39;s contact database and add prospects to your pipeline
        </p>
      </div>

      <ProspectSearch
        sequences={sequences}
        teamMembers={teamMembers ?? []}
      />
    </div>
  )
}
