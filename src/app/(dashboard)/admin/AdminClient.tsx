'use client'

import { useState } from 'react'
import { Building2, Users, Mail, Shield, ChevronDown, ChevronRight } from 'lucide-react'

interface Org {
  id: string
  name: string
  slug: string
  brand: Record<string, string> | null
  created_at: string
  memberCount: number
  pendingInvites: number
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
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--line-soft)', borderRadius: 5, fontSize: 12, fontFamily: 'monospace', color: 'var(--ink-soft)' }}>
            <div>ID: {org.id}</div>
          </div>
        )}
      </div>
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
