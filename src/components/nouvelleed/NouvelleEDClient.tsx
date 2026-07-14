'use client'

import { useState } from 'react'
import { GraduationCap, Plus, TrendingUp, Users, Award, BookOpen, X } from 'lucide-react'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return `${MO[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`
}
function fmtMoney(v: number | null) {
  if (!v) return '—'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K'
  return '$' + Math.round(v).toLocaleString()
}

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  active:        { bg: '#e8f5e9', color: '#2e7d52' },
  proposal_sent: { bg: '#fff8e1', color: '#b45309' },
  qualified:     { bg: '#e8eaf6', color: '#3949ab' },
  engaged:       { bg: '#fce4ec', color: '#c2185b' },
  paused:        { bg: '#f5f5f5', color: '#757575' },
  closed:        { bg: '#f3e5f5', color: '#7b1fa2' },
}

interface Engagement {
  id: string
  name: string
  stage: string
  lead: string | null
  contract_value: number | null
  company: { id: string; name: string } | { id: string; name: string }[] | null
}

interface Enrollment {
  id: string
  engagement_id: string
  report_date: string
  total_enrolled: number
  active_learners: number
  completions_this_month: number
  total_completions: number
  ce_certs_issued: number
  modules_live: number
  avg_completion_pct: number
  notes: string
  created_at: string
}

interface Props {
  engagements: Engagement[]
  enrollments: Enrollment[]
}

const EMPTY_FORM = {
  engagement_id: '',
  report_date: new Date().toISOString().slice(0, 10),
  total_enrolled: '',
  active_learners: '',
  completions_this_month: '',
  total_completions: '',
  ce_certs_issued: '',
  modules_live: '',
  avg_completion_pct: '',
  notes: '',
}

