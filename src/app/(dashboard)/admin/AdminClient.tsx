'use client'

import { useState } from 'react'
import { Building2, Users, Mail, Shield, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'

interface OrgMember {
  userId: string
  role: string
  email?: string
}

interface Org {
  id: string
  name: string
  slug: string
  brand: Record<string, string> | null
  created_at: string
  memberCount: number
  pendingInvites: number
  members: OrgMember[]
}

interface Props {
  orgs: Org[]
  currentUserId: string
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  overflow: 'hidden',
}

const statBox = (label: string, value: string | number, color?: string) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--navy)', fontFamily: 'var(--serif)', lineHeight: 1 }}>
      {value}
    </div>
    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>{label}</div>
  </div>
)

function DeleteOrgButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${orgName}? This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch('/api/admin/orgs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    })
    setDeleting(false)
    if (res.ok) {
      window.location.reload()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Failed to delete organization')
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      style={{
        marginTop: 8,
        padding: '6px 12px',
        background: deleting ? '#fca5a5' : '#dc2626',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        cursor: deleting ? 'not-allowed' : 'pointer',
        opacity: deleting ? 0.7 : 1,
      }}
    >
      {deleting ? 'Deleting…' : 'Delete organization'}
    </button>
  )
}

function OrgCard({ org }: { org: Org }) {
  const [expanded, setExpanded] = useState(false)

  const primaryColor = org.brand?.primary ?? 'var(--navy)'
  const accentColor = org.brand?.accent ?? 'var(--wine)'

  return (
    <div style={cardStyle}>
      {/* Color bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }} />

      <div style={{ padding: '20px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Building2 size={16} style={{ color: primaryColor, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>
                {org.name}
              </span>
            </div>
            <code style={{ fontSize: 11, color: 'var(--ink-faint)', background: 'var(--line-soft)', padding: '2px 6px', borderRadius: 3 }}>
              {org.slug}
            </code>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            {new Date(org.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
          {statBox('Members', org.memberCount)}
          {statBox('Pending Invites', org.pendingInvites, org.pendingInvites > 0 ? '#f59e0b' : undefined)}
        </div>

        {/* Brand colors */}
        {org.brand && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Brand:</span>
            {org.brand.primary && (
              <div title={org.brand.primary} style={{ width: 16, height: 16, borderRadius: 3, background: org.brand.primary, border: '1px solid var(--line)' }} />
            )}
            {org.brand.accent && (
              <div title={org.brand.accent} style={{ width: 16, height: 16, borderRadius: 3, background: org.brand.accent, border: '1px solid var(--line)' }} />
            )}
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              {org.brand.primary ?? '—'} / {org.brand.accent ?? '—'}
            </span>
          </div>
        )}

        {/* Org ID */}
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 12, padding: 0 }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Details
        </button>

        {expanded && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--line-soft)', borderRadius: 5, fontSize: 12 }}>
            <div style={{ fontFamily: 'monospace', color: 'var(--ink-soft)', marginBottom: 10 }}>ID: {org.id}</div>

            {/* Member list */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 6 }}>Members</div>
              {org.memberCount === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>No members yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {org.members.map(m => (
                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--surface)', borderRadius: 4, border: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
                        {m.email ?? m.userId}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: 'var(--line)', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delete org — only when empty */}
            {org.memberCount === 0 && (
              <DeleteOrgButton orgId={org.id} orgName={org.name} />
            )}
          </div>
        )}
      </div>
    </div>
  )
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

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function CreateOrgForm() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', primary: '#2f2e4b', accent: '#5f3e3f' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, name, slug: slugify(name) }))
  }

  const submit = async () => {
    if (!form.name || !form.slug) { setError('Name and slug are required'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to create org')
      return
    }
    window.location.reload()
  }

  return (
    <div style={{ marginBottom: 28 }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 5, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={14} />
          New Organization
        </button>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'var(--line-soft)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: 'var(--navy)' }}>Create Organization</span>
            <button onClick={() => { setOpen(false); setError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex' }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  style={inputStyle}
                  placeholder="Acme Psychiatry"
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  style={inputStyle}
                  placeholder="acme-psychiatry"
                />
              </div>
              <div>
                <label style={labelStyle}>Primary Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={form.primary} onChange={e => setForm(f => ({ ...f, primary: e.target.value }))} style={{ width: 36, height: 32, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', padding: 2 }} />
                  <input type="text" value={form.primary} onChange={e => setForm(f => ({ ...f, primary: e.target.value }))} style={{ ...inputStyle, width: 100 }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Accent Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={form.accent} onChange={e => setForm(f => ({ ...f, accent: e.target.value }))} style={{ width: 36, height: 32, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', padding: 2 }} />
                  <input type="text" value={form.accent} onChange={e => setForm(f => ({ ...f, accent: e.target.value }))} style={{ ...inputStyle, width: 100 }} />
                </div>
              </div>
            </div>
            {error && (
              <div style={{ marginBottom: 12, padding: '7px 12px', background: '#fff0f0', borderRadius: 4, color: '#c0392b', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Creating…' : 'Create Organization'}
              </button>
              <button onClick={() => { setOpen(false); setError('') }} style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)', borderRadius: 4, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminClient({ orgs, currentUserId }: Props) {
  const totalMembers = orgs.reduce((s, o) => s + o.memberCount, 0)
  const totalPending = orgs.reduce((s, o) => s + o.pendingInvites, 0)

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Shield size={22} style={{ color: 'var(--wine)' }} />
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 600, color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px' }}>
            Super Admin
          </h1>
        </div>
        <p style={{ color: 'var(--ink-soft)', margin: 0 }}>Platform-wide organization management</p>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 36, flexWrap: 'wrap' }}>
        {[
          { icon: Building2, label: 'Organizations', value: orgs.length, color: 'var(--navy)' },
          { icon: Users,     label: 'Total Members',  value: totalMembers, color: 'var(--navy)' },
          { icon: Mail,      label: 'Pending Invites', value: totalPending, color: totalPending > 0 ? '#f59e0b' : 'var(--navy)' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ ...cardStyle, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 200px' }}>
            <Icon size={24} style={{ color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'var(--serif)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Create org */}
      <CreateOrgForm />

      {/* Org grid */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wine)', margin: '0 0 16px' }}>
          Organizations
        </h2>
        {orgs.length === 0 ? (
          <div style={{ ...cardStyle, padding: '32px 24px', color: 'var(--ink-faint)', fontSize: 14 }}>
            No organizations found.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {orgs.map(org => <OrgCard key={org.id} org={org} />)}
          </div>
        )}
      </div>
    </div>
  )
}
