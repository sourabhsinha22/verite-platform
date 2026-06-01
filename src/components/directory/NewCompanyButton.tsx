'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CompanyTag, COMPANY_TAG_LABELS } from '@/lib/types'
import { X } from 'lucide-react'

export default function NewCompanyButton() {
  const [showModal, setShowModal] = useState(false)
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{ background: 'var(--wine)', color: '#fff', padding: '9px 16px', borderRadius: 4, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}
      >
        + New Company
      </button>
      {showModal && <NewCompanyModal onClose={() => setShowModal(false)} />}
    </>
  )
}

function NewCompanyModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', tag: 'prospect' as CompanyTag, industry: '', size: '', website: '', address: '', account_owner: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    supabase.from('team_members').select('id, name').order('name').then(({ data }) => setMembers(data ?? []))
  }, [])

  const save = async () => {
    if (!form.name.trim()) { setError('Company name is required.'); return }
    setError('')
    setSaving(true)
    const { data, error: err } = await supabase.from('companies').insert({ ...form, name: form.name.trim() }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onClose()
    router.push(`/directory/${data.id}`)
    router.refresh()
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
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line)', padding: 32, width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>New Company</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Company Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. Acme Health Group" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Tag</label>
              <select value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value as CompanyTag }))} style={inputStyle}>
                {Object.entries(COMPANY_TAG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Account Owner</label>
              <select value={form.account_owner} onChange={e => setForm(f => ({ ...f, account_owner: e.target.value }))} style={inputStyle}>
                <option value="">— unassigned —</option>
                {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Industry</label>
              <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} style={inputStyle} placeholder="e.g. Behavioral Health" />
            </div>
            <div>
              <label style={labelStyle}>Company Size</label>
              <input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} style={inputStyle} placeholder="e.g. 50-200 employees" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Website</label>
            <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} style={inputStyle} placeholder="https://..." />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inputStyle} placeholder="City, State" />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--sans)' }} placeholder="Optional" />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)', padding: '9px 18px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', padding: '9px 18px', borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Company'}
          </button>
        </div>
      </div>
    </div>
  )
}
