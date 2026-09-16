export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AcceptInviteClient from './AcceptInviteClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function AcceptInvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  // Validate token (service role so we can read org_invites despite RLS)
  const admin = createAdminClient()
  const { data: invite, error } = await admin
    .from('org_invites')
    .select('*, orgs(name, slug, brand)')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !invite) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans, system-ui)', background: '#faf9f7' }}>
        <div style={{ maxWidth: 440, padding: '48px 40px', background: '#fff', border: '1px solid #e8e4de', borderRadius: 12, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 600, color: '#25314a', marginBottom: 12 }}>Link expired</h1>
          <p style={{ color: '#5f5f6e', fontSize: 15, lineHeight: 1.6 }}>
            This invitation link is no longer valid. It may have expired or already been used.
          </p>
          <p style={{ color: '#5f5f6e', fontSize: 14, marginTop: 16 }}>Contact your admin to send a new invite.</p>
        </div>
      </div>
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  const org = invite.orgs as { name: string; slug: string; brand: Record<string, string> }
  const productName = org?.brand?.product_name ?? org?.name ?? 'the platform'
  const primary = org?.brand?.primary ?? '#2f2e4b'
  const accent = org?.brand?.accent ?? '#5f3e3f'

  return (
    <AcceptInviteClient
      token={token}
      inviteEmail={invite.email}
      role={invite.role}
      orgName={org?.name ?? ''}
      productName={productName}
      primary={primary}
      accent={accent}
      isLoggedIn={!!user}
      loggedInEmail={user?.email ?? null}
    />
  )
}
