'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Engagement, EngagementStage, ENGAGEMENT_STAGE_LABELS, ENGAGEMENT_TYPE_LABELS, EngagementType } from '@/lib/types'
import Badge from '@/components/ui/Badge'

interface EngRow extends Omit<Engagement, 'company'> {
  company?: { id: string; name: string }
}

interface Props {
  engagements: EngRow[]
  progressMap: Record<string, number>
  healthMap?: Record<string, string>
}

const STAGES: (EngagementStage | 'all')[] = [
  'all', 'prospect', 'engaged', 'qualified', 'proposal_sent',
  'lead', 'opportunity', 'active', 'paused', 'closed',
]
const STAGE_CHIP_LABEL: Record<string, string> = { all: 'All', ...ENGAGEMENT_STAGE_LABELS }

export default function EngagementsClient({ engagements, progressMap, healthMap = {} }: Props) {
  const [stage, setStage] = useState<EngagementStage | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  const filtered = stage === 'all' ? engagements : engagements.filter(e => e.stage === stage)

  return (
    <div>
      {/* Filter chips + button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGES.map(s => (
            <button
              key={s}
              onClick={() => setStage(s)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: 'none',
                background: stage === s ? 'var(--navy)' : 'var(--line-soft)',
                color: stage === s ? '#fff' : 'var(--ink-soft)',
                transition: 'all 0.15s',
              }}
            >
              {STAGE_CHIP_LABEL[s]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'var(--wine)', color: '#fff', padding: '9px 16px', borderRadius: 4,
            fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          + New Engagement
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
          padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)',
        }}>
          {stage !== 'all' ? `No ${STAGE_CHIP_LABEL[stage].toLowerCase()} engagements.` : 'No engagements yet. Click + New Engagement to create one.'}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Health', 'Engagement', 'Type', 'Stage', 'Lead', 'Started', 'Progress'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px', fontSize: 10,
                    color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((eng, i) => (
                <tr
                  key={eng.id}
                  style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--line-soft)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '14px 16px', width: 32 }}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                      background: healthMap[eng.id] === 'red' ? 'var(--danger)' : healthMap[eng.id] === 'yellow' ? 'var(--warn)' : 'var(--success)',
                    }} />
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13 }}>
                    <Link href={`/engagements/${eng.id}`} style={{ fontWeight: 500, color: 'var(--navy)', textDecoration: 'none', display: 'block' }}>
                      {eng.name}
                    </Link>
                    {eng.company && (
                      <Link href={`/directory/${eng.company.id}`} style={{ fontSize: 11, color: 'var(--ink-faint)', textDecoration: 'none', marginTop: 2, display: 'block' }}>
                        {eng.company.name}
                      </Link>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}><Badge type={eng.engagement_type} /></td>
                  <td style={{ padding: '14px 16px' }}><Badge stage={eng.stage} /></td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{eng.lead || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                    {eng.start_date
                      ? (() => {
                          const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                          const d = new Date(eng.start_date + 'T00:00:00')
                          return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
                        })()
                      : '—'}
                  </td>
                  <td style={{ padding: '14px 16px', minWidth: 120 }}>
                    <ProgressBar value={progressMap[eng.id] ?? 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <NewEngagementModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct === 100 ? 'var(--success)' : pct > 50 ? 'var(--wine)' : 'var(--mauve)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--ink-faint)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

function NewEngagementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name: '',
    engagement_type: 'project-based' as EngagementType,
    stage: 'active' as EngagementStage,
    lead: '',
    company_id: '',
    start_date: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    supabase.from('companies').select('id, name').order('name').then(({ data }) => setCompanies(data ?? []))
  }, [])

  const save = async () => {
    if (!form.name.trim()) { setError('Engagement name is required.'); return }
    if (!form.company_id) { setError('Please select a company.'); return }
    setError('')
    setSaving(true)
    const { error: err } = await supabase.from('engagements').insert({
      ...form,
      name: form.name.trim(),
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
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line)', padding: '32px', width: 500, maxWidth: '100%' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--navy)', margin: '0 0 6px' }}>
          New Engagement
        </h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: '0 0 24px' }}>
          Create a new client engagement.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Engagement Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. PHA — Care Model Rollout" />
          </div>
          <div>
            <label style={labelStyle}>Company *</label>
            <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} style={inputStyle}>
              <option value="">— select company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.engagement_type} onChange={e => setForm(f => ({ ...f, engagement_type: e.target.value as EngagementType }))} style={inputStyle}>
                {Object.entries(ENGAGEMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Stage</label>
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as EngagementStage }))} style={inputStyle}>
                {Object.entries(ENGAGEMENT_STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Lead</label>
              <input value={form.lead} onChange={e => setForm(f => ({ ...f, lead: e.target.value }))} style={inputStyle} placeholder="Team member name" />
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)', padding: '9px 18px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', padding: '9px 18px', borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Engagement'}
          </button>
        </div>
      </div>
    </div>
  )
}
