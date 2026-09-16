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
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch display info from team_members (name, email) and role from org_members (authoritative)
  const [{ data: member }, { data: orgMembership }] = await Promise.all([
    supabase.from('team_members').select('name, role').eq('auth_user_id', user.id).single(),
    supabase.from('org_members').select('role, org_id, orgs(id, slug, brand)').eq('user_id', user.id).limit(1).single(),
  ])

  const name = member?.name ?? user.email?.split('@')[0] ?? 'User'
  // org_members is authoritative for role; fall back to team_members, then Partner
  const role = (orgMembership?.role ?? member?.role ?? 'Partner') as string
  const initials = name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = (orgMembership?.orgs as any) as { id: string; slug: string; brand: Record<string, string> } | null
  return {
    id: user.id,
    email: user.email ?? '',
    name,
    role,
    initials,
    orgId: orgMembership?.org_id ?? null,
    orgSlug: org?.slug ?? null,
    orgBrand: org?.brand ?? null,
  }
}

export function isAdmin(role: string) { return role === 'Admin' }
export function isPartner(role: string) { return role === 'Partner' || role === 'Admin' }
export function canAccessFinance(role: string) { return role === 'Admin' || role === 'Partner' }
export function canManageTeam(role: string) { return role === 'Admin' }
