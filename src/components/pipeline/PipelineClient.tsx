'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Engagement,
  EngagementStage,
  EngagementType,
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_STAGE_LABELS,
} from '@/lib/types'
import { X, Plus, GripVertical } from 'lucide-react'

interface EngagementCard extends Omit<Engagement, 'company'> {
  company?: { id: string; name: string }
  _progress: number
}

interface Props {
  engagements: EngagementCard[]
  teamMembers: { id: string; name: string }[]
}

const STAGE_ORDER: EngagementStage[] = ['lead', 'opportunity', 'active', 'paused', 'closed']

const STAGE_PROBABILITY: Record<EngagementStage, number> = {
  lead: 10,
  opportunity: 30,
  active: 80,
  paused: 40,
  closed: 0,
}

const STAGE_ACCENT: Record<EngagementStage, string> = {
  lead: 'var(--blush)',
  opportunity: 'var(--warn)',
  active: 'var(--success)',
  paused: 'var(--ink-faint)',
  closed: 'var(--ink-faint)',
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`
  return `$${Math.round(v).toLocaleString()}`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Quick-Add Modal ──────────────────────────────────────────────────────────

interface QuickAddModalProps {
  stage: EngagementStage
  teamMembers: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}

function QuickAddModal({ stage, teamMembers, onClose, onSaved }: QuickAddModalProps) {
  const supabase = createClient()
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    company_id: '',
    engagement_type: 'opportunity' as EngagementType,
    lead: '',
    contract_value: '',
    expected_close_date: '',
    probability: String(STAGE_PROBABILITY[stage]),
  })

  // Load companies on mount
  useState(() => {
    supabase.from('companies').select('id, name').order('name').then(({ data }) => {
      setCompanies(data ?? [])
      setLoaded(true)
    })
  })

  if (!loaded) {
    supabase.from('companies').select('id, name').order('name').then(({ data }) => {
      setCompanies(data ?? [])
      setLoaded(true)
    })
  }

  function set(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Engagement name is required.'); return }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('engagements').insert({
      name: form.name.trim(),
      company_id: form.company_id || null,
      engagement_type: form.engagement_type,
      lead: form.lead || null,
      stage,
      contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
      expected_close_date: form.expected_close_date || null,
      probability: form.probability ? parseInt(form.probability) : STAGE_PROBABILITY[stage],
      health: 'green',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  const fieldStyle: React.CSSProperties = {
    border: '1px solid var(--line)',
    borderRadius: 5,
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'var(--sans)',
    color: 'var(--ink)',
    background: '#fff',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'var(--ink-soft)',
    marginBottom: 4,
    fontFamily: 'var(--sans)',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(37,49,74,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 10,
        padding: 28,
        width: 460,
        maxWidth: '94vw',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
            Add to {ENGAGEMENT_STAGE_LABELS[stage]}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 5, padding: '8px 12px', marginBottom: 14, fontSize: 13, fontFamily: 'var(--sans)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Engagement Name *</label>
            <input style={fieldStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. BHI Program Design" autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <select style={fieldStyle} value={form.company_id} onChange={e => set('company_id', e.target.value)}>
              <option value="">— Select company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={fieldStyle} value={form.engagement_type} onChange={e => set('engagement_type', e.target.value as EngagementType)}>
                {Object.entries(ENGAGEMENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Lead</label>
              <select style={fieldStyle} value={form.lead} onChange={e => set('lead', e.target.value)}>
                <option value="">— Select —</option>
                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Contract Value</label>
              <input type="number" style={fieldStyle} value={form.contract_value} onChange={e => set('contract_value', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Close Date</label>
              <input type="date" style={fieldStyle} value={form.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Probability %</label>
              <input type="number" min={0} max={100} style={fieldStyle} value={form.probability} onChange={e => set('probability', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 5, padding: '8px 16px', fontSize: 13, fontFamily: 'var(--sans)', cursor: 'pointer', color: 'var(--ink-soft)' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--sans)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : 'Add Engagement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  card: EngagementCard
  dimmed: boolean
  onDragStart: (id: string) => void
}

function KanbanCard({ card, dimmed, onDragStart }: CardProps) {
  const accent = STAGE_ACCENT[card.stage]
  const isClosedStage = card.stage === 'closed' || card.stage === 'paused'

  return (
    <div
      draggable
      onDragStart={() => onDragStart(card.id)}
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: 14,
        marginBottom: 8,
        cursor: 'grab',
        opacity: dimmed ? 0.35 : isClosedStage ? 0.6 : 1,
        transition: 'opacity 0.2s',
        userSelect: 'none',
      }}
    >
      {/* Company */}
      {card.company && (
        <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--sans)', marginBottom: 3, fontWeight: 500 }}>
          {card.company.name}
        </div>
      )}
      {/* Name */}
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--sans)', marginBottom: 7, lineHeight: 1.3 }}>
        {card.name}
      </div>
      {/* Type badge */}
      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: 'inline-block',
          background: 'var(--line-soft)',
          color: 'var(--ink-soft)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '2px 7px',
          borderRadius: 3,
          fontFamily: 'var(--sans)',
        }}>
          {ENGAGEMENT_TYPE_LABELS[card.engagement_type]}
        </span>
      </div>
      {/* Owner + probability */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {card.lead ? (
            <>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--blush)', color: 'var(--wine)',
                fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--sans)', flexShrink: 0,
              }}>
                {getInitials(card.lead)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
                {card.lead}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--sans)' }}>No lead</span>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
          {card.probability ?? 0}%
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--line-soft)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${card._progress}%`, background: accent, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      {/* Value + close date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {card.contract_value != null ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
            {fmtMoney(card.contract_value)}
          </span>
        ) : <span />}
        {card.expected_close_date && (
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--sans)' }}>
            Close: {fmtDate(card.expected_close_date)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PipelineClient({ engagements, teamMembers }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [cards, setCards] = useState<EngagementCard[]>(engagements)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null)
  const [addModal, setAddModal] = useState<EngagementStage | null>(null)

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetStage: EngagementStage) => {
    e.preventDefault()
    const engId = draggingId
    if (!engId) return
    const card = cards.find(c => c.id === engId)
    if (!card || card.stage === targetStage) { setDraggingId(null); return }

    setCards(prev => prev.map(c =>
      c.id === engId ? { ...c, stage: targetStage, probability: STAGE_PROBABILITY[targetStage] } : c
    ))
    setDraggingId(null)

    await supabase.from('engagements').update({
      stage: targetStage,
      probability: STAGE_PROBABILITY[targetStage],
    }).eq('id', engId)

    router.refresh()
  }, [draggingId, cards, supabase, router])

  const getColumnCards = (stage: EngagementStage) => cards.filter(c => c.stage === stage)

  const columnWeighted = (stage: EngagementStage): number =>
    getColumnCards(stage).reduce((s, c) => s + (c.contract_value ?? 0) * ((c.probability ?? 0) / 100), 0)

  // All unique owners from engagements
  const allOwners = Array.from(new Set(cards.map(c => c.lead).filter(Boolean))) as string[]

  return (
    <>
      <style>{`
        .pipeline-col { transition: background 0.15s; }
        .pipeline-col.drag-over { background: var(--line-soft) !important; }
        .add-col-btn:hover { background: rgba(95,62,63,0.08) !important; color: var(--wine) !important; }
        .owner-chip:hover { background: var(--line) !important; }
      `}</style>

      {/* Owner filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>
          Owner:
        </span>
        {['All', ...allOwners].map(owner => (
          <button
            key={owner}
            className="owner-chip"
            onClick={() => setOwnerFilter(owner === 'All' ? null : owner)}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: '1px solid var(--line)',
              background: (ownerFilter === null && owner === 'All') || ownerFilter === owner ? 'var(--navy)' : '#fff',
              color: (ownerFilter === null && owner === 'All') || ownerFilter === owner ? '#fff' : 'var(--ink-soft)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--sans)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {owner}
          </button>
        ))}
      </div>

      {/* Kanban board */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 16 }}>
        {STAGE_ORDER.map(stage => {
          const colCards = getColumnCards(stage)
          const weighted = columnWeighted(stage)

          return (
            <div
              key={stage}
              className="pipeline-col"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, stage)}
              style={{
                minWidth: 220,
                flex: '0 0 220px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '0 0 8px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid var(--line-soft)',
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--ink)',
                  }}>
                    {ENGAGEMENT_STAGE_LABELS[stage]}
                  </span>
                  <span style={{
                    background: 'var(--line-soft)',
                    color: 'var(--ink-soft)',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: '1px 7px',
                    fontFamily: 'var(--sans)',
                  }}>
                    {colCards.length}
                  </span>
                </div>
                {weighted > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--wine)', fontWeight: 600, fontFamily: 'var(--sans)' }}>
                    {fmtMoney(weighted)} weighted
                  </div>
                )}
              </div>

              {/* Cards */}
              <div style={{ padding: '0 10px' }}>
                {colCards.map(card => (
                  <KanbanCard
                    key={card.id}
                    card={card}
                    dimmed={ownerFilter !== null && card.lead !== ownerFilter}
                    onDragStart={handleDragStart}
                  />
                ))}

                {colCards.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px 10px',
                    color: 'var(--ink-faint)',
                    fontSize: 12,
                    fontFamily: 'var(--sans)',
                    fontStyle: 'italic',
                  }}>
                    Drop cards here
                  </div>
                )}

                {/* Add button */}
                <button
                  className="add-col-btn"
                  onClick={() => setAddModal(stage)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 5,
                    border: '1px dashed var(--line)',
                    background: 'transparent',
                    color: 'var(--ink-faint)',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'var(--sans)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    marginTop: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick-add modal */}
      {addModal && (
        <QuickAddModal
          stage={addModal}
          teamMembers={teamMembers}
          onClose={() => setAddModal(null)}
          onSaved={() => { router.refresh() }}
        />
      )}
    </>
  )
}
