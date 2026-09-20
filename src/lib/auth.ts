import { createClient } from '@/lib/supabase/server'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: 'Admin' | 'Partner' | 'Associate' | string
  initials: string
  orgId: string | null
  orgSlug: string | null
  orgBrand: Record<string, string> | null
  orgName: string | null
  allOrgs: { id: string; name: string; slug: string; role: string }[]
}

export async function getCurrentUser(activeOrgId?: string): Promise<CurrentUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch display info from team_members (name, email) and all org memberships
  const [{ data: member }, { data: orgMemberships }] = await Promise.all([
    supabase.from('team_members').select('name, role').eq('auth_user_id', user.id).single(),
    supabase.from('org_members').select('role, org_id, orgs(id, slug, brand, name)').eq('user_id', user.id),
  ])

  const name = member?.name ?? user.email?.split('@')[0] ?? 'User'
  const initials = name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)

  // Build allOrgs list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allOrgs = (orgMemberships ?? []).map((m: any) => {
    const org = m.orgs as { id: string; slug: string; name: string; brand: Record<string, string> } | null
    return {
      id: m.org_id as string,
      name: org?.name ?? '',
      slug: org?.slug ?? '',
      role: m.role as string,
    }
  })

  // Pick active org: prefer activeOrgId if it exists in memberships, else first
  const activeMembership = (activeOrgId ? (orgMemberships?.find((m: any) => m.org_id === activeOrgId) ?? null) : null)
    ?? orgMemberships?.[0]
    ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = (activeMembership?.orgs as any) as { id: string; slug: string; brand: Record<string, string>; name: string } | null
  // org_members is authoritative for role; fall back to team_members, then Partner
  const role = (activeMembership?.role ?? member?.role ?? 'Partner') as string

  return {
    id: user.id,
    email: user.email ?? '',
    name,
    role,
    initials,
    orgId: activeMembership?.org_id ?? null,
    orgSlug: org?.slug ?? null,
    orgBrand: org?.brand ?? null,
    orgName: org?.name ?? null,
    allOrgs,
  }
}

export function isAdmin(role: string) { return role === 'Admin' }
export function isPartner(role: string) { return role === 'Partner' || role === 'Admin' }
export function canAccessFinance(role: string) { return role === 'Admin' || role === 'Partner' }
export function canManageTeam(role: string) { return role === 'Admin' }
