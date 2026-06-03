import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const { data: integration } = await (await import('@/lib/supabase/admin')).createAdminClient()
    .from('integrations').select('api_key').eq('provider', 'apollo').single()

  if (!integration?.api_key) return NextResponse.json({ error: 'Apollo not connected' }, { status: 400 })

  const resp = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: { 'X-Api-Key': integration.api_key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify({ ...body, page: body.page ?? 1, per_page: body.per_page ?? 25 }),
  })

  const data = await resp.json()
  if (!resp.ok) return NextResponse.json({ error: data.message ?? 'Apollo search failed', details: data }, { status: resp.status })
  return NextResponse.json(data)
}
