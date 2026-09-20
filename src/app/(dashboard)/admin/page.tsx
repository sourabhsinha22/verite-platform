export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const currentUser = await getCurrentUser()

  // Super Admin only — platform_admins table
  const adminDb = createAdminClient()
  const { data: isSuperAdmin } = await adminDb
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', currentUser?.id ?? '')
    .maybeSingle()

  if (!currentUser || !isSuperAdmin) {
    redirect('/dashboard')
  }

  const [
    { data: orgs },
    { data: members },
    { data: invites },
    { data: teamMembers },
  ] = await Promise.all([
    adminDb.from('orgs').select('id, name, slug, brand, created_at').order('name'),
    adminDb.from('org_members').select('org_id, user_id, role, created_at'),
    adminDb.from('org_invites').select('id, org_id, email, role, created_at, accepted_at, expires_at').order('created_at', { ascending: false }),
    adminDb.from('team_members').select('auth_user_id, email, org_id, role'),
  ])

  // Enrich orgs with member counts and member details
  const orgList = (orgs ?? []).map(org => {
    const orgMembers = (members ?? []).filter(m => m.org_id === org.id)
    return {
      ...org,
      memberCount: orgMembers.length,
      pendingInvites: (invites ?? []).filter(i =>
        i.org_id === org.id && !i.accepted_at && new Date(i.expires_at) > new Date()
      ).length,
      members: orgMembers.map(m => {
        const tm = (teamMembers ?? []).find(t => t.auth_user_id === m.user_id && t.org_id === org.id)
        return { userId: m.user_id, role: m.role, email: tm?.email ?? undefined }
      }),
    }
  })

  return <AdminClient orgs={orgList} currentUserId={currentUser.id} />
}
