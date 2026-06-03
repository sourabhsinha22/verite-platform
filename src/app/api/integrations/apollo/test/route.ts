import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data: integration } = await supabase
      .from('integrations')
      .select('api_key')
      .eq('provider', 'apollo')
      .single()

    if (!integration?.api_key) {
      return NextResponse.json({ ok: false, error: 'No API key configured.' })
    }

    const res = await fetch('https://api.apollo.io/v1/auth/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': integration.api_key,
      },
    })

    if (res.ok) {
      return NextResponse.json({ ok: true, healthy: true })
    } else {
      const text = await res.text()
      return NextResponse.json({ ok: false, error: `Apollo returned ${res.status}: ${text.slice(0, 200)}` })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message })
  }
}
