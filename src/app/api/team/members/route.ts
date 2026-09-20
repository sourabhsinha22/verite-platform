import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'

export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'Admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const { memberId } = await req.json()
  const admin = createAdminClient()
  const { data: member } = await admin.from('team_members').select('auth_user_id').eq('id', memberId).eq('org_id', currentUser.orgId).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  await admin.from('team_members').delete().eq('id', memberId)
  if (member.auth_user_id) await admin.from('org_members').delete().eq('user_id', member.auth_user_id).eq('org_id', currentUser.orgId)
  return NextResponse.json({ ok: true })
}
