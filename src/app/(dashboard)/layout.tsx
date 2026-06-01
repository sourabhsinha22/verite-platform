import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ marginLeft: '240px', flex: 1, padding: '44px 60px', maxWidth: '1400px' }}>
        {children}
      </main>
    </div>
  )
}
