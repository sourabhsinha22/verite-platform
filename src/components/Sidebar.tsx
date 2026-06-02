'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Building2, Briefcase, CheckSquare,
  FileText, Settings, LogOut, TrendingUp, FileCheck,
  Kanban, Building,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    id: 'work',
    label: 'Work',
    defaultOpen: true,
    items: [
      { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
      { href: '/tasks',       label: 'My Tasks',    icon: CheckSquare },
      { href: '/engagements', label: 'Engagements', icon: Briefcase },
      { href: '/pipeline',    label: 'Pipeline',    icon: Kanban },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    defaultOpen: true,
    items: [
      { href: '/directory', label: 'Directory', icon: Building2 },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    defaultOpen: false,
    items: [
      { href: '/invoices', label: 'Invoices',    icon: FileCheck },
      { href: '/finance',  label: 'Analytics',  icon: TrendingUp },
      { href: '/money',    label: 'Cash & Ops', icon: Building },
    ],
  },
]

const STANDALONE = [
  { href: '/reports',  label: 'Reports',  icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface CurrentUser {
  name: string
  email: string
  initials: string
}

interface Props {
  currentUser?: CurrentUser
}

export default function Sidebar({ currentUser }: Props) {
  const pathname = usePathname()
  const supabase = createClient()

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return { work: true, clients: true, finance: false }
    }
    try {
      const saved = localStorage.getItem('verite-sidebar-groups')
      return saved ? JSON.parse(saved) : { work: true, clients: true, finance: false }
    } catch {
      return { work: true, clients: true, finance: false }
    }
  })

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem('verite-sidebar-groups', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
    if (href === '/finance') return pathname.startsWith('/finance') || ['/revenue', '/pnl', '/cashflow', '/forecast'].includes(pathname)
    if (href === '/money') return pathname.startsWith('/money') || ['/bank', '/distributions', '/reimbursements', '/contractors'].includes(pathname)
    return pathname.startsWith(href)
  }

  return (
    <aside style={{
      width: '240px',
      background: 'var(--indigo)',
      color: '#f3e4dc',
      padding: '32px 20px',
      position: 'fixed',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '36px', padding: '0 4px' }}>
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: '26px',
          fontWeight: 600,
          lineHeight: 1.15,
          marginBottom: '4px',
          color: '#ffffff',
        }}>
          V<em style={{ color: 'var(--blush)', fontStyle: 'italic', fontWeight: 500 }}>é</em>rit<em style={{ color: 'var(--blush)', fontStyle: 'italic', fontWeight: 500 }}>é</em>
          <span style={{ display: 'block', fontStyle: 'italic', color: 'var(--blush)', fontWeight: 500, fontSize: '22px' }}>
            Health Collective
          </span>
        </div>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--rose)',
        }}>
          Platform
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
        {NAV_GROUPS.map(group => (
          <div key={group.id} style={{ marginBottom: 4 }}>
            <button
              onClick={() => toggleGroup(group.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '6px 12px 4px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'rgba(227,188,166,0.6)',
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              <span>{group.label}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                style={{ transform: openGroups[group.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', opacity: 0.6 }}>
                <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {openGroups[group.id] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px',
                      borderRadius: 6,
                      fontSize: 13, fontWeight: 500, textDecoration: 'none',
                      transition: 'all 0.15s',
                      background: isActive(href) ? 'rgba(227,188,166,0.18)' : 'transparent',
                      color: isActive(href) ? '#fff' : '#c9bdb3',
                    }}
                  >
                    <Icon size={14} style={{ opacity: 0.85 }} />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Separator */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0' }} />

        {/* Standalone items */}
        {STANDALONE.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 6,
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              background: isActive(href) ? 'rgba(227,188,166,0.18)' : 'transparent',
              color: isActive(href) ? '#fff' : '#c9bdb3',
            }}
          >
            <Icon size={14} style={{ opacity: 0.85 }} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
        {currentUser && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            marginBottom: '6px',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--blush)',
              color: 'var(--wine)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {currentUser.initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: '11px', color: '#9a9aa5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.email}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            borderRadius: '5px',
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#b8b3a4',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <LogOut size={13} style={{ opacity: 0.8 }} />
          Sign out
        </button>
        <div style={{ fontSize: '11px', color: '#555', marginTop: '8px', padding: '0 10px' }}>
          Data stored securely in Supabase
        </div>
      </div>
    </aside>
  )
}
