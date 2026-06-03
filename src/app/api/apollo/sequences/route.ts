import { NextResponse } from 'next/server'

export async function GET() {
  const { data: integration } = await (await import('@/lib/supabase/admin')).createAdminClient()
    .from('integrations').select('api_key').eq('provider', 'apollo').single()

  if (!integration?.api_key) return NextResponse.json({ sequences: [] })

  const resp = await fetch('https://api.apollo.io/v1/emailer_campaigns?page=1&per_page=50', {
    headers: { 'X-Api-Key': integration.api_key, 'Content-Type': 'application/json' },
  })

  if (!resp.ok) return NextResponse.json({ sequences: [] })
  const data = await resp.json()
  return NextResponse.json({ sequences: data.emailer_campaigns ?? [] })
}
