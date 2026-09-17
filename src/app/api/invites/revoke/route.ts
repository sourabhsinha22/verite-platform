import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'Admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { inviteId } = await req.json()
  if (!inviteId) return NextResponse.json({ error: 'inviteId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify the invite belongs to the admin's org
  const { data: invite } = await admin
    .from('org_invites')
    .select('org_id')
    .eq('id', inviteId)
    .single()

  if (!invite || invite.org_id !== currentUser.orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin.from('org_invites').delete().eq('id', inviteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
