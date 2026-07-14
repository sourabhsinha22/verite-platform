import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let currentUser: { name: string; email: string; initials: string; role: string } | undefined

  try {
    const user = await getCurrentUser()
    if (user) {
      currentUser = { name: user.name, email: user.email, initials: user.initials, role: user.role }
    }
  } catch {
    // silently skip — currentUser stays undefined
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar currentUser={currentUser} userRole={currentUser?.role} />
      <main style={{ marginLeft: '240px', flex: 1, padding: '44px 60px', maxWidth: '1400px' }}>
        {children}
      </main>
    </div>
  )
}
