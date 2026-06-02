export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ReportNav from '@/components/reports/ReportNav'
import PrintButton from '@/components/reports/PrintButton'
import { ENGAGEMENT_TYPE_LABELS, ENGAGEMENT_STAGE_LABELS } from '@/lib/types'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function fmtCurrency(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}

function nowLabel(): string {
  const d = new Date()
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

interface CompanyRow {
  id: string
  name: string
  address: string | null
  industry: string | null
  account_owner: string | null
}

interface TaskRow {
  id: string
  title: string
  status: string
  due_date: string | null
  owner: string | null
}

interface RevenueItemRow {
  forecast_amount: number
  actual_amount: number | null
}

interface EngagementRow {
  id: string
  name: string
  engagement_type: string
  stage: string
  company_id: string
  tasks: TaskRow[]
  revenue_items: RevenueItemRow[]
}

interface ActivityRow {
  engagement_id: string
  entry_type: string
  content: string
  author: string
  created_at: string
}

interface InvoiceRow {
  engagement_id: string
  invoice_number: string
  amount: number
  date_sent: string | null
  due_date: string | null
  paid_date: string | null
  status: string
}

export default async function ClientReportPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>
}) {
  const { company_id } = await searchParams
  const supabase = await createClient()

  const [companiesRes, engagementsRes, activityRes, invoicesRes] = await Promise.all([
    supabase.from('companies').select('id, name, address, industry, account_owner').order('name'),
    supabase.from('engagements')
      .select('*, tasks(*), revenue_items(*)')
      .eq(company_id ? 'company_id' : 'id', company_id || 'impossible')
      .neq('stage', 'closed'),
    supabase.from('activity_log')
      .select('engagement_id, entry_type, content, author, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('invoices')
      .select('engagement_id, invoice_number, amount, date_sent, due_date, paid_date, status')
      .order('date_sent', { ascending: false })
      .limit(50),
  ])

  const companies = (companiesRes.data ?? []) as unknown as CompanyRow[]
  const engagements = (engagementsRes.data ?? []) as unknown as EngagementRow[]
  const activityLog = (activityRes.data ?? []) as unknown as ActivityRow[]
  const allInvoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[]

  // ── Company selection page ────────────────────────────────────────────────────
  if (!company_id) {
    const currentCompanies = companies // show all since we don't have tag here; filter by current tag if available
    return (
      <>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            aside, nav { display: none !important; }
            main { margin-left: 0 !important; padding: 24px !important; }
            body { background: white !important; }
          }
          .company-card:hover { border-color: var(--navy) !important; }
        `}</style>

        <div style={{ maxWidth: 900 }}>
          <ReportNav active="client" />
          <h1 style={{
            fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 600,
            color: 'var(--navy)', margin: 0, marginBottom: 8, letterSpacing: '-0.5px',
          }}>
            Client Report
          </h1>
          <p style={{ color: 'var(--ink-soft)', margin: 0, fontSize: 14, marginBottom: 32 }}>
            Select a company to generate a client-facing engagement review.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {currentCompanies.map(company => (
              <Link
                key={company.id}
                href={`/reports/client?company_id=${company.id}`}
                className="company-card"
                style={{
                  display: 'block',
                  padding: '20px 22px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  textDecoration: 'none',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{
                  fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600,
                  color: 'var(--navy)', marginBottom: 6,
                }}>
                  {company.name}
                </div>
                {company.industry && (
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 }}>
                    {company.industry}
                  </div>
                )}
                {company.account_owner && (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    Partner: {company.account_owner}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ── Company found ─────────────────────────────────────────────────────────────
  const company = companies.find(c => c.id === company_id)
  if (!company) {
    return (
      <div style={{ padding: 40, color: 'var(--ink-soft)', fontSize: 14 }}>
        Company not found.{' '}
        <Link href="/reports/client" style={{ color: 'var(--navy)' }}>← Back</Link>
      </div>
    )
  }

  // ── Build activity map ────────────────────────────────────────────────────────
  const activityByEng: Record<string, ActivityRow[]> = {}
  for (const entry of activityLog) {
    if (!activityByEng[entry.engagement_id]) activityByEng[entry.engagement_id] = []
    if (activityByEng[entry.engagement_id].length < 3) {
      activityByEng[entry.engagement_id].push(entry)
    }
  }

  // ── Engagement IDs for this company ──────────────────────────────────────────
  const engIds = new Set(engagements.map(e => e.id))

  // ── Invoices for this company's engagements ───────────────────────────────────
  const companyInvoices = allInvoices.filter(inv => engIds.has(inv.engagement_id))

  const today = nowLabel()

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-letterhead { display: block !important; }
          aside, nav { display: none !important; }
          main { margin-left: 0 !important; padding: 24px !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* ── Print-only letterhead ───────────────────────────────────────────────── */}
      <div className="print-letterhead" style={{ display: 'none', marginBottom: 32, paddingBottom: 16, borderBottom: '2px solid #5f3e3f' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, color: '#25314a' }}>
          Vérité Health Collective
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5f3e3f', marginTop: 4 }}>
          Quarterly Engagement Review
        </div>
        <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>Prepared for: {company.name}</div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Date: {today}</div>
      </div>

      <div style={{ maxWidth: 900 }}>

        {/* ── Screen header ────────────────────────────────────────────────────── */}
        <div className="no-print">
          <ReportNav active="client" />
          <div style={{ marginBottom: 8 }}>
            <Link
              href="/reports/client"
              style={{ fontSize: 13, color: 'var(--ink-soft)', textDecoration: 'none' }}
            >
              ← Change client
            </Link>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{
              fontFamily: 'var(--serif)', fontSize: 38, fontWeight: 600,
              color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px',
            }}>
              {company.name}
            </h1>
            <PrintButton />
          </div>
        </div>

        {/* ── Company info card ────────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '20px 24px',
          marginBottom: 28,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>
              Company
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy)' }}>{company.name}</div>
          </div>
          {company.industry && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>
                Industry
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)' }}>{company.industry}</div>
            </div>
          )}
          {company.account_owner && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>
                Account Partner
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)' }}>{company.account_owner}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>
              Report Date
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink)' }}>{today}</div>
          </div>
        </div>

        {/* ── Per-engagement sections ──────────────────────────────────────────── */}
        {engagements.map(eng => {
          const tasks = (eng.tasks ?? []) as unknown as TaskRow[]
          const revItems = (eng.revenue_items ?? []) as unknown as RevenueItemRow[]
          const activity = activityByEng[eng.id] ?? []

          const doneTasks = tasks.filter(t => t.status === 'done')
          const inProgressTasks = tasks.filter(t => t.status === 'in-progress').slice(0, 3)
          const notStartedTasks = tasks.filter(t => t.status === 'not-started' && t.due_date).slice(0, 3)
          const totalTasks = tasks.length
          const doneCount = doneTasks.length
          const progressPct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0

          const engInvoices = companyInvoices.filter(inv => inv.engagement_id === eng.id)
          const invoicedTotal = engInvoices.reduce((s, inv) => s + (inv.amount ?? 0), 0)
          const receivedTotal = engInvoices.filter(inv => inv.paid_date).reduce((s, inv) => s + (inv.amount ?? 0), 0)
          const revActualTotal = revItems.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
          const totalReceived = Math.max(receivedTotal, revActualTotal)

          const typeLabel = ENGAGEMENT_TYPE_LABELS[eng.engagement_type as keyof typeof ENGAGEMENT_TYPE_LABELS] ?? eng.engagement_type
          const stageLabel = ENGAGEMENT_STAGE_LABELS[eng.stage as keyof typeof ENGAGEMENT_STAGE_LABELS] ?? eng.stage

          return (
            <div
              key={eng.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                marginBottom: 24,
                overflow: 'hidden',
              }}
            >
              {/* Engagement header */}
              <div style={{
                background: 'var(--line-soft)',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 10,
              }}>
                <h2 style={{
                  fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                  color: 'var(--navy)', margin: 0,
                }}>
                  {eng.name}
                </h2>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    color: 'var(--ink-soft)', letterSpacing: '0.06em',
                  }}>
                    {typeLabel}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    color: 'var(--ink-soft)', letterSpacing: '0.06em',
                  }}>
                    {stageLabel}
                  </span>
                </div>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Progress bar */}
                {totalTasks > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>
                      {doneCount} of {totalTasks} milestones complete
                    </div>
                    <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 3, overflow: 'hidden', maxWidth: 300 }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPct}%`,
                        background: 'var(--navy)',
                        borderRadius: 3,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )}

                {/* What we've delivered */}
                {doneTasks.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
                      What We&apos;ve Delivered
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {doneTasks.map(task => (
                        <li key={task.id} style={{ fontSize: 13, color: 'var(--ink)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ color: 'var(--success)', fontSize: 10, flexShrink: 0, lineHeight: '18px' }}>✓</span>
                          {task.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Current focus */}
                {inProgressTasks.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
                      Current Focus
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {inProgressTasks.map(task => (
                        <li key={task.id} style={{ fontSize: 13, color: 'var(--ink)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ color: 'var(--navy)', fontSize: 10, flexShrink: 0, lineHeight: '18px' }}>→</span>
                          {task.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recent updates */}
                {activity.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
                      Recent Updates
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activity.map((entry, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'var(--ink)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 11, color: 'var(--ink-faint)', whiteSpace: 'nowrap', marginTop: 1 }}>
                            {fmtDate(entry.created_at)}
                          </span>
                          <span style={{ flex: 1 }}>{entry.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coming up */}
                {notStartedTasks.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
                      Coming Up
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {notStartedTasks.map(task => (
                        <li key={task.id} style={{ fontSize: 13, color: 'var(--ink)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ color: 'var(--ink-faint)', fontSize: 10, flexShrink: 0, lineHeight: '18px' }}>○</span>
                          <span style={{ flex: 1 }}>{task.title}</span>
                          {task.due_date && (
                            <span style={{ fontSize: 12, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                              Due {fmtDate(task.due_date)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Revenue summary */}
                {(invoicedTotal > 0 || totalReceived > 0) && (
                  <div style={{
                    display: 'flex', gap: 24, padding: '14px 16px',
                    background: 'var(--line-soft)', borderRadius: 6, flexWrap: 'wrap',
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>
                        Invoiced to Date
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy)', fontFamily: 'var(--serif)' }}>
                        {fmtCurrency(invoicedTotal)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>
                        Received
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)', fontFamily: 'var(--serif)' }}>
                        {fmtCurrency(totalReceived)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {engagements.length === 0 && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
            padding: '48px 32px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14,
          }}>
            No active engagements found for this company.
          </div>
        )}

        {/* ── Invoice history table ────────────────────────────────────────────── */}
        {companyInvoices.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{
              fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
              color: 'var(--navy)', margin: 0, marginBottom: 16,
            }}>
              Invoice History
            </h3>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)' }}>
                    {['Invoice #', 'Period', 'Amount', 'Sent', 'Status'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: 'var(--ink-faint)',
                        borderBottom: '1px solid var(--line)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companyInvoices.map((inv, i) => {
                    const isPaid = !!inv.paid_date || inv.status === 'paid'
                    return (
                      <tr key={i} style={{ borderBottom: i < companyInvoices.length - 1 ? '1px solid var(--line-soft)' : undefined }}>
                        <td style={{ padding: '11px 16px', color: 'var(--ink)', fontWeight: 500 }}>
                          {inv.invoice_number || '—'}
                        </td>
                        <td style={{ padding: '11px 16px', color: 'var(--ink-soft)' }}>
                          {inv.date_sent ? fmtDate(inv.date_sent) : '—'}
                        </td>
                        <td style={{ padding: '11px 16px', color: 'var(--ink)', fontWeight: 500 }}>
                          {fmtCurrency(inv.amount ?? 0)}
                        </td>
                        <td style={{ padding: '11px 16px', color: 'var(--ink-soft)' }}>
                          {inv.date_sent ? fmtDate(inv.date_sent) : '—'}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                            background: isPaid ? 'var(--success-soft)' : 'var(--warn-soft)',
                            color: isPaid ? 'var(--success)' : 'var(--warn)',
                            letterSpacing: '0.06em',
                          }}>
                            {isPaid ? 'Paid' : 'Outstanding'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
