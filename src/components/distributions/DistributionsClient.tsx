'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Distribution } from '@/lib/types'

const DEFAULT_PARTNERS = ['Tana Whitt', 'Shannon Chema', 'Charissa Duffy']

interface Props {
  distributions: Distribution[]
}

type ModalMode = 'none' | 'add' | 'bulk' | 'edit'

export default function DistributionsClient({ distributions }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [modal, setModal] = useState<ModalMode>('none')
  const [editTarget, setEditTarget] = useState<Distribution | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Existing recipients from data
  const existingRecipients = Array.from(new Set([...DEFAULT_PARTNERS, ...distributions.map(d => d.recipient)]))

  // Single add form
  const [form, setForm] = useState({ recipient: '', date: new Date().toISOString().slice(0, 10), amount: '', notes: '' })

  // Bulk add form: date + amounts per partner
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10))
  const [bulkAmounts, setBulkAmounts] = useState<Record<string, string>>({})
  const [bulkNewRecipient, setBulkNewRecipient] = useState('')
  const [bulkNewAmount, setBulkNewAmount] = useState('')

  const openEdit = (d: Distribution) => {
    setEditTarget(d)
    setForm({ recipient: d.recipient, date: d.date, amount: String(d.amount), notes: d.notes ?? '' })
    setModal('edit')
  }

  const openAdd = () => {
    setForm({ recipient: '', date: new Date().toISOString().slice(0, 10), amount: '', notes: '' })
    setError('')
    setModal('add')
  }

  const openBulk = () => {
    setBulkDate(new Date().toISOString().slice(0, 10))
    setBulkAmounts({})
    setBulkNewRecipient('')
    setBulkNewAmount('')
    setError('')
    setModal('bulk')
  }

  const handleSaveSingle = async () => {
    if (!form.recipient || !form.date || !form.amount) { setError('Recipient, date, and amount are required'); return }
    const amount = parseFloat(form.amount.replace(/,/g, ''))
    if (isNaN(amount)) { setError('Invalid amount'); return }
    setSaving(true); setError('')
    if (modal === 'edit' && editTarget) {
      const { error: err } = await supabase.from('distributions').update({ recipient: form.recipient, date: form.date, amount, notes: form.notes }).eq('id', editTarget.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('distributions').insert({ recipient: form.recipient, date: form.date, amount, notes: form.notes })
      if (err) { setError(err.message); setSaving(false); return }
    }
    setSaving(false); setModal('none'); router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this distribution?')) return
    await supabase.from('distributions').delete().eq('id', id)
    router.refresh()
  }

  const handleBulkSave = async () => {
    setError('')
    const entries: { recipient: string; date: string; amount: number; notes: string }[] = []
    for (const [recipient, amt] of Object.entries(bulkAmounts)) {
      const a = parseFloat(amt.replace(/,/g, ''))
      if (!isNaN(a) && a > 0) entries.push({ recipient, date: bulkDate, amount: a, notes: '' })
    }
    if (bulkNewRecipient && bulkNewAmount) {
      const a = parseFloat(bulkNewAmount.replace(/,/g, ''))
      if (!isNaN(a) && a > 0) entries.push({ recipient: bulkNewRecipient, date: bulkDate, amount: a, notes: '' })
    }
    if (entries.length === 0) { setError('Enter at least one amount'); return }
    setSaving(true)
    const { error: err } = await supabase.from('distributions').insert(entries)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setModal('none'); router.refresh()
  }

  const inputStyle = { padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--ink-soft)', display: 'flex' as const, flexDirection: 'column' as const, gap: 5 }

  return (
    <>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={openAdd} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none' }}>
          Add Distribution
        </button>
        <button onClick={openBulk} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--surface)', color: 'var(--navy)', border: '1px solid var(--line)' }}>
          Bulk Add
        </button>
      </div>

      {/* Edit/Delete buttons for each row — rendered inline */}
      {distributions.map(d => (
        <div key={d.id} id={`dist-actions-${d.id}`} style={{ display: 'none' }}>
          <button onClick={() => openEdit(d)}>Edit</button>
          <button onClick={() => handleDelete(d.id)}>Delete</button>
        </div>
      ))}

      {/* Single Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal('none') }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>
              {modal === 'edit' ? 'Edit Distribution' : 'Add Distribution'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>
                Recipient
                <input list="recipients-list" type="text" value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} placeholder="e.g. Tana Whitt" style={inputStyle} />
                <datalist id="recipients-list">
                  {existingRecipients.map(r => <option key={r} value={r} />)}
                </datalist>
              </label>
              <label style={labelStyle}>
                Date
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Amount ($)
                <input type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 5000" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Notes
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" style={inputStyle} />
              </label>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal('none')} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Cancel</button>
              <button onClick={handleSaveSingle} disabled={saving} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {modal === 'bulk' && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal('none') }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>
              Bulk Add Distributions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>
                Distribution Date
                <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} style={inputStyle} />
              </label>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: -6 }}>Amounts per Partner</div>
              {existingRecipients.map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>{r}</span>
                  <input
                    type="text"
                    value={bulkAmounts[r] ?? ''}
                    onChange={e => setBulkAmounts(a => ({ ...a, [r]: e.target.value }))}
                    placeholder="$0"
                    style={{ ...inputStyle, width: 120, flex: 'none' }}
                  />
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', gap: 10 }}>
                <input type="text" value={bulkNewRecipient} onChange={e => setBulkNewRecipient(e.target.value)} placeholder="New recipient name" style={{ ...inputStyle, flex: 1 }} />
                <input type="text" value={bulkNewAmount} onChange={e => setBulkNewAmount(e.target.value)} placeholder="$0" style={{ ...inputStyle, width: 100, flex: 'none' }} />
              </div>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal('none')} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>Cancel</button>
              <button onClick={handleBulkSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Row action buttons (client component to avoid server event handlers)
export function DistRowActions({ distribution, existingRecipients }: { distribution: Distribution; existingRecipients: string[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ recipient: distribution.recipient, date: distribution.date, amount: String(distribution.amount), notes: distribution.notes ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputStyle = { padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--ink-soft)', display: 'flex' as const, flexDirection: 'column' as const, gap: 5 }

  const handleSave = async () => {
    const amount = parseFloat(form.amount.replace(/,/g, ''))
    if (isNaN(amount)) { setError('Invalid amount'); return }
    setSaving(true)
    const { error: err } = await supabase.from('distributions').update({ recipient: form.recipient, date: form.date, amount, notes: form.notes }).eq('id', distribution.id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setModal(false); router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this distribution?')) return
    await supabase.from('distributions').delete().eq('id', distribution.id)
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
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>Edit Distribution</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>Recipient
                <input list="edit-recipients-list" type="text" value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} style={inputStyle} />
                <datalist id="edit-recipients-list">{existingRecipients.map(r => <option key={r} value={r} />)}</datalist>
              </label>
              <label style={labelStyle}>Date<input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></label>
              <label style={labelStyle}>Amount ($)<input type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} /></label>
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
