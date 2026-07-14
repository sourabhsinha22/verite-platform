import { createClient } from '@/lib/supabase/server'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: 'Admin' | 'Partner' | 'Associate' | string
  initials: string
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('team_members')
    .select('name, role')
    .eq('auth_user_id', user.id)
    .single()

  const name = member?.name ?? user.email?.split('@')[0] ?? 'User'
  // Degrade to Partner (not Associate) so existing users without a record don't get locked out
  const role = member?.role ?? 'Partner'
  const initials = name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)

  return { id: user.id, email: user.email ?? '', name, role, initials }
}

export function isAdmin(role: string) { return role === 'Admin' }
export function isPartner(role: string) { return role === 'Partner' || role === 'Admin' }
export function canAccessFinance(role: string) { return role === 'Admin' || role === 'Partner' }
export function canManageTeam(role: string) { return role === 'Admin' }
