export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import IntegrationsClient from '@/components/settings/IntegrationsClient'
import Link from 'next/link'

export default async function IntegrationsPage() {
  const supabase = await createClient()

  const [{ data: integration }, { data: events }] = await Promise.all([
    supabase.from('integrations').select('*').eq('provider', 'apollo').single(),
    supabase
      .from('webhook_events')
      .select('id, created_at, event_type, contact_email, contact_name, result')
      .eq('provider', 'apollo')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{
        fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600,
        color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0, marginBottom: 8,
      }}>
        Integrations
      </h1>
      <p style={{ color: 'var(--ink-soft)', marginTop: 0, marginBottom: 28 }}>
        Connect external tools to automate your pipeline
      </p>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid var(--line)',
        marginBottom: 32,
      }}>
        <Link
          href="/settings/integrations"
          style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            color: 'var(--wine)', borderBottom: '2px solid var(--wine)',
            marginBottom: -2, display: 'inline-block',
          }}
        >
          Apollo.io
        </Link>
      </div>

      <IntegrationsClient
        integration={integration ?? null}
        recentEvents={events ?? []}
      />
    </div>
  )
}
