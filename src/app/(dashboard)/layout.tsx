import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let currentUser: { name: string; email: string; initials: string; role: string } | undefined
  let brandVars = ''
  let isSuperAdmin = false

  try {
    const user = await getCurrentUser()
    if (user) {
      currentUser = { name: user.name, email: user.email, initials: user.initials, role: user.role }
      const adminDb = createAdminClient()
      const { data: pa } = await adminDb.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
      isSuperAdmin = !!pa
      if (user.orgBrand) {
        const b = user.orgBrand
        const vars: string[] = []
        if (b.primary) vars.push(`--navy: ${b.primary}`)
        if (b.accent) vars.push(`--wine: ${b.accent}`)
        if (vars.length) brandVars = `:root { ${vars.join('; ')} }`
      }
    }
  } catch {
    // silently skip — currentUser stays undefined
  }

  return (
    <>
      {brandVars && <style dangerouslySetInnerHTML={{ __html: brandVars }} />}
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar currentUser={currentUser} userRole={currentUser?.role} isSuperAdmin={isSuperAdmin} />
        <main style={{ marginLeft: '240px', flex: 1, padding: '44px 60px', maxWidth: '1400px' }}>
          {children}
        </main>
      </div>
    </>
  )
}
