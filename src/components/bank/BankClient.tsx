'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  hasBalance: boolean
  balanceId?: string
}

export default function BankClient({ hasBalance, balanceId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ balance: '', as_of_date: new Date().toISOString().slice(0, 10), notes: '' })
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.balance || !form.as_of_date) { setError('Balance and date are required'); return }
    setSaving(true)
    setError('')
    const amount = parseFloat(form.balance.replace(/,/g, ''))
    if (isNaN(amount)) { setError('Invalid amount'); setSaving(false); return }

    if (hasBalance && balanceId) {
      const { error: err } = await supabase
        .from('bank_balance')
        .update({ balance: amount, as_of_date: form.as_of_date, notes: form.notes })
        .eq('id', balanceId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase
        .from('bank_balance')
        .insert({ balance: amount, as_of_date: form.as_of_date, notes: form.notes })
      if (err) { setError(err.message); setSaving(false); return }
    }
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: 'var(--navy)', color: '#fff', border: 'none',
        }}
      >
        {hasBalance ? 'Update Balance' : 'Set Starting Balance'}
      </button>

      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>
              {hasBalance ? 'Update Bank Balance' : 'Set Starting Balance'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                As of Date
                <input
                  type="date"
                  value={form.as_of_date}
                  onChange={e => setForm(f => ({ ...f, as_of_date: e.target.value }))}
                  style={{ padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                Balance ($)
                <input
                  type="text"
                  value={form.balance}
                  onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                  placeholder="e.g. 42500"
                  style={{ padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                Notes
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"
                  style={{ padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }}
                />
              </label>
            </div>

            {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setOpen(false)} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--line-soft)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--navy)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
