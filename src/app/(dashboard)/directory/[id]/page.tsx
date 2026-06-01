import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Company, Contact, Engagement, EngagementType, EngagementStage } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import CompanyDetailClient from '@/components/directory/CompanyDetailClient'
import { ChevronLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: company }, { data: contacts }, { data: engagements }, { data: tasks }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', id).single(),
    supabase.from('contacts').select('*').eq('company_id', id).order('is_primary', { ascending: false }),
    supabase.from('engagements').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('engagement_id, status').in(
      'engagement_id',
      (await supabase.from('engagements').select('id').eq('company_id', id)).data?.map(e => e.id) ?? []
    ),
  ])

  if (!company) notFound()

  const co = company as Company
  const ctcs = (contacts ?? []) as Contact[]
  const engs = (engagements ?? []) as Engagement[]

  // Build task progress per engagement
  const progressMap: Record<string, number> = {}
  for (const t of tasks ?? []) {
    if (!progressMap[t.engagement_id + '_total']) progressMap[t.engagement_id + '_total'] = 0
    if (!progressMap[t.engagement_id + '_done']) progressMap[t.engagement_id + '_done'] = 0
    progressMap[t.engagement_id + '_total']++
    if (t.status === 'done') progressMap[t.engagement_id + '_done']++
  }

  return (
    <div>
      <Link href="/directory" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--ink-soft)', textDecoration: 'none', fontSize: 13, marginBottom: 24,
      }}>
        <ChevronLeft size={14} /> Directory
      </Link>

      <CompanyDetailClient company={co} contacts={ctcs} />

      {/* Engagements section */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
            Engagements <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 400, color: 'var(--ink-faint)' }}>{engs.length}</span>
          </h2>
          <Link href="/engagements" style={{ fontSize: 13, color: 'var(--wine)', textDecoration: 'none' }}>
            View all engagements →
          </Link>
        </div>
        {engs.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '32px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
            No engagements yet.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                  {['Engagement', 'Type', 'Stage', 'Lead', 'Progress'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engs.map((eng, i) => {
                  const total = progressMap[eng.id + '_total'] ?? 0
                  const done = progressMap[eng.id + '_done'] ?? 0
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0
                  return (
                    <tr key={eng.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--line-soft)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '13px 16px', fontSize: 13 }}>
                        <Link href={`/engagements/${eng.id}`} style={{ color: 'var(--navy)', fontWeight: 500, textDecoration: 'none' }}>
                          {eng.name}
                        </Link>
                      </td>
                      <td style={{ padding: '13px 16px' }}><Badge type={eng.engagement_type as EngagementType} /></td>
                      <td style={{ padding: '13px 16px' }}><Badge stage={eng.stage as EngagementStage} /></td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{eng.lead || '—'}</td>
                      <td style={{ padding: '13px 16px', minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : 'var(--wine)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
