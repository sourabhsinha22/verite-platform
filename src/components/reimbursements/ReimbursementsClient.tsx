'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Reimbursement } from '@/lib/types'

interface Props {
  reimbursements: Reimbursement[]
}

const inputStyle = { padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--ink-soft)', display: 'flex' as const, flexDirection: 'column' as const, gap: 5 }

function ReimbModal({ mode, initial, existingClients, onClose }: {
  mode: 'add' | 'edit'
  initial?: Partial<Reimbursement>
  existingClients: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    client: initial?.client ?? '',
    description: initial?.description ?? '',
    amount_out: initial?.amount_out != null ? String(initial.amount_out) : '',
    amount_in: initial?.amount_in != null ? String(initial.amount_in) : '',
    status: initial?.status ?? 'pending',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.date || !form.client || !form.description || !form.amount_out) {
      setError('Date, client, description, and amount paid out are required'); return
    }
    const amount_out = parseFloat(form.amount_out.replace(/,/g, ''))
    const amount_in = form.amount_in ? parseFloat(form.amount_in.replace(/,/g, '')) : 0
    if (isNaN(amount_out)) { setError('Invalid amount'); return }

    setSaving(true); setError('')
    const payload = { date: form.date, client: form.client, description: form.description, amount_out, amount_in, status: form.status, notes: form.notes }

    if (mode === 'edit' && initial?.id) {
      const { error: err } = await supabase.from('reimbursements').update(payload).eq('id', initial.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('reimbursements').insert(payload)
      if (err) { setError(err.message); setSaving(false); return }
    }
    setSaving(false); onClose(); router.refresh()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>
          {mode === 'edit' ? 'Edit Reimbursement' : 'Add Reimbursement'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>Date<input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Status
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Reimbursement['status'] }))} style={inputStyle}>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="received">Received</option>
              </select>
            </label>
          </div>
          <label style={labelStyle}>Client
            <input list="reimb-clients-list" type="text" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="Client name" style={inputStyle} />
            <datalist id="reimb-clients-list">{existingClients.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label style={labelStyle}>Description<input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>Amount Paid Out ($)<input type="text" value={form.amount_out} onChange={e => setForm(f => ({ ...f, amount_out: e.target.value }))} placeholder="e.g. 250" style={inputStyle} /></label>
            <label style={labelStyle}>Amount Received ($) <span style={{ fontWeight: 400, color: 'var(--ink-faint)', fontSize: 11 }}>(optional)</span>
              <input type="text" value={form.amount_in} onChange={e => setForm(f => ({ ...f, amount_in: e.target.value }))} placeholder="e.g. 0" style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>Notes<input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} /></label>
        </div>
        {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ReimbursementsClient({ reimbursements }: Props) {
  const [open, setOpen] = useState(false)
  const existingClients = Array.from(new Set(reimbursements.map(r => r.client)))

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none' }}>
        Add Reimbursement
      </button>
      {open && <ReimbModal mode="add" existingClients={existingClients} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ReimbRowActions({ reimbursement, existingClients }: { reimbursement: Reimbursement; existingClients: string[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [modal, setModal] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Delete this reimbursement?')) return
    await supabase.from('reimbursements').delete().eq('id', reimbursement.id)
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setModal(true)} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Edit</button>
        <button onClick={handleDelete} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>Delete</button>
      </div>
      {modal && <ReimbModal mode="edit" initial={reimbursement} existingClients={existingClients} onClose={() => setModal(false)} />}
    </>
  )
}
