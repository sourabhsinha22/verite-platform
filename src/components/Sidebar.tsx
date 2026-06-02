'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Building2, Briefcase, CheckSquare,
  FileText, Settings, LogOut, TrendingUp, FileCheck, Bell,
  Kanban, BarChart2, Building, Users, ArrowLeftRight, UserCheck, Activity, Receipt
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/directory',   label: 'Directory',    icon: Building2 },
  { href: '/engagements', label: 'Engagements',  icon: Briefcase },
  { href: '/pipeline',    label: 'Pipeline',     icon: Kanban },
  { href: '/forecast',    label: 'Forecast',     icon: BarChart2 },
  { href: '/revenue',     label: 'Revenue',      icon: TrendingUp },
  { href: '/pnl',        label: 'P&L',          icon: Receipt },
  { href: '/cashflow',   label: 'Cash Flow',    icon: Activity },
  { href: '/bank',        label: 'Bank Balance', icon: Building },
  { href: '/distributions', label: 'Distributions', icon: Users },
  { href: '/reimbursements', label: 'Reimbursements', icon: ArrowLeftRight },
  { href: '/contractors', label: 'Contractors',  icon: UserCheck },
  { href: '/invoices',    label: 'Invoices',     icon: FileCheck },
  { href: '/tasks',       label: 'My Tasks',     icon: CheckSquare },
  { href: '/reports',     label: 'Reports',      icon: FileText },
  { href: '/settings',    label: 'Settings',     icon: Settings },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
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
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.15s',
              background: isActive(href) ? 'rgba(227,188,166,0.18)' : 'transparent',
              color: isActive(href) ? '#fff' : '#c9bdb3',
              paddingLeft: href === '/settings/notifications' ? '28px' : '12px',
            }}
          >
            <Icon size={15} style={{ opacity: 0.85 }} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
        {/* Current user */}
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
