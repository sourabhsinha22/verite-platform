'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TeamMember } from '@/lib/types'
import { Trash2, Mail, RotateCcw, X } from 'lucide-react'

interface OrgInvite {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
  accepted_at: string | null
  inviter_name: string | null
  status: 'pending' | 'accepted' | 'expired'
}

interface Props {
  members: TeamMember[]
  currentUserId?: string
  isAdmin?: boolean
}

const ROLES = ['Admin', 'Partner', 'Associate'] as const

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
  background: 'var(--bg)', border: '1px solid var(--line)',
  borderRadius: 4, padding: '7px 10px', width: '100%', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)',
  textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4, display: 'block',
}

function RoleChip({ role }: { role: string }) {
  const bg = role === 'Admin' ? 'var(--navy)' : role === 'Partner' ? 'var(--wine)' : '#e8eaf0'
  const color = role === 'Admin' || role === 'Partner' ? '#fff' : 'var(--ink)'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 4, background: bg, color, flexShrink: 0,
    }}>
      {role || '—'}
    </span>
  )
}

function StatusPill({ status }: { status: OrgInvite['status'] }) {
  const styles: Record<string, React.CSSProperties> = {
    pending:  { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' },
    accepted: { background: '#f0fdf4', color: '#166534', border: '1px solid #86efac' },
    expired:  { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' },
  }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 4, ...styles[status],
    }}>
      {status}
    </span>
  )
}

