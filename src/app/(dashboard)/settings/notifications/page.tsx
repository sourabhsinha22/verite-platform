export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NotificationSettings } from '@/lib/types'
import NotificationSettingsClient from '@/components/settings/NotificationSettingsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()

  let teamMemberId = ''
  let notificationSettings: NotificationSettings | null = null

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await supabase
        .from('team_members')
        .select('id, name, email')
        .eq('auth_user_id', user.id)
        .single()

      if (member) {
        teamMemberId = member.id

        const { data: ns } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('team_member_id', member.id)
          .single()

        notificationSettings = ns as NotificationSettings | null
      }
    }
  } catch {
    // proceed with defaults
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{
        fontFamily: 'var(--serif)', fontSize: 38, fontWeight: 600,
        color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 8px',
      }}>
        Notifications
      </h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 32px', fontSize: 14 }}>
        Choose when you want to receive email notifications.
      </p>

      <NotificationSettingsClient
        settings={notificationSettings}
        teamMemberId={teamMemberId}
      />
    </div>
  )
}
