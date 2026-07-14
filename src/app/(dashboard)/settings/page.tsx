export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const currentUser = await getCurrentUser()

  if (currentUser?.role === 'Associate') {
    return (
      <div style={{ maxWidth: 860 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0, marginBottom: 8 }}>
          Settings
        </h1>
        <div style={{ marginTop: 40, padding: '28px 32px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink-soft)', fontSize: 15 }}>
          Access denied — contact your admin to change workspace settings.
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .order('name')

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0, marginBottom: 8 }}>
        Settings
      </h1>
      <p style={{ color: 'var(--ink-soft)', marginTop: 0, marginBottom: 36 }}>
        Manage your team and workspace
      </p>

      {/* Your Role */}
      {currentUser && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '16px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Your Role</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)' }}>{currentUser.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 4,
                background: currentUser.role === 'Admin' ? 'var(--navy)' : currentUser.role === 'Partner' ? 'var(--wine)' : '#e8eaf0',
                color: currentUser.role === 'Admin' || currentUser.role === 'Partner' ? '#fff' : 'var(--ink)',
              }}>
                {currentUser.role}
              </span>
            </div>
          </div>
        </div>
      )}

      <SettingsClient members={members ?? []} currentUserId={currentUser?.id} isAdmin={currentUser?.role === 'Admin'} />
    </div>
  )
}
