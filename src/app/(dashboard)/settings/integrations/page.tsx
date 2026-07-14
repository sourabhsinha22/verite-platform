export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import IntegrationsClient from '@/components/settings/IntegrationsClient'

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!isAdmin(currentUser?.role ?? '')) redirect('/dashboard')

  const { tab = 'apollo' } = await searchParams
  const supabase = await createClient()

  const [{ data: apolloIntegration }, { data: events }] = await Promise.all([
    supabase.from('integrations').select('*').eq('provider', 'apollo').single(),
    supabase
      .from('webhook_events')
      .select('id, created_at, event_type, contact_email, contact_name, result')
      .eq('provider', 'apollo')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const stripeConfigured = !!(
    process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  )

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

      <IntegrationsClient
        integration={apolloIntegration ?? null}
        recentEvents={events ?? []}
        activeTab={tab}
        stripeConfigured={stripeConfigured}
      />
    </div>
  )
}