export default function NouvelleEDClient({ engagements, enrollments }: Props) {
  const [selectedEngId, setSelectedEngId] = useState<string | null>(
    engagements.length > 0 ? engagements[0].id : null
  )
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [localEnrollments, setLocalEnrollments] = useState<Enrollment[]>(enrollments)

  const selectedEng = engagements.find(e => e.id === selectedEngId)
  const engEnrollments = localEnrollments
    .filter(e => e.engagement_id === selectedEngId)
    .sort((a, b) => b.report_date.localeCompare(a.report_date))

  const latest = engEnrollments[0] ?? null

  const companyName = (eng: Engagement) => {
    if (!eng.company) return ''
    if (Array.isArray(eng.company)) return eng.company[0]?.name ?? ''
    return eng.company.name
  }

  const openModal = () => {
    setForm({ ...EMPTY_FORM, engagement_id: selectedEngId ?? '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.engagement_id || !form.report_date) return
    setSaving(true)
    try {
      const res = await fetch('/api/nouvelleed/enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagement_id: form.engagement_id,
          report_date: form.report_date,
          total_enrolled: Number(form.total_enrolled) || 0,
          active_learners: Number(form.active_learners) || 0,
          completions_this_month: Number(form.completions_this_month) || 0,
          total_completions: Number(form.total_completions) || 0,
          ce_certs_issued: Number(form.ce_certs_issued) || 0,
          modules_live: Number(form.modules_live) || 0,
          avg_completion_pct: Number(form.avg_completion_pct) || 0,
          notes: form.notes,
        }),
      })
      const data = await res.json()
      if (data.enrollment) {
        setLocalEnrollments(prev => [data.enrollment, ...prev])
        setShowModal(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const statCard = (label: string, value: string | number, sub?: string) => (
    <div style={{ background: '#fff', border: '1px solid #ead9cd', borderRadius: 8, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5f3e3f', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#25314a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9a9aa5', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        .ned-row:hover { background: #faf6f2 !important; }
        .eng-tab { cursor: pointer; transition: all 0.15s; }
        .eng-tab:hover { background: rgba(227,188,166,0.12) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <GraduationCap size={22} style={{ color: '#5f3e3f' }} />
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              NouvelleED Tracker
            </h1>
          </div>
          <div style={{ fontSize: 13, color: '#9a9aa5' }}>Enrollment & completion metrics across NouvelleED client engagements</div>
        </div>
        {selectedEngId && (
          <button onClick={openModal} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#5f3e3f', color: '#fff', border: 'none',
            padding: '9px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>
            <Plus size={14} /> Log Snapshot
          </button>
        )}
      </div>

      {engagements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a9aa5' }}>
          <GraduationCap size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 15 }}>No NouvelleED engagements yet.</p>
          <p style={{ fontSize: 13 }}>Set <code>engagement_category = &apos;nouvelleed&apos;</code> on an engagement to track it here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Left: engagement list */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9aa5', marginBottom: 8, paddingLeft: 4 }}>
              Engagements ({engagements.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {engagements.map(eng => {
                const sc = STAGE_COLORS[eng.stage] ?? { bg: '#f5f3ee', color: '#7a6a5a' }
                const isSelected = eng.id === selectedEngId
                return (
                  <div
                    key={eng.id}
                    className="eng-tab"
                    onClick={() => setSelectedEngId(eng.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                      background: isSelected ? 'rgba(95,62,63,0.08)' : 'transparent',
                      border: isSelected ? '1px solid rgba(95,62,63,0.2)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#25314a', marginBottom: 4, lineHeight: 1.3 }}>{eng.name}</div>
                    <div style={{ fontSize: 11, color: '#9a9aa5', marginBottom: 5 }}>{companyName(eng)}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: sc.bg, color: sc.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {eng.stage.replace('_', ' ')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: detail */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedEng ? (
              <>
                {/* Engagement header */}
                <div style={{ background: '#fff', border: '1px solid #ead9cd', borderRadius: 8, padding: '18px 22px', marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#25314a', marginBottom: 2 }}>{selectedEng.name}</div>
                  <div style={{ fontSize: 13, color: '#9a9aa5' }}>
                    {companyName(selectedEng)}{selectedEng.lead ? ` · Lead: ${selectedEng.lead}` : ''}{selectedEng.contract_value ? ` · ${fmtMoney(selectedEng.contract_value)}` : ''}
                  </div>
                </div>

                {/* Latest snapshot stats */}
                {latest ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9aa5', marginBottom: 10 }}>
                      Latest Snapshot — {fmtDate(latest.report_date)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                      {statCard('Total Enrolled', latest.total_enrolled, 'staff on platform')}
                      {statCard('Active Learners', latest.active_learners, 'engaged this period')}
                      {statCard('CE Certs Issued', latest.ce_certs_issued, 'ANCC certificates')}
                      {statCard('Completions (Month)', latest.completions_this_month, 'module completions')}
                      {statCard('Total Completions', latest.total_completions, 'all time')}
                      {statCard('Avg Completion', `${latest.avg_completion_pct}%`, `${latest.modules_live} modules live`)}
                    </div>
                    {latest.notes && (
                      <div style={{ background: '#faf6f2', border: '1px solid #ead9cd', borderRadius: 6, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#5f5f6e', borderLeft: '3px solid #5f3e3f' }}>
                        <strong style={{ color: '#25314a' }}>Notes:</strong> {latest.notes}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ background: '#faf6f2', border: '1px dashed #ead9cd', borderRadius: 8, padding: '32px', textAlign: 'center', marginBottom: 24, color: '#9a9aa5' }}>
                    <TrendingUp size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ fontSize: 14, margin: 0 }}>No snapshots yet. Log your first enrollment update.</p>
                  </div>
                )}

                {/* History table */}
                {engEnrollments.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9aa5', marginBottom: 10 }}>
                      Snapshot History ({engEnrollments.length})
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #ead9cd', borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f5ebe3' }}>
                            {['Date', 'Enrolled', 'Active', 'CE Certs', 'Completions', 'Avg %', 'Modules'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, color: '#5f3e3f', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {engEnrollments.map((e, i) => (
                            <tr key={e.id} className="ned-row" style={{ borderTop: i > 0 ? '1px solid #f0e8e0' : undefined, background: '#fff' }}>
                              <td style={{ padding: '11px 14px', color: '#25314a', fontWeight: 600 }}>{fmtDate(e.report_date)}</td>
                              <td style={{ padding: '11px 14px', color: '#25314a' }}>{e.total_enrolled}</td>
                              <td style={{ padding: '11px 14px', color: '#25314a' }}>{e.active_learners}</td>
                              <td style={{ padding: '11px 14px', color: '#25314a' }}>{e.ce_certs_issued}</td>
                              <td style={{ padding: '11px 14px', color: '#25314a' }}>{e.total_completions}</td>
                              <td style={{ padding: '11px 14px', color: '#25314a' }}>{e.avg_completion_pct}%</td>
                              <td style={{ padding: '11px 14px', color: '#25314a' }}>{e.modules_live}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ color: '#9a9aa5', padding: 40, textAlign: 'center' }}>Select an engagement</div>
            )}
          </div>
        </div>
      )}

      {/* Log Snapshot Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '28px 32px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: '#25314a', margin: 0 }}>Log Enrollment Snapshot</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9aa5' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5f3e3f', display: 'block', marginBottom: 5 }}>Engagement</label>
                <select
                  value={form.engagement_id}
                  onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13, color: '#25314a' }}
                >
                  <option value="">Select…</option>
                  {engagements.map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {companyName(e)}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5f3e3f', display: 'block', marginBottom: 5 }}>Report Date</label>
                <input type="date" value={form.report_date} onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
              </div>

              {([
                ['total_enrolled', 'Total Enrolled'],
                ['active_learners', 'Active Learners'],
                ['completions_this_month', 'Completions (This Month)'],
                ['total_completions', 'Total Completions'],
                ['ce_certs_issued', 'CE Certs Issued'],
                ['modules_live', 'Modules Live'],
              ] as [keyof typeof form, string][]).map(([key, label]) => (
                <div key={key}>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5f3e3f', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input type="number" min="0" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5f3e3f', display: 'block', marginBottom: 5 }}>Avg Completion %</label>
                <input type="number" min="0" max="100" step="0.1" value={form.avg_completion_pct} onChange={e => setForm(f => ({ ...f, avg_completion_pct: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5f3e3f', display: 'block', marginBottom: 5 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--sans)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', borderRadius: 5, border: '1px solid #ddd', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#5f5f6e' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.engagement_id}
                style={{ padding: '9px 20px', borderRadius: 5, border: 'none', background: '#5f3e3f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
