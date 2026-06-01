export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Invoice } from '@/lib/types'

interface Props {
  params: Promise<{ invoiceId: string }>
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  return `$${Math.round(v).toLocaleString()}`
}

export default async function PayInvoicePage({ params }: Props) {
  const { invoiceId } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, engagement:engagements(id, name), company:companies(id, name, contacts(id, name, email, is_primary))')
    .eq('id', invoiceId)
    .single()

  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  if (!invoice) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center', color: '#5f5f6e' }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: '#ead9cd' }}>×</div>
          <h1 style={{ fontSize: 24, color: '#25314a', marginBottom: 8 }}>Invoice Not Found</h1>
          <p style={{ fontSize: 14 }}>This payment link may have expired or is invalid.</p>
          <p style={{ marginTop: 24, fontSize: 13 }}>
            Questions? Contact us at{' '}
            <a href="mailto:tana@veritehealth.com" style={{ color: '#5f3e3f' }}>tana@veritehealth.com</a>
          </p>
        </div>
      </div>
    )
  }

  const inv = invoice as Invoice & {
    engagement?: { id: string; name: string }
    company?: { id: string; name: string; contacts?: { id: string; name: string; email: string; is_primary: boolean }[] }
  }

  const isPaid = !!inv.paid_date
  const invoiceNumber = inv.invoice_number || `INV-${invoiceId.slice(0, 8).toUpperCase()}`
  const companyName = inv.company?.name ?? 'Valued Client'
  const engagementName = inv.engagement?.name ?? null

  if (isPaid) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf7f3', fontFamily: 'Georgia, serif', padding: '60px 24px' }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          {/* Branding */}
          <div style={{ marginBottom: 40, textAlign: 'center' }}>
            <h1 style={{ fontSize: 30, fontWeight: 600, color: '#25314a', margin: 0 }}>
              Vérité<span style={{ fontStyle: 'italic', color: '#5f3e3f' }}> Health Collective</span>
            </h1>
            <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9a9aa5', margin: '6px 0 0' }}>
              Invoice Portal
            </p>
          </div>

          {/* Paid confirmation */}
          <div style={{
            background: '#fff', border: '1px solid #ead9cd', borderRadius: 12,
            padding: '40px 36px', textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#e8f1ea',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 28,
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#2d6a3e', margin: '0 0 8px' }}>Payment Received</h2>
            <p style={{ color: '#5f5f6e', fontSize: 14, margin: '0 0 24px' }}>
              Invoice {invoiceNumber} has been paid. Thank you!
            </p>
            <div style={{
              background: '#f5ebe3', borderRadius: 8, padding: '16px 20px',
              display: 'inline-block', textAlign: 'left', minWidth: 280,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#9a9aa5' }}>Invoice</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#25314a' }}>{invoiceNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#9a9aa5' }}>Amount</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#25314a' }}>{fmtMoney(inv.amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#9a9aa5' }}>Paid On</span>
                <span style={{ fontSize: 13, color: '#2d6a3e', fontWeight: 600 }}>{fmtDate(inv.paid_date)}</span>
              </div>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9a9aa5', marginTop: 32 }}>
            Questions? Contact{' '}
            <a href="mailto:tana@veritehealth.com" style={{ color: '#5f3e3f', textDecoration: 'underline' }}>
              tana@veritehealth.com
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf7f3', fontFamily: 'Georgia, serif', padding: '60px 24px' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {/* Branding */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <h1 style={{ fontSize: 30, fontWeight: 600, color: '#25314a', margin: 0 }}>
            Vérité<span style={{ fontStyle: 'italic', color: '#5f3e3f' }}> Health Collective</span>
          </h1>
          <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9a9aa5', margin: '6px 0 0' }}>
            Invoice Portal
          </p>
        </div>

        {/* Invoice card */}
        <div style={{
          background: '#fff', border: '1px solid #ead9cd', borderRadius: 12,
          overflow: 'hidden', marginBottom: 16,
        }}>
          {/* Header */}
          <div style={{
            background: '#5f3e3f', padding: '24px 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e3bca6', marginBottom: 4 }}>
                Invoice
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>{invoiceNumber}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e3bca6', marginBottom: 4 }}>
                Amount Due
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{fmtMoney(inv.amount)}</div>
            </div>
          </div>

          {/* Details */}
          <div style={{ padding: '24px 28px' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
              background: '#faf6f2', border: '1px solid #ead9cd', borderRadius: 8,
              overflow: 'hidden', marginBottom: 24,
            }}>
              {[
                { label: 'Client', value: companyName },
                { label: 'Due Date', value: fmtDate(inv.due_date) },
                ...(engagementName ? [{ label: 'Description', value: engagementName }] : []),
              ].map((row, i) => (
                <div
                  key={row.label}
                  style={{
                    padding: '14px 18px',
                    borderRight: i % 2 === 0 ? '1px solid #ead9cd' : 'none',
                    borderBottom: i < 2 ? '1px solid #ead9cd' : 'none',
                    gridColumn: engagementName && i === 2 ? '1 / -1' : 'auto',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9aa5', marginBottom: 4 }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize: 14, color: '#25314a', fontWeight: 500 }}>{row.value}</div>
                </div>
              ))}
            </div>

            {/* Payment section */}
            {stripePublishableKey ? (
              <div style={{
                background: '#f5ebe3', border: '1px solid #ead9cd', borderRadius: 8,
                padding: '20px', marginBottom: 20, textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, color: '#5f5f6e', margin: '0 0 16px' }}>
                  Secure online payment coming soon.
                </p>
              </div>
            ) : (
              <div style={{
                background: '#f5ebe3', border: '1px solid #ead9cd', borderRadius: 8,
                padding: '24px', marginBottom: 20, textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, color: '#5f5f6e', margin: '0 0 20px', lineHeight: 1.6 }}>
                  To pay this invoice, please contact your Vérité account manager.
                </p>
                <a
                  href={`mailto:tana@veritehealth.com?subject=Payment for Invoice ${invoiceNumber}`}
                  style={{
                    display: 'inline-block', background: '#5f3e3f', color: '#fff',
                    padding: '12px 28px', borderRadius: 4, textDecoration: 'none',
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  Contact Us
                </a>
              </div>
            )}

            {/* Payment terms */}
            <div style={{ fontSize: 12, color: '#9a9aa5', lineHeight: 1.6, marginBottom: 12 }}>
              <strong style={{ color: '#5f5f6e' }}>Payment Terms:</strong> Net 30 — please remit payment within 30 days of invoice date.
            </div>

            {/* Notes */}
            {inv.notes && (
              <div style={{ fontSize: 12, color: '#9a9aa5', lineHeight: 1.6 }}>
                <strong style={{ color: '#5f5f6e' }}>Notes:</strong> {inv.notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#9a9aa5', padding: '12px 0' }}>
          Powered by{' '}
          <strong style={{ color: '#5f3e3f' }}>Vérité Health Collective</strong>
          {' '}· Secure Invoice Portal
        </div>
      </div>
    </div>
  )
}
