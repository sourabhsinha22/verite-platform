'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface ReportNavProps {
  active: 'status' | 'client' | 'health' | 'financial'
}

const TABS = [
  { key: 'status',    label: 'Status Report',    href: '/reports' },
  { key: 'client',    label: 'Client Report',    href: '/reports/client' },
  { key: 'health',    label: 'Health Snapshot',  href: '/reports/health' },
  { key: 'financial', label: 'Financial Report', href: '/reports/financial' },
] as const

export default function ReportNav({ active }: ReportNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="no-print"
      style={{
        display: 'flex',
        gap: 4,
        background: 'var(--line-soft)',
        padding: 4,
        borderRadius: 8,
        width: 'fit-content',
        marginBottom: 32,
      }}
    >
      {TABS.map(tab => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              background: isActive ? 'var(--navy)' : 'transparent',
              color: isActive ? '#fff' : 'var(--ink-soft)',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
