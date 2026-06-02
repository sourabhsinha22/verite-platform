'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Contractor, ContractorPayment } from '@/lib/types'

interface Props {
  contractors: Contractor[]
}

export default function ContractorsClient({ contractors }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [modal, setModal] = useState<'none' | 'addContractor' | 'addPayment'>('none')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [contractorForm, setContractorForm] = useState({ name: '', role: '', email: '', phone: '', w9_on_file: false, notes: '' })
  const [paymentForm, setPaymentForm] = useState({ contractor_id: '', date: new Date().toISOString().slice(0, 10), amount: '', description: '' })

  const inputStyle = { padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--ink-soft)', display: 'flex' as const, flexDirection: 'column' as const, gap: 5 }

  const handleSaveContractor = async () => {
    if (!contractorForm.name) { setError('Name is required'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('contractors').insert({ ...contractorForm })
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setModal('none'); setContractorForm({ name: '', role: '', email: '', phone: '', w9_on_file: false, notes: '' }); router.refresh()
  }

  const handleSavePayment = async () => {
    if (!paymentForm.contractor_id || !paymentForm.date || !paymentForm.amount) { setError('Contractor, date, and amount are required'); return }
    const amount = parseFloat(paymentForm.amount.replace(/,/g, ''))
    if (isNaN(amount)) { setError('Invalid amount'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('contractor_payments').insert({ contractor_id: paymentForm.contractor_id, date: paymentForm.date, amount, description: paymentForm.description })
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setModal('none'); setPaymentForm({ contractor_id: '', date: new Date().toISOString().slice(0, 10), amount: '', description: '' }); router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => { setModal('addContractor'); setError('') }} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none' }}>
          Add Contractor
        </button>
        <button onClick={() => { setModal('addPayment'); setError('') }} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--surface)', color: 'var(--navy)', border: '1px solid var(--line)' }}>
          Log Payment
        </button>
      </div>

      {modal === 'addContractor' && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal('none') }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>Add Contractor</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>Name *<input type="text" value={contractorForm.name} onChange={e => setContractorForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></label>
              <label style={labelStyle}>Role<input type="text" value={contractorForm.role} onChange={e => setContractorForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Designer, Developer" style={inputStyle} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={labelStyle}>Email<input type="email" value={contractorForm.email} onChange={e => setContractorForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></label>
                <label style={labelStyle}>Phone<input type="text" value={contractorForm.phone} onChange={e => setContractorForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} /></label>
              </div>
              <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={contractorForm.w9_on_file} onChange={e => setContractorForm(f => ({ ...f, w9_on_file: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <span>W-9 on file</span>
              </label>
              <label style={labelStyle}>Notes<input type="text" value={contractorForm.notes} onChange={e => setContractorForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} /></label>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal('none')} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Cancel</button>
              <button onClick={handleSaveContractor} disabled={saving} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'addPayment' && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal('none') }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>Log Payment</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>Contractor *
                <select value={paymentForm.contractor_id} onChange={e => setPaymentForm(f => ({ ...f, contractor_id: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="">Select contractor…</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Date *<input type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></label>
              <label style={labelStyle}>Amount ($) *<input type="text" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 1500" style={inputStyle} /></label>
              <label style={labelStyle}>Description<input type="text" value={paymentForm.description} onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} /></label>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal('none')} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Cancel</button>
              <button onClick={handleSavePayment} disabled={saving} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ContractorRowActions({ contractor }: { contractor: Contractor }) {
  const router = useRouter()
  const supabase = createClient()
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: contractor.name, role: contractor.role ?? '', email: contractor.email ?? '', phone: contractor.phone ?? '', w9_on_file: contractor.w9_on_file ?? false, notes: contractor.notes ?? '' })

  const inputStyle = { padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--ink-soft)', display: 'flex' as const, flexDirection: 'column' as const, gap: 5 }

  const handleSave = async () => {
    setSaving(true)
    const { error: err } = await supabase.from('contractors').update(form).eq('id', contractor.id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setModal(false); router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete contractor "${contractor.name}"? This will also delete their payment history.`)) return
    await supabase.from('contractor_payments').delete().eq('contractor_id', contractor.id)
    await supabase.from('contractors').delete().eq('id', contractor.id)
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setModal(true)} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Edit</button>
        <button onClick={handleDelete} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>Delete</button>
      </div>
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>Edit Contractor</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>Name<input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></label>
              <label style={labelStyle}>Role<input type="text" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={labelStyle}>Email<input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></label>
                <label style={labelStyle}>Phone<input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} /></label>
              </div>
              <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={form.w9_on_file} onChange={e => setForm(f => ({ ...f, w9_on_file: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <span>W-9 on file</span>
              </label>
              <label style={labelStyle}>Notes<input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} /></label>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(false)} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function PaymentRowActions({ payment, contractors }: { payment: ContractorPayment; contractors: Contractor[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ contractor_id: payment.contractor_id, date: payment.date, amount: String(payment.amount), description: payment.description ?? '' })

  const inputStyle = { padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--ink-soft)', display: 'flex' as const, flexDirection: 'column' as const, gap: 5 }

  const handleSave = async () => {
    const amount = parseFloat(form.amount.replace(/,/g, ''))
    if (isNaN(amount)) { setError('Invalid amount'); return }
    setSaving(true)
    const { error: err } = await supabase.from('contractor_payments').update({ contractor_id: form.contractor_id, date: form.date, amount, description: form.description }).eq('id', payment.id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setModal(false); router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this payment?')) return
    await supabase.from('contractor_payments').delete().eq('id', payment.id)
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setModal(true)} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Edit</button>
        <button onClick={handleDelete} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>Delete</button>
      </div>
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>Edit Payment</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>Contractor
                <select value={form.contractor_id} onChange={e => setForm(f => ({ ...f, contractor_id: e.target.value }))} style={{ ...inputStyle }}>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Date<input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></label>
              <label style={labelStyle}>Amount ($)<input type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} /></label>
              <label style={labelStyle}>Description<input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} /></label>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(false)} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
