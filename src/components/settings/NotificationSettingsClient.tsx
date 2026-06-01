'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotificationSettings } from '@/lib/types'

interface Props {
  settings: NotificationSettings | null
  teamMemberId: string
}

interface ToggleSetting {
  key: keyof Pick<NotificationSettings, 'notify_overdue_invoices' | 'notify_tasks_due' | 'notify_new_engagement' | 'notify_task_assigned'>
  label: string
  description: string
}

const TOGGLES: ToggleSetting[] = [
  {
    key: 'notify_overdue_invoices',
    label: 'Overdue Invoices',
    description: 'Receive an email when an invoice becomes overdue.',
  },
  {
    key: 'notify_tasks_due',
    label: 'Tasks Due Tomorrow',
    description: 'Get a daily digest of tasks due the next day.',
  },
  {
    key: 'notify_new_engagement',
    label: 'New Engagement Assigned',
    description: 'Notify me when a new engagement is assigned to me.',
  },
  {
    key: 'notify_task_assigned',
    label: 'Task Assigned',
    description: 'Notify me when a task is assigned to me.',
  },
]

export default function NotificationSettingsClient({ settings: initialSettings, teamMemberId }: Props) {
  const supabase = createClient()
  const [settings, setSettings] = useState<Partial<NotificationSettings>>(initialSettings ?? {
    notify_overdue_invoices: true,
    notify_tasks_due: true,
    notify_new_engagement: true,
    notify_task_assigned: true,
  })
  const [saveMsg, setSaveMsg] = useState('')

  const handleToggle = async (key: ToggleSetting['key'], value: boolean) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)

    if (initialSettings?.id) {
      await supabase
        .from('notification_settings')
        .update({ [key]: value })
        .eq('id', initialSettings.id)
    } else {
      await supabase
        .from('notification_settings')
        .upsert({
          team_member_id: teamMemberId,
          ...updated,
        })
    }

    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  return (
    <div>
      {saveMsg && (
        <div style={{
          marginBottom: 16, padding: '8px 14px', borderRadius: 4,
          background: 'var(--success-soft)', color: 'var(--success)',
          fontSize: 13, fontWeight: 500, display: 'inline-block',
        }}>
          {saveMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        {TOGGLES.map((toggle, i) => {
          const enabled = !!(settings[toggle.key] ?? false)
          return (
            <div
              key={toggle.key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '18px 24px',
                borderTop: i > 0 ? '1px solid var(--line-soft)' : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                  {toggle.label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  {toggle.description}
                </div>
              </div>

              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={enabled}
                onClick={() => handleToggle(toggle.key, !enabled)}
                style={{
                  position: 'relative',
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: 'none',
                  background: enabled ? 'var(--wine)' : 'var(--line)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                  marginLeft: 24,
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: enabled ? 'calc(100% - 20px)' : '4px',
                    transform: 'translateY(-50%)',
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    display: 'block',
                  }}
                />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
