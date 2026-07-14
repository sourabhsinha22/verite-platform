export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return `${MO[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`
}
function fmtMoney(v: number | null) {
  if (!v) return '—'
  if (v >= 1e6) return '$' + (v/1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '$' + Math.round(v/1e3) + 'K'
  return '$' + Math.round(v).toLocaleString()
}

const ACTIVITY_ICONS: Record<string, string> = {
  note: '📝', call: '📞', meeting: '🤝', email: '✉️', status: '🔄', milestone: '🎯',
}

const STAGE_LABELS: Record<string, string> = {
  prospect: 'Prospect', engaged: 'Engaged', qualified: 'Qualified',
  proposal_sent: 'Proposal Sent', active: 'Active', paused: 'Paused', closed: 'Closed',
}

interface Props { params: Promise<{ token: string }> }

export default async function PortalPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, contacts(*)')
    .eq('portal_token', token)
    .single()

  if (!company) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center', color: '#5f5f6e', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: '#ead9cd' }}>×</div>
          <h1 style={{ fontSize: 24, color: '#25314a', marginBottom: 8 }}>Portal Not Found</h1>
          <p style={{ fontSize: 14 }}>This link may have expired or is invalid.</p>
          <p style={{ marginTop: 24, fontSize: 13 }}>Questions? <a href="mailto:tana@veritehealth.com" style={{ color: '#5f3e3f' }}>Contact us</a></p>
        </div>
      </div>
    )
  }

  const [{ data: engagements }, { data: invoices }, { data: documents }] = await Promise.all([
    supabase.from('engagements').select('id, name, stage, next_action, contract_value').eq('company_id', company.id).in('stage', ['active','proposal_sent','qualified']).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, invoice_number, amount, status, due_date, paid_date').eq('company_id', company.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('documents').select('id, name, file_path, file_type, created_at').eq('company_id', company.id).order('created_at', { ascending: false }).limit(8),
  ])

  const engIds = (engagements ?? []).map(e => e.id)
  const [activityRes, tasksRes] = await Promise.all([
    engIds.length > 0
      ? supabase.from('activity_log').select('id, engagement_id, entry_type, content, created_at').in('engagement_id', engIds).order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
    engIds.length > 0
      ? supabase.from('tasks').select('engagement_id, status').in('engagement_id', engIds)
      : Promise.resolve({ data: [] }),
  ])
  const activity = activityRes.data ?? []
  const tasks = tasksRes.data ?? []

  // Progress per engagement
  const progressMap: Record<string, number> = {}
  for (const eng of engagements ?? []) {
    const engTasks = tasks.filter((t: {engagement_id: string; status: string}) => t.engagement_id === eng.id)
    const done = engTasks.filter((t: {status: string}) => t.status === 'done').length
    progressMap[eng.id] = engTasks.length > 0 ? Math.round(done / engTasks.length * 100) : 0
  }

  const openInvoices = (invoices ?? []).filter(i => !i.paid_date)
  const paidInvoices = (invoices ?? []).filter(i => i.paid_date)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  const section = (title: string) => (
    <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600, color: '#25314a', margin: '0 0 16px', paddingTop: 32, borderTop: '1px solid #ead9cd' }}>{title}</h2>
  )

  const stageChip = (stage: string) => (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 3, background: stage === 'active' ? '#e8f5e9' : '#f5f3ee', color: stage === 'active' ? '#2e7d52' : '#7a6a5a', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#faf7f3', fontFamily: 'Georgia, serif' }}>
      {/* Header */}
      <div style={{ background: '#2f2e4b', padding: '28px 40px 24px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#e3bca6', marginBottom: 8 }}>Client Portal</div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: '#fff', margin: 0 }}>Vérité Health Collective</h1>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{company.name}</div>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '36px 40px 60px' }}>

        {/* Active Engagements */}
        {(engagements ?? []).length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {section('Active Projects')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(engagements ?? []).map(eng => (
                <div key={eng.id} style={{ background: '#fff', border: '1px solid #ead9cd', borderRadius: 8, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#25314a', marginBottom: 4 }}>{eng.name}</div>
                      {eng.contract_value && <div style={{ fontSize: 13, color: '#9a9aa5' }}>{fmtMoney(eng.contract_value)}</div>}
                    </div>
                    {stageChip(eng.stage)}
                  </div>
                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: eng.next_action ? 12 : 0 }}>
                    <div style={{ flex: 1, height: 6, background: '#f0e8e0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${progressMap[eng.id] ?? 0}%`, height: '100%', background: '#5f3e3f', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#9a9aa5', whiteSpace: 'nowrap' }}>{progressMap[eng.id] ?? 0}% complete</span>
                  </div>
                  {eng.next_action && (
                    <div style={{ fontSize: 13, color: '#5f5f6e', background: '#faf6f2', borderRadius: 4, padding: '8px 12px', borderLeft: '3px solid #e3bca6' }}>
                      <strong style={{ color: '#25314a' }}>Next:</strong> {eng.next_action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open Invoices */}
        {openInvoices.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {section('Open Invoices')}
            <div style={{ background: '#fff', border: '1px solid #ead9cd', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f5ebe3' }}>
                    {['Invoice', 'Amount', 'Due Date', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, color: '#5f3e3f', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((inv, i) => (
                    <tr key={inv.id} style={{ borderTop: i > 0 ? '1px solid #f0e8e0' : undefined }}>
                      <td style={{ padding: '13px 16px', fontWeight: 600, color: '#25314a' }}>{inv.invoice_number}</td>
                      <td style={{ padding: '13px 16px', color: '#25314a', fontWeight: 600 }}>{fmtMoney(inv.amount)}</td>
                      <td style={{ padding: '13px 16px', color: '#5f5f6e' }}>{fmtDate(inv.due_date)}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <Link href={`/pay/${inv.id}`} style={{ background: '#5f3e3f', color: '#fff', padding: '6px 14px', borderRadius: 4, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                          Pay Now →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Paid invoices summary */}
        {paidInvoices.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {section('Payment History')}
            <div style={{ background: '#fff', border: '1px solid #ead9cd', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f5ebe3' }}>
                    {['Invoice', 'Amount', 'Paid On', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, color: '#5f3e3f', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paidInvoices.slice(0, 5).map((inv, i) => (
                    <tr key={inv.id} style={{ borderTop: i > 0 ? '1px solid #f0e8e0' : undefined }}>
                      <td style={{ padding: '12px 16px', color: '#5f5f6e' }}>{inv.invoice_number}</td>
                      <td style={{ padding: '12px 16px', color: '#25314a' }}>{fmtMoney(inv.amount)}</td>
                      <td style={{ padding: '12px 16px', color: '#5f5f6e' }}>{fmtDate(inv.paid_date)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#2e7d52', background: '#e8f5e9', padding: '2px 8px', borderRadius: 3 }}>Paid ✓</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {(activity ?? []).length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {section('Recent Updates')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(activity ?? []).map((entry, i) => {
                const d = new Date(entry.created_at)
                const dateStr = `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
                return (
                  <div key={entry.id} style={{ background: '#fff', borderRadius: 6, padding: '14px 18px', border: '1px solid #ead9cd', marginBottom: 8, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{ACTIVITY_ICONS[entry.entry_type] ?? '📌'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#25314a', lineHeight: 1.5 }}>
                        {entry.content.length > 120 ? entry.content.slice(0, 120) + '…' : entry.content}
                      </div>
                      <div style={{ fontSize: 11, color: '#9a9aa5', marginTop: 4 }}>{dateStr}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Documents */}
        {(documents ?? []).length > 0 && (
          <div>
            {section('Shared Documents')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(documents ?? []).map(doc => {
                const fileUrl = `${supabaseUrl}/storage/v1/object/public/documents/${doc.file_path}`
                const icon = doc.file_type?.includes('pdf') ? '📄' : doc.file_type?.includes('image') ? '🖼' : '📎'
                return (
                  <a key={doc.id} href={fileUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #ead9cd', borderRadius: 6, padding: '12px 16px', textDecoration: 'none', color: '#25314a' }}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#5f3e3f' }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: '#9a9aa5', marginTop: 2 }}>{fmtDate(doc.created_at)}</div>
                    </div>
                    <span style={{ fontSize: 11, color: '#9a9aa5' }}>↓</span>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {(engagements ?? []).length === 0 && openInvoices.length === 0 && (activity ?? []).length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9a9aa5' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 15 }}>Your portal is being set up. Check back soon.</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #ead9cd', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#9a9aa5' }}>
            Questions? <a href="mailto:tana@veritehealth.com" style={{ color: '#5f3e3f' }}>tana@veritehealth.com</a>
            {' '}· Vérité Health Collective
          </p>
        </div>
      </div>
    </div>
  )
}
