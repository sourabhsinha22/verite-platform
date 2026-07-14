'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Engagement, EngagementStage, ENGAGEMENT_STAGE_LABELS,
  ENGAGEMENT_TYPE_LABELS, EngagementType,
} from '@/lib/types'
import Badge from '@/components/ui/Badge'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtRelative(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function fmtStarted(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = Math.floor((Date.now() - d.getTime()) / (30 * 86400000))
  if (months < 1) return 'This month'
  if (months < 12) return `${months}mo ago`
  const yrs = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${yrs}y ${rem}mo ago` : `${yrs}y ago`
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K'
  return '$' + Math.round(v).toLocaleString()
}

interface EngRow extends Omit<Engagement, 'company'> {
  company?: { id: string; name: string }
}

interface HealthFactors {
  blockedTasks: number
  overdueTasks: number
  overdueInvoiceAging: number
  sowExpiryDays: number | null
  daysSinceActivity: number | null
}

interface Props {
  engagements: EngRow[]
  progressMap: Record<string, number>
  taskCountMap: Record<string, number>
  lastActivityMap: Record<string, string>
  healthMap?: Record<string, string>
  healthFactorsMap?: Record<string, HealthFactors>
  teamMembers?: { id: string; name: string }[]
}

const STAGES: (EngagementStage | 'all')[] = [
  'all', 'prospect', 'engaged', 'qualified', 'proposal_sent',
  'lead', 'opportunity', 'active', 'paused', 'closed',
]
const STAGE_CHIP_LABEL: Record<string, string> = { all: 'All', ...ENGAGEMENT_STAGE_LABELS }

const ENG_TYPES: (EngagementType | 'all')[] = ['all', 'opportunity', 'project-based', 'sales-growth', 'care-model']
const ENG_TYPE_LABELS: Record<string, string> = { all: 'All Types', ...ENGAGEMENT_TYPE_LABELS }

type SortKey = 'created_at' | 'health' | 'contract_value' | 'last_activity' | 'name'
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'health',         label: 'Health (worst first)' },
  { value: 'last_activity',  label: 'Last Activity (oldest first)' },
  { value: 'contract_value', label: 'Contract Value (highest first)' },
  { value: 'name',           label: 'Name (A–Z)' },
  { value: 'created_at',     label: 'Date Created (newest first)' },
]

function getHealthReasons(factors: HealthFactors | undefined, health: string): string[] {
  if (!factors) return health === 'green' ? ['All clear'] : [`Marked as ${health}`]
  const r: string[] = []
  if (factors.blockedTasks > 0) r.push(`${factors.blockedTasks} blocked task${factors.blockedTasks !== 1 ? 's' : ''}`)
  if (factors.overdueTasks > 0) r.push(`${factors.overdueTasks} overdue task${factors.overdueTasks !== 1 ? 's' : ''}`)
  if (factors.overdueInvoiceAging > 0) r.push(`Invoice ${factors.overdueInvoiceAging} day${factors.overdueInvoiceAging !== 1 ? 's' : ''} overdue`)
  if (factors.sowExpiryDays !== null && factors.sowExpiryDays <= 30 && factors.sowExpiryDays >= 0) r.push(`SOW expires in ${factors.sowExpiryDays} day${factors.sowExpiryDays !== 1 ? 's' : ''}`)
  if (factors.daysSinceActivity !== null && factors.daysSinceActivity >= 21) r.push(`No activity in ${factors.daysSinceActivity}+ days`)
  return r.length > 0 ? r : ['All clear']
}

const HEALTH_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2 }

function computeCompleteness(eng: EngRow): { score: number; missing: string[] } {
  const checks = [
    { ok: !!eng.lead,                                                                        label: 'No lead assigned' },
    { ok: eng.contract_value != null && eng.contract_value > 0,                             label: 'No contract value' },
    { ok: !!eng.company,                                                                     label: 'No company linked' },
    { ok: !!eng.start_date,                                                                  label: 'No start date' },
    { ok: !!eng.next_action,                                                                 label: 'No next action set' },
    { ok: !!eng.expected_close_date || ['active','closed','paused'].includes(eng.stage),     label: 'No close date' },
  ]
  const missing = checks.filter(c => !c.ok).map(c => c.label)
  return { score: Math.round(((checks.length - missing.length) / checks.length) * 100), missing }
}

// ── Quick-log modal ───────────────────────────────────────────────────────────

function QuickLogModal({ eng, onClose, onSaved }: { eng: EngRow; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [type, setType] = useState<'note' | 'call' | 'meeting' | 'email' | 'status'>('note')
  const [content, setContent] = useState('')
  const [newStage, setNewStage] = useState<EngagementStage | ''>('' )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: member } = await supabase.from('team_members').select('name').eq('auth_user_id', user?.id ?? '').single()
    const author = member?.name ?? user?.email ?? 'Team'

    await supabase.from('activity_log').insert({
      engagement_id: eng.id,
      author,
      entry_type: type,
      content: content.trim(),
      metadata: {},
    })

    if (newStage && newStage !== eng.stage) {
      await supabase.from('engagements').update({ stage: newStage }).eq('id', eng.id)
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'var(--sans)',
    fontSize: 13, color: 'var(--ink)', background: '#fff',
    border: '1px solid var(--line)', borderRadius: 5, padding: '8px 10px',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(37,49,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 460, maxWidth: '94vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Quick Log</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-faint)' }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 18px' }}>{eng.name} · {eng.company?.name ?? ''}</p>

        {/* Type chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['note','call','meeting','email','status'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: type === t ? 'var(--navy)' : 'var(--line-soft)', color: type === t ? '#fff' : 'var(--ink-soft)' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          autoFocus
          placeholder="What happened or what's the update?"
          style={{ ...inp, height: 90, resize: 'vertical', marginBottom: 14 }}
        />

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
            Change Stage (optional)
          </label>
          <select value={newStage} onChange={e => setNewStage(e.target.value as EngagementStage | '')} style={{ ...inp, width: 'auto' }}>
            <option value="">— Keep current: {ENGAGEMENT_STAGE_LABELS[eng.stage]} —</option>
            {Object.entries(ENGAGEMENT_STAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !content.trim()} style={{ background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving || !content.trim() ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Log Activity'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New Engagement Modal ───────────────────────────────────────────────────────

function NewEngagementModal({ onClose, onCreated, teamMembers }: { onClose: () => void; onCreated: () => void; teamMembers: { id: string; name: string }[] }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name: '',
    engagement_type: 'project-based' as EngagementType,
    stage: 'prospect' as EngagementStage,
    lead: '',
    company_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    engagement_category: 'verite_client' as 'verite_client' | 'nouvelleed' | 'other',
    contract_value: '',
    expected_close_date: '',
    probability: '20',
    revenue_type: 'project' as string,
    notes: '',
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
    setError(''); setSaving(true)
    const { error: err } = await supabase.from('engagements').insert({
      name: form.name.trim(),
      engagement_type: form.engagement_type,
      stage: form.stage,
      lead: form.lead || null,
      company_id: form.company_id,
      start_date: form.start_date || null,
      engagement_category: form.engagement_category,
      contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
      expected_close_date: form.expected_close_date || null,
      probability: form.probability ? parseInt(form.probability) : null,
      revenue_type: form.revenue_type || null,
      notes: form.notes || '',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onCreated()
  }

  const inp: React.CSSProperties = {
    fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
    background: 'var(--bg)', border: '1px solid var(--line)',
    borderRadius: 4, padding: '8px 10px', width: '100%', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase',
    letterSpacing: '0.14em', marginBottom: 5, display: 'block',
  }
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
  const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line)', padding: '28px 32px', width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--navy)', margin: '0 0 20px' }}>New Engagement</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Engagement Name *</label>
            <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="e.g. Summit Health — Care Model Rollout" />
          </div>
          <div>
            <label style={lbl}>Company *</label>
            <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} style={inp}>
              <option value="">— select company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Type</label>
              <select value={form.engagement_type} onChange={e => setForm(f => ({ ...f, engagement_type: e.target.value as EngagementType }))} style={inp}>
                {Object.entries(ENGAGEMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Category</label>
              <select value={form.engagement_category} onChange={e => setForm(f => ({ ...f, engagement_category: e.target.value as typeof form.engagement_category }))} style={inp}>
                <option value="verite_client">Vérité Client</option>
                <option value="nouvelleed">NouvelleED</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Stage</label>
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as EngagementStage }))} style={inp}>
                {Object.entries(ENGAGEMENT_STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Lead</label>
              <select value={form.lead} onChange={e => setForm(f => ({ ...f, lead: e.target.value }))} style={inp}>
                <option value="">— unassigned —</option>
                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div style={grid3}>
            <div>
              <label style={lbl}>Contract Value</label>
              <input type="number" value={form.contract_value} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))} style={inp} placeholder="0" />
            </div>
            <div>
              <label style={lbl}>Revenue Type</label>
              <select value={form.revenue_type} onChange={e => setForm(f => ({ ...f, revenue_type: e.target.value }))} style={inp}>
                <option value="project">Project</option>
                <option value="retainer">Retainer</option>
                <option value="hourly">Hourly</option>
                <option value="revenue-share">Revenue Share</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Probability %</label>
              <input type="number" min={0} max={100} value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} style={inp} />
            </div>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>Expected Close</label>
              <input type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inp, height: 64, resize: 'vertical' }} placeholder="Initial context or background…" />
          </div>
        </div>

        {error && <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)', padding: '9px 18px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ background: 'var(--wine)', color: '#fff', padding: '9px 18px', borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Engagement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, hasTasks }: { value: number; hasTasks: boolean }) {
  if (!hasTasks) return <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>No tasks</span>
  const pct = Math.min(100, Math.max(0, value))
  const color = pct === 100 ? 'var(--success)' : pct > 50 ? 'var(--wine)' : 'var(--mauve)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--ink-faint)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EngagementsClient({
  engagements, progressMap, taskCountMap, lastActivityMap,
  healthMap = {}, healthFactorsMap = {}, teamMembers = [],
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // URL-persisted filters
  const urlStage = (searchParams.get('stage') ?? 'all') as EngagementStage | 'all'
  const urlType  = (searchParams.get('type')  ?? 'all') as EngagementType | 'all'
  const urlSort  = (searchParams.get('sort')  ?? 'created_at') as SortKey

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [showModal, setShowModal] = useState(false)
  const [logTarget, setLogTarget] = useState<EngRow | null>(null)
  const [hoveredHealth, setHoveredHealth] = useState<{ engId: string; reasons: string[]; x: number; y: number } | null>(null)
  const [hoveredComplete, setHoveredComplete] = useState<{ engId: string; missing: string[]; x: number; y: number } | null>(null)

  function pushParams(updates: Record<string, string>) {
    const p = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (!v || v === 'all' || v === 'created_at' || (k === 'q' && !v)) p.delete(k)
      else p.set(k, v)
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of engagements) counts[e.stage] = (counts[e.stage] ?? 0) + 1
    return counts
  }, [engagements])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = engagements.filter(e => {
      if (urlStage !== 'all' && e.stage !== urlStage) return false
      if (urlType  !== 'all' && e.engagement_type !== urlType) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName    = e.name.toLowerCase().includes(q)
        const matchCompany = e.company?.name.toLowerCase().includes(q) ?? false
        const matchLead    = (e.lead ?? '').toLowerCase().includes(q)
        if (!matchName && !matchCompany && !matchLead) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      switch (urlSort) {
        case 'health': return (HEALTH_ORDER[healthMap[a.id] ?? 'green'] ?? 2) - (HEALTH_ORDER[healthMap[b.id] ?? 'green'] ?? 2)
        case 'contract_value': return (b.contract_value ?? 0) - (a.contract_value ?? 0)
        case 'last_activity': {
          const aAct = lastActivityMap[a.id] ?? a.created_at
          const bAct = lastActivityMap[b.id] ?? b.created_at
          return new Date(aAct).getTime() - new Date(bAct).getTime()
        }
        case 'name': return a.name.localeCompare(b.name)
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return list
  }, [engagements, urlStage, urlType, search, urlSort, healthMap, lastActivityMap])

  const chipBase = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
    background: active ? 'var(--navy)' : 'var(--line-soft)',
    color: active ? '#fff' : 'var(--ink-soft)',
    transition: 'all 0.12s',
  })

  return (
    <div>
      <style>{`
        .eng-row:hover { background: var(--line-soft) !important; }
        .eng-row:hover .eng-actions { opacity: 1 !important; }
        .eng-actions { opacity: 0; transition: opacity 0.15s; }
      `}</style>

      {/* Top toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink-faint)', pointerEvents: 'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); pushParams({ q: e.target.value }) }}
            placeholder="Search name, company, lead…"
            style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px 7px 28px', width: '100%', boxSizing: 'border-box', background: 'var(--surface)', outline: 'none' }}
          />
        </div>

        {/* Type filter */}
        <select
          value={urlType}
          onChange={e => pushParams({ type: e.target.value })}
          style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', background: 'var(--surface)', cursor: 'pointer' }}
        >
          {ENG_TYPES.map(t => <option key={t} value={t}>{ENG_TYPE_LABELS[t]}</option>)}
        </select>

        {/* Sort */}
        <select
          value={urlSort}
          onChange={e => pushParams({ sort: e.target.value })}
          style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', background: 'var(--surface)', cursor: 'pointer' }}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div style={{ flex: 1 }} />
        <a href="/api/export?type=engagements" download style={{ fontSize: 12, color: 'var(--ink-soft)', border: '1px solid var(--line)', borderRadius: 4, padding: '7px 11px', textDecoration: 'none', fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}>↓ CSV</a>
        <button onClick={() => setShowModal(true)} style={{ background: 'var(--wine)', color: '#fff', padding: '8px 16px', borderRadius: 5, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + New Engagement
        </button>
      </div>

      {/* Stage chips with counts */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>Stage</span>
        {STAGES.map(s => {
          const count = s === 'all' ? engagements.length : (stageCounts[s] ?? 0)
          if (s !== 'all' && count === 0) return null
          return (
            <button key={s} onClick={() => pushParams({ stage: s })} style={chipBase(urlStage === s)}>
              {STAGE_CHIP_LABEL[s]}{s !== 'all' && <span style={{ marginLeft: 5, opacity: 0.7 }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 12 }}>
        {filtered.length} engagement{filtered.length !== 1 ? 's' : ''}
        {(search || urlStage !== 'all' || urlType !== 'all') && (
          <button onClick={() => { setSearch(''); router.replace(pathname, { scroll: false }) }} style={{ marginLeft: 10, fontSize: 11, color: 'var(--wine)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
          No engagements match your filters.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['', 'Engagement', 'Type', 'Stage', 'Lead', 'Value', 'Last Activity', 'Progress', '●', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((eng, i) => {
                const health = healthMap[eng.id] ?? 'green'
                const lastAct = lastActivityMap[eng.id]
                const hasTasksForEng = (taskCountMap[eng.id] ?? 0) > 0
                return (
                  <tr key={eng.id} className="eng-row" style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined, cursor: 'pointer' }}>
                    {/* Health dot */}
                    <td style={{ padding: '13px 8px 13px 16px', width: 24 }}>
                      <div
                        style={{ position: 'relative', display: 'inline-block' }}
                        onMouseEnter={e => setHoveredHealth({ engId: eng.id, reasons: getHealthReasons(healthFactorsMap[eng.id], health), x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHoveredHealth(null)}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', cursor: 'help', background: health === 'red' ? 'var(--danger)' : health === 'yellow' ? 'var(--warn)' : 'var(--success)' }} />
                      </div>
                    </td>
                    {/* Name + company */}
                    <td style={{ padding: '13px 14px', fontSize: 13, maxWidth: 240 }}>
                      <Link href={`/engagements/${eng.id}`} style={{ fontWeight: 500, color: 'var(--navy)', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {eng.name}
                      </Link>
                      {eng.company && (
                        <Link href={`/directory/${eng.company.id}`} style={{ fontSize: 11, color: 'var(--ink-faint)', textDecoration: 'none', marginTop: 2, display: 'block' }}>
                          {eng.company.name}
                        </Link>
                      )}
                      {eng.start_date && (
                        <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 1, display: 'block' }}>
                          Started {fmtStarted(eng.start_date)}
                        </span>
                      )}
                    </td>
                    {/* Type */}
                    <td style={{ padding: '13px 14px' }}><Badge type={eng.engagement_type} /></td>
                    {/* Stage */}
                    <td style={{ padding: '13px 14px' }}><Badge stage={eng.stage} /></td>
                    {/* Lead */}
                    <td style={{ padding: '13px 14px', fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{eng.lead || '—'}</td>
                    {/* Contract value */}
                    <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: eng.contract_value ? 600 : 400, color: eng.contract_value ? 'var(--ink)' : 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                      {fmtMoney(eng.contract_value)}
                    </td>
                    {/* Last activity */}
                    <td style={{ padding: '13px 14px', fontSize: 12, whiteSpace: 'nowrap', color: lastAct ? ((() => { const d = Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000); return d > 20 ? 'var(--danger)' : d > 13 ? 'var(--warn)' : 'var(--ink-soft)' })()) : 'var(--ink-faint)' }}>
                      {lastAct ? fmtRelative(lastAct) : 'No activity'}
                    </td>
                    {/* Progress */}
                    <td style={{ padding: '13px 14px', minWidth: 100 }}>
                      <ProgressBar value={progressMap[eng.id] ?? 0} hasTasks={hasTasksForEng} />
                    </td>
                    {/* Completeness dot */}
                    <td style={{ padding: '13px 8px', width: 24 }}>
                      {(() => {
                        const { score, missing } = computeCompleteness(eng)
                        if (score === 100) return null
                        return (
                          <span
                            title={missing.join(', ')}
                            onMouseEnter={e => setHoveredComplete({ engId: eng.id, missing, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setHoveredComplete(null)}
                            style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', cursor: 'help', background: score >= 50 ? 'var(--warn)' : 'var(--danger)' }}
                          />
                        )
                      })()}
                    </td>
                    {/* Hover actions */}
                    <td style={{ padding: '13px 10px', whiteSpace: 'nowrap' }}>
                      <button
                        className="eng-actions"
                        onClick={e => { e.stopPropagation(); setLogTarget(eng) }}
                        style={{ fontSize: 11, background: 'var(--line-soft)', border: 'none', borderRadius: 4, padding: '3px 9px', cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}
                      >
                        + Log
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <NewEngagementModal
          teamMembers={teamMembers}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); router.refresh() }}
        />
      )}
      {logTarget && (
        <QuickLogModal
          eng={logTarget}
          onClose={() => setLogTarget(null)}
          onSaved={() => { setLogTarget(null); router.refresh() }}
        />
      )}

      {/* Health popover */}
      {hoveredHealth && (
        <div style={{ position: 'fixed', left: hoveredHealth.x + 12, top: hoveredHealth.y - 8, zIndex: 9999, background: 'var(--navy)', color: '#fff', borderRadius: 6, padding: '8px 12px', fontSize: 12, lineHeight: 1.6, maxWidth: 220, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
          {hoveredHealth.reasons.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.6, fontSize: 10 }}>•</span>{r}
            </div>
          ))}
        </div>
      )}
      {/* Completeness popover */}
      {hoveredComplete && (
        <div style={{ position: 'fixed', left: hoveredComplete.x + 12, top: hoveredComplete.y - 8, zIndex: 9999, background: 'var(--wine)', color: '#fff', borderRadius: 6, padding: '8px 12px', fontSize: 12, lineHeight: 1.6, maxWidth: 240, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Incomplete</div>
          {hoveredComplete.missing.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.6, fontSize: 10 }}>•</span>{m}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
