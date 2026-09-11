import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body = await request.json()

  const { name, org, email, phone, role, org_type, interest, message, source } = body

  if (!name || !email || !org) {
    return NextResponse.json({ error: 'Name, email, and organization are required.' }, { status: 400 })
  }

  // Upsert company
  let companyId: string | null = null
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', org.trim())
    .single()

  if (existingCompany) {
    companyId = existingCompany.id
  } else {
    const { data: newCompany } = await supabase
      .from('companies')
      .insert({ name: org.trim(), tag: 'prospect', industry: org_type ?? '' })
      .select('id')
      .single()
    companyId = newCompany?.id ?? null
  }

  // Create contact
  if (companyId) {
    await supabase.from('contacts').insert({
      company_id: companyId,
      name: name.trim(),
      email: email.trim(),
      phone: phone ?? '',
      title: role ?? '',
      is_primary: true,
    })
  }

  // Create engagement (lead stage)
  await supabase.from('engagements').insert({
    company_id: companyId,
    name: `${org.trim()} — Inbound Lead`,
    stage: 'lead',
    source: 'inbound',
    notes: [
      interest ? `Interest: ${interest}` : '',
      message ? `Message: ${message}` : '',
      source ? `Source: ${source}` : '',
    ].filter(Boolean).join('\n'),
  })

  return NextResponse.json({ ok: true })
}
