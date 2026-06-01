import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let currentUser: { name: string; email: string; initials: string } | undefined

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: member } = await supabase
        .from('team_members')
        .select('name, email, auth_user_id')
        .eq('auth_user_id', user.id)
        .single()

      if (member) {
        const parts = (member.name ?? '').trim().split(/\s+/)
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : (parts[0]?.[0] ?? '?').toUpperCase()
        currentUser = { name: member.name, email: member.email, initials }
      }
    }
  } catch {
    // silently skip — currentUser stays undefined
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar currentUser={currentUser} />
      <main style={{ marginLeft: '240px', flex: 1, padding: '44px 60px', maxWidth: '1400px' }}>
        {children}
      </main>
    </div>
  )
}