export default function SettingsClient({ members: initialMembers, currentUserId, isAdmin }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'Associate' as string })
  const [inviteSent, setInviteSent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)

  // Branding state
  const [brandPrimary, setBrandPrimary] = useState('#2f2e4b')
  const [brandAccent, setBrandAccent] = useState('#5f3e3f')
  const [brandSaving, setBrandSaving] = useState(false)
  const [brandToast, setBrandToast] = useState('')

  // Pending invites state
  const [invites, setInvites] = useState<OrgInvite[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const loadInvites = useCallback(async () => {
    if (!isAdmin) return
    setInvitesLoading(true)
    const res = await fetch('/api/invites/list')
    if (res.ok) {
      const d = await res.json()
      setInvites(d.invites ?? [])
    }
    setInvitesLoading(false)
  }, [isAdmin])

  useEffect(() => { loadInvites() }, [loadInvites])

  const sendInvite = async () => {
    if (!inviteForm.email) return
    setError('')
    setSaving(true)
    const res = await fetch('/api/invites/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to send invite')
      return
    }
    setInviteSent(inviteForm.email)
    setInviteForm({ email: '', role: 'Associate' })
    setShowInvite(false)
    loadInvites()
  }

  const resendInvite = async (invite: OrgInvite) => {
    setResending(invite.id)
    await fetch('/api/invites/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invite.email, role: invite.role }),
    })
    setResending(null)
    setInviteSent(invite.email)
    loadInvites()
  }

  const revokeInvite = async (id: string) => {
    if (!confirm('Revoke this invitation?')) return
    setRevoking(id)
    await fetch('/api/invites/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId: id }),
    })
    setRevoking(null)
    setInvites(prev => prev.filter(i => i.id !== id))
  }

  const deleteMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the team?`)) return
    const res = await fetch('/api/team/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: id }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert('Failed to remove member: ' + (d.error ?? 'Unknown error'))
      return
    }
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  const updateCalendly = async (id: string, url: string) => {
    const trimmed = url.trim()
    await supabase.from('team_members').update({ calendly_url: trimmed }).eq('id', id)
    setMembers(prev => prev.map(m => m.id === id ? { ...m, calendly_url: trimmed } : m))
  }

  const updateRole = async (id: string, role: string) => {
    setRoleUpdating(id)
    const member = members.find(m => m.id === id)
    const [r1] = await Promise.all([
      supabase.from('team_members').update({ role }).eq('id', id),
      member?.auth_user_id
        ? supabase.from('org_members').update({ role }).eq('user_id', member.auth_user_id)
        : Promise.resolve({ error: null }),
    ])
    setRoleUpdating(null)
    if (r1.error) { alert('Failed to update role: ' + r1.error.message); return }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m))
    router.refresh()
  }

  const saveBranding = async () => {
    setBrandSaving(true)
    setBrandToast('')
    const res = await fetch('/api/settings/brand', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primary: brandPrimary, accent: brandAccent }),
    })
    setBrandSaving(false)
    if (res.ok) {
      setBrandToast('Brand colors saved!')
      setTimeout(() => setBrandToast(''), 3000)
    } else {
      const d = await res.json()
      setBrandToast('Error: ' + (d.error ?? 'Failed to save'))
    }
  }

  const pendingInvites = invites.filter(i => i.status === 'pending')
  const pastInvites = invites.filter(i => i.status !== 'pending')

  return (
    <div>
      {/* ── Team Members ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 32 }}>
        <div style={{ padding: '16px 20px', background: 'var(--line-soft)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>Team Members</span>
          {isAdmin && (
            <button
              onClick={() => { setShowInvite(v => !v); setError(''); setInviteSent('') }}
              style={{ background: 'var(--wine)', color: '#fff', padding: '7px 14px', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer' }}
            >
              + Invite Member
            </button>
          )}
        </div>

        {inviteSent && (
          <div style={{ padding: '12px 20px', background: '#f0fdf4', borderBottom: '1px solid var(--line)', fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={13} />
            Invite sent to <strong>{inviteSent}</strong>
          </div>
        )}

        {showInvite && isAdmin && (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', background: '#fffaf7' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && sendInvite()}
                  style={inputStyle}
                  placeholder="colleague@company.com"
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} style={{ ...inputStyle }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {error && (
              <div style={{ marginBottom: 10, padding: '7px 12px', background: 'var(--danger-soft)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={sendInvite} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', padding: '7px 14px', borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
              <button onClick={() => { setShowInvite(false); setError('') }} style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)', padding: '7px 14px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {members.length === 0 ? (
          <div style={{ padding: '32px 24px', color: 'var(--ink-faint)', fontSize: 13 }}>No team members yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['Name', 'Email', 'Role', 'Meeting Link', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 500, color: 'var(--navy)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--blush)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--wine)', flexShrink: 0 }}>
                        {m.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      {m.name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--ink-soft)' }}>{m.email}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13 }}>
                    {isAdmin ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          value={m.role ?? 'Associate'}
                          onChange={e => updateRole(m.id, e.target.value)}
                          disabled={roleUpdating === m.id}
                          style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', opacity: roleUpdating === m.id ? 0.6 : 1 }}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <RoleChip role={m.role ?? 'Associate'} />
                      </div>
                    ) : (
                      <RoleChip role={m.role ?? 'Associate'} />
                    )}
                  </td>
                  <td style={{ padding: '14px 20px', minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        defaultValue={m.calendly_url ?? ''}
                        placeholder="https://calendly.com/..."
                        type="url"
                        onBlur={e => updateCalendly(m.id, e.target.value)}
                        style={{ ...inputStyle, fontSize: 12, padding: '5px 8px', flex: 1, minWidth: 0 }}
                      />
                      {m.calendly_url && (
                        <a href={m.calendly_url} target="_blank" rel="noopener noreferrer" title="Open Calendly link" style={{ fontSize: 15, textDecoration: 'none', flexShrink: 0, lineHeight: 1 }}>🔗</a>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', width: 40 }}>
                    {isAdmin && m.id !== currentUserId && (
                      <button onClick={() => deleteMember(m.id, m.name)} title="Remove member" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', padding: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* ── Pending Invites ── */}
      {isAdmin && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 32 }}>
          <div style={{ padding: '16px 20px', background: 'var(--line-soft)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>
              Invitations
              {pendingInvites.length > 0 && (
                <span style={{ marginLeft: 10, fontSize: 12, fontFamily: 'var(--sans)', fontWeight: 700, background: 'var(--wine)', color: '#fff', borderRadius: 10, padding: '1px 8px' }}>
                  {pendingInvites.length} pending
                </span>
              )}
            </span>
          </div>

          {invitesLoading ? (
            <div style={{ padding: '24px 20px', color: 'var(--ink-faint)', fontSize: 13 }}>Loading…</div>
          ) : invites.length === 0 ? (
            <div style={{ padding: '24px 20px', color: 'var(--ink-faint)', fontSize: 13 }}>No invitations sent yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ background: 'var(--line-soft)' }}>
                  {['Email', 'Role', 'Invited By', 'Sent', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.map((inv, i) => (
                  <tr key={inv.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, opacity: inv.status === 'expired' ? 0.55 : 1 }}>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--navy)', fontWeight: 500 }}>{inv.email}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13 }}><RoleChip role={inv.role} /></td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--ink-soft)' }}>{inv.inviter_name ?? '—'}</td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--ink-soft)' }}>
                      {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 20px' }}><StatusPill status={inv.status} /></td>
                    <td style={{ padding: '12px 20px', width: 80 }}>
                      {inv.status !== 'accepted' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => resendInvite(inv)}
                            disabled={resending === inv.id}
                            title="Resend invite"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', padding: 0, display: 'flex', opacity: resending === inv.id ? 0.5 : 1 }}
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            onClick={() => revokeInvite(inv.id)}
                            disabled={revoking === inv.id}
                            title="Revoke invite"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0, display: 'flex', opacity: revoking === inv.id ? 0.5 : 1 }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ── Branding ── */}
      {isAdmin && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 32 }}>
          <div style={{ padding: '16px 20px', background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>Branding</span>
          </div>
          <div style={{ padding: '24px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 480, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Primary Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={brandPrimary}
                    onChange={e => setBrandPrimary(e.target.value)}
                    style={{ width: 36, height: 34, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', padding: 2 }}
                  />
                  <input
                    type="text"
                    value={brandPrimary}
                    onChange={e => setBrandPrimary(e.target.value)}
                    style={{ ...inputStyle, width: 100 }}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Accent Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={brandAccent}
                    onChange={e => setBrandAccent(e.target.value)}
                    style={{ width: 36, height: 34, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', padding: 2 }}
                  />
                  <input
                    type="text"
                    value={brandAccent}
                    onChange={e => setBrandAccent(e.target.value)}
                    style={{ ...inputStyle, width: 100 }}
                  />
                </div>
              </div>
            </div>
            {/* Preview swatch */}
            <div style={{ width: 180, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${brandPrimary}, ${brandAccent})`, marginBottom: 20 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={saveBranding}
                disabled={brandSaving}
                style={{ background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: brandSaving ? 0.7 : 1 }}
              >
                {brandSaving ? 'Saving…' : 'Save Branding'}
              </button>
              {brandToast && (
                <span style={{ fontSize: 13, color: brandToast.startsWith('Error') ? '#c0392b' : '#166534' }}>
                  {brandToast}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
