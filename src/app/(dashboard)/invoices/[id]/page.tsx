export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Invoice } from '@/lib/types'
import InvoiceDetailActions from '@/components/invoices/InvoiceDetailActions'
import CopyPaymentLink from '@/components/invoices/CopyPaymentLink'

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

const STATUS_STYLES = {
  paid: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Paid' },
  overdue: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Overdue' },
  open: { bg: '#d8dde8', color: 'var(--navy)', label: 'Open' },
}

const metaLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-faint)',
  fontFamily: 'var(--sans)',
  marginBottom: 3,
}

const metaValueStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--ink)',
  fontFamily: 'var(--sans)',
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, engagement:engagements(id, name), company:companies(id, name)')
    .eq('id', id)
    .single()

  if (!invoice) {
    return (
      <div style={{ padding: 48, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
        Invoice not found.{' '}
        <Link href="/invoices" style={{ color: 'var(--wine)', textDecoration: 'underline' }}>
          Back to invoices
        </Link>
      </div>
    )
  }

  const computedStatus = computeStatus(invoice as Invoice)
  const statusStyle = STATUS_STYLES[computedStatus]
  const companyName =
    (invoice as Invoice & { company?: { name: string } }).company?.name ?? '—'
  const engagementName =
    (invoice as Invoice & { engagement?: { id: string; name: string } }).engagement?.name ?? '—'
  const engagementId =
    (invoice as Invoice & { engagement?: { id: string; name: string } }).engagement?.id

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 8px' }}>
      {/* Back link */}
      <Link
        href="/invoices"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--ink-soft)',
          fontSize: 14,
          fontFamily: 'var(--sans)',
          textDecoration: 'none',
          marginBottom: 24,
        }}
      >
        ← Invoices
      </Link>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 40,
              fontWeight: 600,
              color: 'var(--navy)',
              letterSpacing: '-0.5px',
              margin: 0,
            }}
          >
            {invoice.invoice_number || `INV-${id.slice(0, 6).toUpperCase()}`}
          </h1>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: statusStyle.bg,
                color: statusStyle.color,
                fontFamily: 'var(--sans)',
              }}
            >
              {statusStyle.label}
            </span>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
              {fmtMoney(invoice.amount)}
            </span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        {/* Left: details */}
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: 'var(--line-soft)',
              padding: '14px 20px',
              fontFamily: 'var(--sans)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
            }}
          >
            Invoice Details
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { label: 'Client', value: companyName },
              {
                label: 'Engagement',
                value: engagementId ? (
                  <Link
                    href={`/engagements/${engagementId}`}
                    style={{ color: 'var(--wine)', textDecoration: 'underline', fontFamily: 'var(--sans)', fontSize: 14 }}
                  >
                    {engagementName}
                  </Link>
                ) : (
                  engagementName
                ),
              },
              { label: 'Amount', value: fmtMoney(invoice.amount) },
              { label: 'Status', value: statusStyle.label },
              { label: 'Date Sent', value: fmtDate(invoice.date_sent) },
              { label: 'Due Date', value: fmtDate(invoice.due_date) },
              { label: 'Paid Date', value: fmtDate(invoice.paid_date) },
            ].map((row, i) => (
              <div
                key={row.label}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--line-soft)',
                  borderRight: i % 2 === 0 ? '1px solid var(--line-soft)' : 'none',
                }}
              >
                <div style={metaLabelStyle}>{row.label}</div>
                {typeof row.value === 'string' ? (
                  <div style={metaValueStyle}>{row.value}</div>
                ) : (
                  row.value
                )}
              </div>
            ))}

            {/* Notes — full width */}
            <div
              style={{
                padding: '16px 20px',
                gridColumn: '1 / -1',
              }}
            >
              <div style={metaLabelStyle}>Notes</div>
              <div
                style={{
                  ...metaValueStyle,
                  color: invoice.notes ? 'var(--ink)' : 'var(--ink-faint)',
                  fontStyle: invoice.notes ? 'normal' : 'italic',
                }}
              >
                {invoice.notes || 'No notes'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: actions panel */}
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: 'var(--line-soft)',
              padding: '14px 20px',
              fontFamily: 'var(--sans)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
            }}
          >
            Actions
          </div>
          <div style={{ padding: 16 }}>
            <CopyPaymentLink invoiceId={invoice.id} />
            <InvoiceDetailActions
              invoiceId={invoice.id}
              status={computedStatus}
              isPaid={!!invoice.paid_date}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
