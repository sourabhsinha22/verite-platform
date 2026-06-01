import { createClient } from '@/lib/supabase/server'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
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
      <SettingsClient members={members ?? []} />
    </div>
  )
}

