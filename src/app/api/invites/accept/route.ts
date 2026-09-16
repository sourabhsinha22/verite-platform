import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { token, name } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = await createClient()
  const admin = createAdminClient()

  // Must be authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Validate invite (admin bypass RLS)
  const { data: invite, error: inviteErr } = await admin
    .from('org_invites')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
  }

  if (invite.email !== user.email) {
    return NextResponse.json({ error: 'Invite is for a different email address' }, { status: 403 })
  }

  // Add to org_members
  const { error: memberErr } = await admin.from('org_members').upsert({
    org_id: invite.org_id,
    user_id: user.id,
    role: invite.role,
    invited_by: invite.invited_by,
  }, { onConflict: 'org_id,user_id' })

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

  // Upsert into team_members for display info (name, email, role)
  const displayName = name?.trim() || user.email?.split('@')[0] || 'User'
  await admin.from('team_members').upsert({
    email: user.email,
    name: displayName,
    role: invite.role,
    auth_user_id: user.id,
    org_id: invite.org_id,
    user_id: user.id,
  }, { onConflict: 'email' })

  // Mark invite as accepted
  await admin.from('org_invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id)

  return NextResponse.json({ ok: true })
}
