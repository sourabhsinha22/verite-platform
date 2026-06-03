import { NextResponse } from 'next/server'

// body: { contact_id: string, sequence_id: string, email: string }
export async function POST(request: Request) {
  const { contact_id, sequence_id, email } = await request.json()
  const { data: integration } = await (await import('@/lib/supabase/admin')).createAdminClient()
    .from('integrations').select('api_key').eq('provider', 'apollo').single()

  if (!integration?.api_key) return NextResponse.json({ error: 'Apollo not connected' }, { status: 400 })

  const resp = await fetch('https://api.apollo.io/v1/emailer_campaigns/' + sequence_id + '/add_contact_ids', {
    method: 'POST',
    headers: { 'X-Api-Key': integration.api_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact_ids: [contact_id] }),
  })

  const data = await resp.json()
  return NextResponse.json({ ok: resp.ok, data })
}
