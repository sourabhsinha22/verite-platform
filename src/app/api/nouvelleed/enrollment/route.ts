import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body = await request.json()

  const { data: enrollment, error } = await supabase
    .from('nouvelleed_enrollments')
    .insert({
      engagement_id: body.engagement_id,
      report_date: body.report_date,
      total_enrolled: body.total_enrolled ?? 0,
      active_learners: body.active_learners ?? 0,
      completions_this_month: body.completions_this_month ?? 0,
      total_completions: body.total_completions ?? 0,
      ce_certs_issued: body.ce_certs_issued ?? 0,
      modules_live: body.modules_live ?? 0,
      avg_completion_pct: body.avg_completion_pct ?? 0,
      notes: body.notes ?? '',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ enrollment })
}
