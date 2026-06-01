export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Invoice } from '@/lib/types'
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

function computeStatus(inv: Invoice): 'paid' | 'overdue' | 'open' {
  if (inv.paid_date) return 'paid'
  if (inv.due_date && new Date(inv.due_date) < new Date()) return 'overdue'
  return 'open'
}

export default async function InvoicePdfPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      *,
      engagement:engagements(id, name, engagement_type, revenue_type, start_date, end_date,
        revenue_items(id, label, month, forecast_amount, invoice_id)
      ),
      company:companies(id, name, address, contacts(id, name, is_primary, email))
    `)
    .eq('id', id)
    .single()

  if (!invoice) {
    return (
      <html lang="en">
        <head><title>Invoice Not Found — Vérité Health Collective</title></head>
        <body style={{ padding: 48, fontFamily: 'Inter, sans-serif', color: '#a13030' }}>
          Invoice not found.
        </body>
      </html>
    )
  }

  const inv = invoice as Invoice & {
    engagement?: {
      id: string
      name: string
      engagement_type: string
      revenue_type: string | null
      start_date: string | null
      end_date: string | null
      revenue_items?: { id: string; label: string; month: string | null; forecast_amount: number; invoice_id: string | null }[]
    }
    company?: {
      id: string
      name: string
      address?: string
      contacts?: { id: string; name: string; is_primary: boolean; email: string }[]
    }
  }

  const status = computeStatus(inv)
  const statusLabels = { paid: 'PAID', overdue: 'OVERDUE', open: 'OPEN' }
  const statusColors = {
    paid: '#2d6a3e',
    overdue: '#a13030',
    open: '#25314a',
  }

  const invoiceNumber = inv.invoice_number || `INV-${id.slice(0, 8).toUpperCase()}`
  const companyName = inv.company?.name ?? '—'
  const primaryContact = inv.company?.contacts?.find(c => c.is_primary) ?? inv.company?.contacts?.[0]

  // Line items: use linked revenue_items if available, else single line
  const linkedItems = inv.engagement?.revenue_items?.filter(r => r.invoice_id === id) ?? []
  const useLineItems = linkedItems.length > 0

  // Build period label
  const start = inv.engagement?.start_date
  const end = inv.engagement?.end_date
  const periodLabel = start || end
    ? [fmtDate(start), fmtDate(end)].filter(v => v !== '—').join(' – ')
    : null

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{invoiceNumber} — Vérité Health Collective</title>
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
          .page { max-width: 800px; margin: 0 auto; padding: 52px 56px; }
          .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
          .label {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #9a9aa5;
            margin-bottom: 3px;
          }
          .value { color: #25314a; font-size: 13px; }
          hr { border: none; border-top: 1px solid #ead9cd; margin: 28px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          thead tr { background: #5f3e3f; }
          th {
            padding: 10px 14px;
            text-align: left;
            color: #fff;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          td { padding: 10px 14px; border-bottom: 1px solid #f5ebe3; vertical-align: top; }
          .total-section { margin-top: 12px; }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 14px;
            font-size: 13px;
          }
          .total-row.grand {
            background: #5f3e3f;
            color: #fff;
            font-weight: 700;
            font-size: 15px;
            border-radius: 4px;
          }
          .bill-to { background: #faf6f2; border: 1px solid #ead9cd; border-radius: 6px; padding: 16px 20px; }
          .footer {
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1px solid #ead9cd;
            text-align: center;
            font-size: 11px;
            color: #9a9aa5;
            letter-spacing: 0.04em;
          }
          .status-chip {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }
          @media print {
            .no-print { display: none !important; }
            body { font-size: 12px; }
            .page { padding: 18mm 20mm; max-width: 100%; }
            thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .total-row.grand { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
      </head>
      <body>
        {/* Toolbar */}
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
            href={`/invoices/${id}`}
            style={{
              color: '#e3bca6',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              textDecoration: 'none',
            }}
          >
            ← Back to Invoice
          </a>
          <PdfPrintButton />
        </div>

        <div className="page">
          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1
                className="serif"
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: '#25314a',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.1,
                }}
              >
                Vérité Health Collective
              </h1>
              <p style={{ fontSize: 12, color: '#9a9aa5', marginTop: 4 }}>
                Health Collective · Platform
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <p
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#5f3e3f',
                  textTransform: 'uppercase',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Invoice
              </p>
              <table style={{ marginTop: 8, marginLeft: 'auto', width: 'auto', border: 'none' }}>
                <tbody>
                  {[
                    ['Invoice #', invoiceNumber],
                    ['Date', fmtDate(inv.date_sent ?? inv.created_at)],
                    ['Due', fmtDate(inv.due_date)],
                  ].map(([lbl, val]) => (
                    <tr key={lbl}>
                      <td
                        style={{
                          padding: '2px 12px 2px 0',
                          textAlign: 'right',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: '#9a9aa5',
                          borderBottom: 'none',
                        }}
                      >
                        {lbl}
                      </td>
                      <td
                        style={{
                          padding: '2px 0',
                          textAlign: 'right',
                          fontWeight: 600,
                          borderBottom: 'none',
                        }}
                      >
                        {val}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'right', paddingTop: 8, borderBottom: 'none' }}>
                      <span
                        className="status-chip"
                        style={{
                          background: status === 'paid'
                            ? '#e8f1ea'
                            : status === 'overdue'
                            ? '#f5e6e6'
                            : '#d8dde8',
                          color: statusColors[status],
                        }}
                      >
                        {statusLabels[status]}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <hr />

          {/* Bill To */}
          <div style={{ marginBottom: 28 }}>
            <div className="label" style={{ marginBottom: 8 }}>Bill To</div>
            <div className="bill-to">
              <div style={{ fontWeight: 600, fontSize: 15 }}>{companyName}</div>
              {inv.company?.address && (
                <div style={{ fontSize: 12, color: '#5f5f6e', marginTop: 4 }}>
                  {inv.company.address}
                </div>
              )}
              {primaryContact && (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  {primaryContact.name}
                  {primaryContact.email && (
                    <span style={{ color: '#9a9aa5', marginLeft: 8, fontSize: 12 }}>
                      {primaryContact.email}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ textAlign: 'right', width: 140 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {useLineItems ? (
                linkedItems.map(item => (
                  <tr key={item.id}>
                    <td>
                      {item.label}
                      {item.month && (
                        <span style={{ color: '#9a9aa5', fontSize: 12, marginLeft: 8 }}>
                          {fmtDate(item.month + '-01')}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(item.forecast_amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>
                    <strong>
                      {inv.engagement?.name
                        ? `Professional Services — ${inv.engagement.name}`
                        : 'Professional Services'}
                    </strong>
                    {periodLabel && (
                      <div style={{ fontSize: 12, color: '#5f5f6e', marginTop: 3 }}>
                        Service period: {periodLabel}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(inv.amount)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="total-section">
            <div className="total-row">
              <span style={{ color: '#5f5f6e' }}>Subtotal</span>
              <span style={{ fontWeight: 600 }}>{fmtMoney(inv.amount)}</span>
            </div>
            <div className="total-row grand">
              <span>Total Due</span>
              <span>{fmtMoney(inv.amount)}</span>
            </div>
          </div>

          <hr />

          {/* Payment terms */}
          <div style={{ marginBottom: 20 }}>
            <div className="label">Payment Terms</div>
            <div className="value">
              {inv.engagement && 'Net 30 — please remit payment within 30 days of invoice date.'}
              {!inv.engagement && 'Net 30 — please remit payment within 30 days of invoice date.'}
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div style={{ marginBottom: 20 }}>
              <div className="label">Notes</div>
              <div className="value" style={{ whiteSpace: 'pre-wrap' }}>{inv.notes}</div>
            </div>
          )}

          {status === 'paid' && inv.paid_date && (
            <div
              style={{
                background: '#e8f1ea',
                border: '1px solid #c8dec9',
                borderRadius: 6,
                padding: '12px 16px',
                marginBottom: 20,
                fontSize: 13,
                color: '#2d6a3e',
                fontWeight: 600,
              }}
            >
              Payment received on {fmtDate(inv.paid_date)}
            </div>
          )}

          {/* Pay Online link */}
          {status !== 'paid' && (
            <div style={{ marginBottom: 20 }}>
              <div className="label">Pay Online</div>
              <div className="value">
                <a
                  href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'}/pay/${id}`}
                  style={{ color: '#5f3e3f', textDecoration: 'underline', fontSize: 13 }}
                >
                  {`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'}/pay/${id}`}
                </a>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            Vérité Health Collective · veritehealth.com
          </div>
        </div>
      </body>
    </html>
  )
}
