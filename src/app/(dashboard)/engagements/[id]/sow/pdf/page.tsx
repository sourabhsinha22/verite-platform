export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Engagement, Sow, SowDeliverable, SOW_STATUS_LABELS } from '@/lib/types'
import PdfPrintButton from '@/components/reports/PdfPrintButton'

interface Props {
  params: Promise<{ id: string }>
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  return `$${Math.round(v).toLocaleString()}`
}

export default async function SowPdfPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: engagement }, { data: sows }] = await Promise.all([
    supabase
      .from('engagements')
      .select('*, company:companies(id, name, address)')
      .eq('id', id)
      .single(),
    supabase
      .from('sows')
      .select('*, phases:sow_phases(*, deliverables:sow_deliverables(*)), deliverables:sow_deliverables(*)')
      .eq('engagement_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const sow: Sow | null = sows && sows.length > 0 ? sows[0] : null
  const eng = engagement as (Engagement & { company?: { id: string; name: string; address?: string } }) | null
  const clientName = eng?.company?.name ?? 'Client'
  const deliverables: SowDeliverable[] = sow?.deliverables ?? []
  const totalPayments = deliverables.reduce((s, d) => s + (d.payment_amount ?? 0), 0)

  const billingLabels: Record<string, string> = {
    monthly: 'Monthly',
    milestone: 'Per Milestone',
    'on-completion': 'Upon Completion',
  }

  const revenueLabels: Record<string, string> = {
    retainer: 'Retainer',
    'revenue-share': 'Revenue Share',
    project: 'Project-Based',
    hourly: 'Hourly',
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          {sow ? `${sow.title} — Vérité Health Collective` : 'Statement of Work — Vérité Health Collective'}
        </title>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            color: #25314a;
            background: #fff;
            font-size: 13px;
            line-height: 1.65;
          }
          .no-print { display: block; }
          .page { max-width: 820px; margin: 0 auto; padding: 48px 52px; }
          h1, h2, h3, .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
          .section-heading {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #5f3e3f;
            border-bottom: 1.5px solid #5f3e3f;
            padding-bottom: 4px;
            margin-bottom: 12px;
            margin-top: 32px;
          }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
          .label {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #9a9aa5;
            margin-bottom: 2px;
          }
          .value { color: #25314a; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th {
            text-align: left;
            padding: 8px 10px;
            background: #f5ebe3;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #5f3e3f;
            border-bottom: 1px solid #ead9cd;
          }
          td { padding: 8px 10px; border-bottom: 1px solid #f5ebe3; vertical-align: top; }
          tr:last-child td { border-bottom: none; }
          .total-row td { font-weight: 600; background: #faf6f2; border-top: 1.5px solid #ead9cd; }
          .sig-block { margin-top: 40px; }
          .sig-line {
            border-bottom: 1px solid #25314a;
            width: 200px;
            margin-top: 36px;
            margin-bottom: 4px;
          }
          .sig-name { font-weight: 600; font-size: 14px; }
          .sig-title { font-size: 12px; color: #5f5f6e; }
          hr { border: none; border-top: 1.5px solid #ead9cd; margin: 24px 0; }
          .body-text { color: #25314a; line-height: 1.7; white-space: pre-wrap; }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            background: #faf6f2;
            border: 1px solid #ead9cd;
            border-radius: 6px;
            padding: 16px 20px;
          }
          .status-chip {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            background: #f5f3ee;
            color: #5f5f6e;
          }
          @media print {
            .no-print { display: none !important; }
            body { font-size: 12px; }
            .page { padding: 20mm 18mm; max-width: 100%; }
            .section-heading { margin-top: 24px; }
            h2 { page-break-after: avoid; }
            .no-break { page-break-inside: avoid; }
          }
        `}</style>
      </head>
      <body>
        {/* Toolbar — hidden on print */}
        <div
          className="no-print"
          style={{
            position: 'sticky',
            top: 0,
            background: '#25314a',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
          }}
        >
          <a
            href={`/engagements/${id}/sow`}
            style={{
              color: '#e3bca6',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              textDecoration: 'none',
            }}
          >
            ← Back to SOW
          </a>
          <PdfPrintButton />
        </div>

        <div className="page">
          {!sow && (
            <p style={{ color: '#a13030', fontFamily: 'Inter, sans-serif', padding: '40px 0' }}>
              No Statement of Work found for this engagement.
            </p>
          )}

          {sow && (
            <>
              {/* Letterhead */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <h1
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 32,
                      fontWeight: 700,
                      color: '#25314a',
                      letterSpacing: '-0.5px',
                    }}
                  >
                    Vérité Health Collective
                  </h1>
                  <p style={{ fontSize: 12, color: '#9a9aa5', marginTop: 2 }}>
                    Health Collective · Platform
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: '#5f3e3f',
                      marginBottom: 4,
                    }}
                  >
                    Statement of Work
                  </p>
                  <p style={{ fontSize: 12, color: '#5f5f6e' }}>
                    Version {sow.version} ·{' '}
                    <span className="status-chip" style={{ fontSize: 10 }}>
                      {SOW_STATUS_LABELS[sow.status]}
                    </span>
                  </p>
                </div>
              </div>

              <hr />

              {/* Two-column header */}
              <div className="two-col" style={{ marginBottom: 24 }}>
                <div>
                  <div className="label">Prepared for</div>
                  <div className="value" style={{ fontWeight: 600, fontSize: 15 }}>{clientName}</div>
                  {eng?.company?.address && (
                    <div className="value" style={{ fontSize: 12, color: '#5f5f6e', marginTop: 2 }}>{eng.company.address}</div>
                  )}
                  {sow.client_signatory && (
                    <div style={{ marginTop: 8 }}>
                      <div className="label">Attention</div>
                      <div className="value">{sow.client_signatory}</div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="label">Prepared by</div>
                  <div className="value" style={{ fontWeight: 600, fontSize: 15 }}>Vérité Health Collective</div>
                  {sow.verite_lead && (
                    <div style={{ marginTop: 8 }}>
                      <div className="label">Lead</div>
                      <div className="value">{sow.verite_lead}</div>
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <div className="label">Effective Date</div>
                    <div className="value">{fmtDate(sow.effective_date)}</div>
                  </div>
                </div>
              </div>

              <hr />

              {/* 1. Engagement Overview */}
              <div className="section-heading">1. Engagement Overview</div>
              <div className="meta-grid no-break">
                <div>
                  <div className="label">Engagement</div>
                  <div className="value">{eng?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="label">Type</div>
                  <div className="value">
                    {sow.revenue_type ? revenueLabels[sow.revenue_type] ?? sow.revenue_type : '—'}
                  </div>
                </div>
                <div>
                  <div className="label">Total Value</div>
                  <div className="value" style={{ fontWeight: 600 }}>{fmtMoney(sow.total_value)}</div>
                </div>
                <div>
                  <div className="label">Payment Terms</div>
                  <div className="value">{sow.payment_terms || '—'}</div>
                </div>
                <div>
                  <div className="label">Billing Frequency</div>
                  <div className="value">
                    {sow.billing_frequency ? billingLabels[sow.billing_frequency] ?? sow.billing_frequency : '—'}
                  </div>
                </div>
                <div>
                  <div className="label">Expiry Date</div>
                  <div className="value">{fmtDate(sow.expiry_date)}</div>
                </div>
              </div>

              {/* 2–6 Narrative sections */}
              {[
                { num: 2, title: 'Objectives', content: sow.objectives },
                { num: 3, title: 'Scope of Work', content: sow.scope_of_work },
                { num: 4, title: 'Out of Scope', content: sow.out_of_scope },
                { num: 5, title: 'Assumptions', content: sow.assumptions },
                { num: 6, title: 'Client Responsibilities', content: sow.client_responsibilities },
              ].map(s =>
                s.content ? (
                  <div key={s.num} className="no-break">
                    <div className="section-heading">{s.num}. {s.title}</div>
                    <p className="body-text">{s.content}</p>
                  </div>
                ) : null
              )}

              {/* 7. Deliverables */}
              {deliverables.length > 0 && (
                <div>
                  <div className="section-heading">7. Deliverables &amp; Payment Schedule</div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 32 }}>#</th>
                        <th>Deliverable</th>
                        <th>Due Date</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliverables.map((d, i) => (
                        <tr key={d.id}>
                          <td style={{ color: '#9a9aa5' }}>{i + 1}</td>
                          <td>
                            <strong>{d.title || '—'}</strong>
                            {d.description && (
                              <div style={{ fontSize: 12, color: '#5f5f6e', marginTop: 2 }}>
                                {d.description}
                              </div>
                            )}
                            {d.is_milestone && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  background: '#faf2dc',
                                  color: '#b8841a',
                                  fontSize: 9,
                                  fontWeight: 600,
                                  letterSpacing: '0.1em',
                                  textTransform: 'uppercase',
                                  padding: '1px 6px',
                                  borderRadius: 2,
                                  marginTop: 3,
                                }}
                              >
                                Milestone
                              </span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.due_date)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {fmtMoney(d.payment_amount)}
                          </td>
                        </tr>
                      ))}
                      {totalPayments > 0 && (
                        <tr className="total-row">
                          <td colSpan={3} style={{ textAlign: 'right', paddingRight: 10 }}>
                            Total
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(totalPayments)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 8. Payment Terms */}
              <div className="section-heading no-break">8. Payment Terms</div>
              <p className="body-text">
                {[
                  sow.payment_terms && `Payment terms: ${sow.payment_terms}.`,
                  sow.billing_frequency &&
                    `Billing frequency: ${billingLabels[sow.billing_frequency] ?? sow.billing_frequency}.`,
                ]
                  .filter(Boolean)
                  .join(' ') || '—'}
              </p>

              {/* 9. Notes */}
              {sow.notes && (
                <div className="no-break">
                  <div className="section-heading">9. Notes</div>
                  <p className="body-text">{sow.notes}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="section-heading">Signatures</div>
              <div className="two-col sig-block no-break">
                <div>
                  <div className="sig-name">Vérité Health Collective</div>
                  <div className="sig-line" />
                  <div className="value">{sow.verite_signatory || 'Tana Whitt'}</div>
                  <div className="sig-title">Authorized Representative</div>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#9a9aa5' }}>Date: ___________</div>
                </div>
                <div>
                  <div className="sig-name">{clientName}</div>
                  <div className="sig-line" />
                  <div className="value">{sow.client_signatory || '___________________________'}</div>
                  <div className="sig-title">Authorized Representative</div>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#9a9aa5' }}>Date: ___________</div>
                </div>
              </div>
            </>
          )}
        </div>
      </body>
    </html>
  )
}
