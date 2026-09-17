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
  ] = await Promise.all([
    adminDb.from('orgs').select('id, name, slug, brand, created_at').order('name'),
    adminDb.from('org_members').select('org_id, user_id, role, created_at'),
    adminDb.from('org_invites').select('id, org_id, email, role, created_at, accepted_at, expires_at').order('created_at', { ascending: false }),
  ])

  // Enrich orgs with member counts
  const orgList = (orgs ?? []).map(org => ({
    ...org,
    memberCount: (members ?? []).filter(m => m.org_id === org.id).length,
    pendingInvites: (invites ?? []).filter(i =>
      i.org_id === org.id && !i.accepted_at && new Date(i.expires_at) > new Date()
    ).length,
  }))

  return <AdminClient orgs={orgList} currentUserId={currentUser.id} />
}
