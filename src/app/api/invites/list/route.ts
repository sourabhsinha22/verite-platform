import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'Admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!currentUser.orgId) {
    return NextResponse.json({ invites: [] })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('org_invites')
    .select('id, email, role, created_at, expires_at, accepted_at, invited_by')
    .eq('org_id', currentUser.orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with inviter name from team_members
  const inviterIds = [...new Set(data?.map(i => i.invited_by).filter(Boolean))]
  let inviterMap: Record<string, string> = {}
  if (inviterIds.length) {
    const { data: inviters } = await admin
      .from('team_members')
      .select('auth_user_id, name')
      .in('auth_user_id', inviterIds)
    inviterMap = Object.fromEntries((inviters ?? []).map(m => [m.auth_user_id, m.name]))
  }

  const invites = (data ?? []).map(i => ({
    ...i,
    inviter_name: inviterMap[i.invited_by] ?? null,
    status: i.accepted_at
      ? 'accepted'
      : new Date(i.expires_at) < new Date()
        ? 'expired'
        : 'pending',
  }))

  return NextResponse.json({ invites })
}
