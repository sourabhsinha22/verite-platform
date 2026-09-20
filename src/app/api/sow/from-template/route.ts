import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { engagement_id, template_id } = body as {
    engagement_id: string
    template_id?: string
  }

  if (!engagement_id) {
    return NextResponse.json({ ok: false, error: 'Missing engagement_id' }, { status: 400 })
  }

  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  // Fetch engagement + org name for title
  const [{ data: engagement }, { data: org }] = await Promise.all([
    supabase.from('engagements').select('name, revenue_type, contract_value, lead, company:companies(name)').eq('id', engagement_id).single(),
    currentUser?.orgId ? supabase.from('orgs').select('name').eq('id', currentUser.orgId).single() : Promise.resolve({ data: null }),
  ])

  const companyName = (engagement as { company?: { name: string } | null } | null)?.company?.name ?? 'Client'
  const orgName = (org as { name: string } | null)?.name ?? 'Our Organization'
  const defaultTitle = `${orgName} — ${companyName} — Statement of Work`

  let sowInsert: Record<string, unknown> = {
    engagement_id,
    title: defaultTitle,
    version: 1,
    status: 'draft',
    revenue_type: engagement?.revenue_type ?? 'project',
    total_value: engagement?.contract_value ?? null,
    verite_lead: engagement?.lead ?? '',
    verite_signatory: currentUser?.name ?? '',
    payment_terms: 'Net 30',
    billing_frequency: 'monthly',
    objectives: '',
    scope_of_work: '',
    out_of_scope: '',
    assumptions: '',
    client_responsibilities: '',
    notes: '',
  }

  if (template_id) {
    const { data: tmpl, error: tmplErr } = await supabase
      .from('sow_templates')
      .select('*')
      .eq('id', template_id)
      .single()

    if (tmplErr || !tmpl) {
      return NextResponse.json({ ok: false, error: 'Template not found' }, { status: 404 })
    }

    sowInsert = {
      ...sowInsert,
      objectives: tmpl.objectives ?? '',
      scope_of_work: tmpl.scope_of_work ?? '',
      out_of_scope: tmpl.out_of_scope ?? '',
      assumptions: tmpl.assumptions ?? '',
      client_responsibilities: tmpl.client_responsibilities ?? '',
      payment_terms: tmpl.payment_terms ?? 'Net 30',
      billing_frequency: tmpl.billing_frequency ?? 'monthly',
      revenue_type: tmpl.revenue_type ?? sowInsert.revenue_type,
    }
  }

  const { data: sow, error } = await supabase
    .from('sows')
    .insert(sowInsert)
    .select('id')
    .single()

  if (error || !sow) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  // If template has phases, create them as sow_phases
  if (template_id) {
    const { data: tmpl } = await supabase
      .from('sow_templates')
      .select('phases')
      .eq('id', template_id)
      .single()

    const phases = tmpl?.phases
    if (Array.isArray(phases) && phases.length > 0) {
      const phaseInserts = phases.map((p: { title: string; description: string }, i: number) => ({
        sow_id: sow.id,
        title: p.title,
        description: p.description ?? '',
        sort_order: i,
      }))
      await supabase.from('sow_phases').insert(phaseInserts)
    }
  }

  return NextResponse.json({ ok: true, sow_id: sow.id })
}
