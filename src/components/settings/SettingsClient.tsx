'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TeamMember } from '@/lib/types'
import { Trash2 } from 'lucide-react'

interface Props {
  members: TeamMember[]
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
  background: 'var(--bg)', border: '1px solid var(--line)',
  borderRadius: 4, padding: '7px 10px', width: '100%', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)',
  textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4, display: 'block',
}

export default function SettingsClient({ members: initialMembers }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: '', calendly_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addMember = async () => {
    if (!form.name || !form.email) return
    setError('')
    setSaving(true)
    const { data, error: err } = await supabase.from('team_members').insert(form).select().single()
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data) {
      setMembers(prev => [...prev, data])
      setForm({ name: '', email: '', role: '', calendly_url: '' })
      setShowAdd(false)
    }
  }

  const deleteMember = async (id: string) => {
    if (!confirm('Remove this team member?')) return
    const { error: err } = await supabase.from('team_members').delete().eq('id', id)
    if (err) {
      alert('Failed to remove member: ' + err.message)
      return
    }
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  const updateCalendly = async (id: string, url: string) => {
    const trimmed = url.trim()
    await supabase.from('team_members').update({ calendly_url: trimmed }).eq('id', id)
    setMembers(prev => prev.map(m => m.id === id ? { ...m, calendly_url: trimmed } : m))
  }

  return (
    <div>
      {/* Team Members */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 32 }}>
        <div style={{ padding: '16px 20px', background: 'var(--line-soft)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>Team Members</span>
          <button
            onClick={() => setShowAdd(v => !v)}
            style={{ background: 'var(--wine)', color: '#fff', padding: '7px 14px', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer' }}
          >
            + Add Member
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', background: '#fffaf7' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} placeholder="e.g. Analyst" />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Calendly URL (optional)</label>
              <input
                value={form.calendly_url}
                onChange={e => setForm(f => ({ ...f, calendly_url: e.target.value }))}
                style={inputStyle}
                placeholder="https://calendly.com/..."
                type="url"
              />
            </div>
            {error && (
              <div style={{ marginBottom: 10, padding: '7px 12px', background: 'var(--danger-soft)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addMember} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', padding: '7px 14px', borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button onClick={() => { setShowAdd(false); setError('') }} style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)', padding: '7px 14px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {members.length === 0 ? (
          <div style={{ padding: '32px 24px', color: 'var(--ink-faint)', fontSize: 13 }}>No team members yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['Name', 'Email', 'Role', 'Meeting Link', ''].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 20px', fontSize: 10,
                    color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 500, color: 'var(--navy)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: 'var(--blush)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 600, color: 'var(--wine)', flexShrink: 0,
                      }}>
                        {m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      {m.name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--ink-soft)' }}>{m.email}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--ink-soft)' }}>{m.role || '—'}</td>
                  <td style={{ padding: '14px 20px', minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        defaultValue={m.calendly_url ?? ''}
                        placeholder="https://calendly.com/..."
                        type="url"
                        onBlur={e => updateCalendly(m.id, e.target.value)}
                        style={{
                          ...inputStyle,
                          fontSize: 12,
                          padding: '5px 8px',
                          flex: 1,
                          minWidth: 0,
                        }}
                      />
                      {m.calendly_url && (
                        <a
                          href={m.calendly_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Calendly link"
                          style={{
                            fontSize: 15,
                            textDecoration: 'none',
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          🔗
                        </a>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', width: 40 }}>
                    <button
                      onClick={() => deleteMember(m.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', padding: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
