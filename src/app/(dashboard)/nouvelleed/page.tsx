export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import NouvelleEDClient from '@/components/nouvelleed/NouvelleEDClient'

export default async function NouvelleEDPage() {
  const supabase = await createClient()

  const [{ data: engagements }, { data: enrollments }] = await Promise.all([
    supabase
      .from('engagements')
      .select('id, name, stage, lead, contract_value, company:companies(id, name)')
      .eq('engagement_category', 'nouvelleed')
      .order('created_at', { ascending: false }),
    supabase
      .from('nouvelleed_enrollments')
      .select('*')
      .order('report_date', { ascending: false }),
  ])

  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#9a9aa5' }}>Loading…</div>}>
      <NouvelleEDClient
        engagements={engagements ?? []}
        enrollments={enrollments ?? []}
      />
    </Suspense>
  )
}
