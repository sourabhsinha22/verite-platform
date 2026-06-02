﻿export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import NewCompanyButton from '@/components/directory/NewCompanyButton'
import { CompanyTag } from '@/lib/types'

export default async function DirectoryPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase
    .from('companies')
    .select('*, contacts(id), engagements(id, stage)')
    .order('name')

  const rows = companies ?? []

  return (
    <div>
      <style>{`.hover-row { cursor: pointer; transition: background 0.1s; } .hover-row:hover { background: var(--line-soft) !important; }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
            Directory
          </h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 8, marginBottom: 0 }}>
            {rows.length} {rows.length === 1 ? 'company' : 'companies'} &nbsp;&middot;&nbsp; click a row for contacts and engagements
          </p>
        </div>
        <NewCompanyButton />
      </div>

      {rows.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
          <p style={{ fontSize: 15, marginBottom: 12 }}>No companies yet</p>
          <NewCompanyButton />
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Company', 'Tag', 'Industry', 'Contacts', 'Engagements', 'Account Owner'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((company, i) => {
                const contacts = (company.contacts ?? []) as { id: string }[]
                const engagements = (company.engagements ?? []) as { id: string; stage: string }[]
                const activeCount = engagements.filter(e => e.stage === 'active').length
                return (
                  <tr key={company.id} className="hover-row" style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                    <td style={{ padding: '14px 16px' }}>
                      <Link href={`/directory/${company.id}`} style={{ textDecoration: 'none', color: 'var(--navy)', fontWeight: 500, fontSize: 13, display: 'block' }}>
                        {company.name}
                      </Link>
                      {company.address && <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{company.address}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}><Badge tag={(company.tag as CompanyTag) || 'prospect'} /></td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{company.industry || 'â€"'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center' }}>{contacts.length}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>
                      {engagements.length}
                      {activeCount > 0 && <span style={{ color: 'var(--success)', marginLeft: 6, fontSize: 12 }}>({activeCount} active)</span>}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{company.account_owner || 'â€"'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
