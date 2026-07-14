'use client'

import { useState } from 'react'

const ORG_TYPES = ['Health System', 'Hospital', 'Medical Group', 'Ambulatory Care', 'Skilled Nursing / Post-Acute', 'Home Health', 'Behavioral Health', 'Other']
const INTERESTS = ['NouvelleED AI Education Platform', 'Revenue Cycle Consulting', 'Care Model Redesign', 'Sales & Growth Strategy', 'Other']
const SOURCES = ['Conference', 'Referral', 'LinkedIn', 'Website', 'Other']

export default function LeadForm() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', org_name: '', email: '', phone: '',
    role: '', org_type: '', interest: '', source: '', message: '',
  })
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.org_name || !form.email || !form.first_name) {
      setError('Please fill in your name, organization, and email.')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/leads/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.ok) setSubmitted(true)
      else setError(data.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Network error. Please try again.')
    }
    setSaving(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'Georgia, serif',
    fontSize: 14, color: '#25314a', background: '#fff',
    border: '1px solid #ddd5cc', borderRadius: 5, padding: '11px 14px', outline: 'none',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#9a9aa5', marginBottom: 5,
  }
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 40px', background: '#fff', borderRadius: 12, border: '1px solid #ead9cd' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 26 }}>✓</div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 600, color: '#25314a', margin: '0 0 12px' }}>Thank you, {form.first_name}!</h2>
        <p style={{ fontSize: 15, color: '#5f5f6e', lineHeight: 1.7, margin: 0 }}>
          We've received your inquiry and will be in touch within 1 business day.<br />
          Questions? Email <a href="mailto:tana@veritehealth.com" style={{ color: '#5f3e3f' }}>tana@veritehealth.com</a>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && (
        <div style={{ background: '#fbeaea', border: '1px solid #f5c6c6', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#a13030' }}>{error}</div>
      )}

      <div style={grid2}>
        <div><label style={lbl}>First Name *</label><input style={inp} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Jane" /></div>
        <div><label style={lbl}>Last Name</label><input style={inp} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" /></div>
      </div>

      <div><label style={lbl}>Organization Name *</label><input style={inp} value={form.org_name} onChange={e => set('org_name', e.target.value)} placeholder="Summit Health System" /></div>

      <div style={grid2}>
        <div><label style={lbl}>Work Email *</label><input type="email" style={inp} value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@summitHealth.org" /></div>
        <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" /></div>
      </div>

      <div style={grid2}>
        <div>
          <label style={lbl}>Role / Title</label>
          <input style={inp} value={form.role} onChange={e => set('role', e.target.value)} placeholder="Chief Nursing Officer" />
        </div>
        <div>
          <label style={lbl}>Organization Type</label>
          <select style={inp} value={form.org_type} onChange={e => set('org_type', e.target.value)}>
            <option value="">— Select —</option>
            {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={lbl}>Primary Interest</label>
        <select style={inp} value={form.interest} onChange={e => set('interest', e.target.value)}>
          <option value="">— What brings you here? —</option>
          {INTERESTS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      <div>
        <label style={lbl}>Tell us about your goals</label>
        <textarea value={form.message} onChange={e => set('message', e.target.value)}
          style={{ ...inp, height: 110, resize: 'vertical', lineHeight: 1.6 }}
          placeholder="What challenges are you trying to solve? What outcomes matter most to your organization?" />
      </div>

      <div>
        <label style={lbl}>How did you hear about us?</label>
        <select style={inp} value={form.source} onChange={e => set('source', e.target.value)}>
          <option value="">— Select —</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <button type="submit" disabled={saving} style={{
        background: saving ? '#9a7a7b' : '#5f3e3f', color: '#fff',
        border: 'none', borderRadius: 5, padding: '14px 32px',
        fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
        letterSpacing: '0.02em', marginTop: 4,
      }}>
        {saving ? 'Submitting…' : 'Submit Inquiry →'}
      </button>

      <p style={{ fontSize: 11, color: '#9a9aa5', textAlign: 'center', margin: 0 }}>
        We respond within 1 business day · Your information is kept confidential
      </p>
    </form>
  )
}
