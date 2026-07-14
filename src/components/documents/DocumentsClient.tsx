'use client'

import { useState } from 'react'
import Link from 'next/link'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(d: string) {
  const dt = new Date(d)
  return `${MO[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`
}
function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return Math.round(bytes / 1e3) + ' KB'
}
function fileIcon(type: string | null): string {
  if (!type) return '📎'
  if (type.includes('pdf')) return '📄'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('sheet') || type.includes('excel')) return '📊'
  if (type.includes('image')) return '🖼'
  return '📎'
}

interface DocRow {
  id: string
  name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  uploaded_by: string
  created_at: string
  engagement: { id: string; name: string } | null
  company: { id: string; name: string } | null
}

interface Props {
  docs: DocRow[]
  supabaseUrl: string
}

export default function DocumentsClient({ docs, supabaseUrl }: Props) {
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<'all' | 'engagement' | 'company'>('all')

  const filtered = docs.filter(d => {
    if (groupFilter === 'engagement' && !d.engagement) return false
    if (groupFilter === 'company' && !d.company) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return d.name.toLowerCase().includes(q)
        || (d.engagement?.name ?? '').toLowerCase().includes(q)
        || (d.company?.name ?? '').toLowerCase().includes(q)
        || d.uploaded_by.toLowerCase().includes(q)
    }
    return true
  })

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', border: 'none',
    background: active ? 'var(--navy)' : 'var(--line-soft)',
    color: active ? '#fff' : 'var(--ink-soft)',
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink-faint)', pointerEvents: 'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px 7px 28px', width: '100%', boxSizing: 'border-box', background: 'var(--surface)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['all','All'],['engagement','By Engagement'],['company','By Company']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setGroupFilter(v)} style={chipStyle(groupFilter === v)}>{l}</button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-faint)', marginLeft: 4 }}>{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
          No documents found.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['', 'Document', 'Type', 'Size', 'Engagement', 'Company', 'Uploaded By', 'Date'].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, i) => {
                const fileUrl = `${supabaseUrl}/storage/v1/object/public/documents/${doc.file_path}`
                return (
                  <tr key={doc.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                    <td style={{ padding: '12px 8px 12px 16px', fontSize: 18, width: 32 }}>{fileIcon(doc.file_type)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, maxWidth: 260 }}>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wine)', textDecoration: 'none', fontWeight: 500, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.name}
                      </a>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-faint)' }}>{doc.file_type?.split('/')[1]?.toUpperCase() ?? '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{fmtSize(doc.file_size)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>
                      {doc.engagement
                        ? <Link href={`/engagements/${doc.engagement.id}`} style={{ color: 'var(--wine)', textDecoration: 'none' }}>{doc.engagement.name}</Link>
                        : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>
                      {doc.company
                        ? <Link href={`/directory/${doc.company.id}`} style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>{doc.company.name}</Link>
                        : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-soft)' }}>{doc.uploaded_by || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{fmtDate(doc.created_at)}</td>
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
