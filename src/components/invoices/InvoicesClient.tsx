'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Invoice } from '@/lib/types'
import { X, ExternalLink } from 'lucide-react'

interface InvoiceRow extends Invoice {
  engagement?: { id: string; name: string }
  company?: { id: string; name: string }
}

interface Props {
  invoices: InvoiceRow[]
}

function computeStatus(invoice: Invoice): 'paid' | 'overdue' | 'open' | 'draft' | 'sent' {
  if (invoice.paid_date) return 'paid'
  if (invoice.status === 'draft') return 'draft'
  if (invoice.due_date && new Date(invoice.due_date) < new Date()) return 'overdue'
  return invoice.status as 'sent' | 'open'
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  paid:    { bg: 'var(--success-soft)', color: 'var(--success)' },
  overdue: { bg: 'var(--danger-soft)',  color: 'var(--danger)'  },
  open:    { bg: '#f0eefa',             color: 'var(--indigo)'  },
  draft:   { bg: 'var(--line-soft)',    color: 'var(--ink-soft)'},
  sent:    { bg: '#f0eefa',             color: 'var(--indigo)'  },
}

const BADGE: React.CSSProperties = {
  display: 'inline-block', padding: '3px 9px', borderRadius: 3,
  fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
}

export default function InvoicesClient({ invoices }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
  const outstanding = invoices.filter(i => !i.paid_date).reduce((s, i) => s + i.amount, 0)
  const overdue = invoices.filter(i => computeStatus(i) === 'overdue').reduce((s, i) => s + i.amount, 0)

  const paidWithDates = invoices.filter(i => i.paid_date && i.date_sent)
  const avgDays = paidWithDates.length > 0
    ? Math.round(paidWithDates.reduce((s, i) => {
        const days = (new Date(i.paid_date!).getTime() - new Date(i.date_sent!).getTime()) / 86400000
        return s + days
      }, 0) / paidWithDates.length)
    : null

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Invoiced', value: fmt(totalInvoiced), sub: `${invoices.length} invoices` },
          { label: 'Outstanding', value: fmt(outstanding), sub: `${invoices.filter(i => !i.paid_date).length} open`, accent: outstanding > 0 },
          { label: 'Overdue', value: fmt(overdue), sub: `${invoices.filter(i => computeStatus(i) === 'overdue').length} invoices`, accent: overdue > 0, danger: overdue > 0 },
          { label: 'Avg Days to Pay', value: avgDays !== null ? `${avgDays}d` : '—', sub: `${paidWithDates.length} paid` },
        ].map(s => (
          <div key={s.label} style={{
            background: s.danger ? 'var(--danger-soft)' : 'var(--surface)',
            border: `1px solid ${s.danger ? 'rgba(161,48,48,0.2)' : 'var(--line)'}`,
            borderRadius: 8, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 11, color: s.danger ? 'var(--danger)' : 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 600, marginTop: 8, color: s.danger ? 'var(--danger)' : 'var(--navy)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: 'var(--wine)', color: '#fff', padding: '9px 18px', borderRadius: 4, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}
        >
          + New Invoice
        </button>
      </div>

      {invoices.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
          No invoices yet. Click <strong>+ New Invoice</strong> to create one.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Invoice #', 'Client', 'Engagement', 'Amount', 'Sent', 'Due', 'Paid', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const status = computeStatus(inv)
                return (
                  <tr key={inv.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, background: status === 'overdue' ? '#fff8f8' : undefined }}
                    onMouseEnter={e => (e.currentTarget.style.background = status === 'overdue' ? 'var(--danger-soft)' : 'var(--line-soft)')}
                    onMouseLeave={e => (e.currentTarget.style.background = status === 'overdue' ? '#fff8f8' : '')}
                  >
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                      {inv.invoice_number}
                      {(inv as InvoiceRow & { is_recurring?: boolean }).is_recurring && (
                        <span style={{ marginLeft: 6, fontSize: 9, background: 'var(--info-bg, #e6f1fb)', color: '#185FA5', padding: '1px 5px', borderRadius: 3, fontWeight: 600, verticalAlign: 'middle' }}>RECURRING</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 13 }}>{inv.company?.name || '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--ink-soft)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.engagement?.name || '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{fmt(inv.amount)}</td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{fmtDate(inv.date_sent)}</td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: status === 'overdue' ? 'var(--danger)' : 'var(--ink-soft)', fontWeight: status === 'overdue' ? 600 : 400, whiteSpace: 'nowrap' }}>{fmtDate(inv.due_date)}</td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--success)', whiteSpace: 'nowrap' }}>{fmtDate(inv.paid_date)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ ...BADGE, ...STATUS_STYLES[status] }}>{status}</span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <Link href={`/invoices/${inv.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--wine)', textDecoration: 'none' }}>
                        View <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <NewInvoiceModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); router.refresh() }} />
      )}
    </div>
  )
}

function NewInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    invoice_number: '', engagement_id: '', company_id: '',
    amount: '', date_sent: new Date().toISOString().slice(0, 10), due_date: '', notes: '',
    is_recurring: false, billing_frequency: 'monthly', next_billing_date: '', recurring_end_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [engagements, setEngagements] = useState<{ id: string; name: string; company_id: string }[]>([])

  useEffect(() => {
    supabase.from('companies').select('id, name').order('name').then(({ data }) => setCompanies(data ?? []))
    supabase.from('engagements').select('id, name, company_id').order('name').then(({ data }) => setEngagements(data ?? []))
  }, [])

  // Filter engagements by selected company
  const filteredEngagements = form.company_id
    ? engagements.filter(e => e.company_id === form.company_id)
    : engagements

  const save = async () => {
    if (!form.invoice_number.trim()) { setError('Invoice number is required.'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Amount must be greater than 0.'); return }
    setError('')
    setSaving(true)
    const { error: err } = await supabase.from('invoices').insert({
      invoice_number: form.invoice_number.trim(),
      amount: parseFloat(form.amount),
      date_sent: form.date_sent || null,
      due_date: form.due_date || null,
      status: form.date_sent ? 'sent' : 'draft',
      engagement_id: form.engagement_id || null,
      company_id: form.company_id || null,
      notes: form.notes || '',
      is_recurring: form.is_recurring,
      billing_frequency: form.is_recurring ? form.billing_frequency : null,
      next_billing_date: form.is_recurring && form.next_billing_date ? form.next_billing_date : null,
      recurring_end_date: form.is_recurring && form.recurring_end_date ? form.recurring_end_date : null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onCreated()
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
    background: 'var(--bg)', border: '1px solid var(--line)',
    borderRadius: 4, padding: '8px 10px', width: '100%', boxSizing: 'border-box', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase',
    letterSpacing: '0.14em', marginBottom: 5, display: 'block',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line)', padding: 32, width: 540, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>New Invoice</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Invoice # *</label>
              <input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} style={inputStyle} placeholder="INV-001" />
            </div>
            <div>
              <label style={labelStyle}>Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} placeholder="0.00" min="0" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value, engagement_id: '' }))} style={inputStyle}>
              <option value="">— select company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Engagement</label>
            <select value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} style={inputStyle}>
              <option value="">— select engagement —</option>
              {filteredEngagements.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Date Sent</label>
              <input type="date" value={form.date_sent} onChange={e => setForm(f => ({ ...f, date_sent: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--sans)' }} placeholder="Optional notes…" />
          </div>

          {/* Recurring toggle */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--navy)', fontWeight: 500 }}>
              <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              Set as recurring invoice
            </label>
            {form.is_recurring && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Frequency</label>
                  <select value={form.billing_frequency} onChange={e => setForm(f => ({ ...f, billing_frequency: e.target.value }))} style={inputStyle}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Next billing date</label>
                  <input type="date" value={form.next_billing_date} onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>End date (optional)</label>
                  <input type="date" value={form.recurring_end_date} onChange={e => setForm(f => ({ ...f, recurring_end_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)', padding: '9px 18px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', padding: '9px 18px', borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
