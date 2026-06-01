'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Engagement,
  Sow,
  SowDeliverable,
  SowStatus,
  SOW_STATUS_LABELS,
  RevenueType,
} from '@/lib/types'
import Link from 'next/link'
import { Plus, Trash2, FileText, Download, CheckCircle, Save, ArrowRight, FileCheck } from 'lucide-react'

interface Props {
  engagement: Engagement & { company?: { id: string; name: string } }
  sow: Sow | null
  teamMembers: { id: string; name: string }[]
  engagementId: string
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  return `$${Math.round(v).toLocaleString()}`
}

const SOW_STATUS_COLORS: Record<SowStatus, { bg: string; color: string }> = {
  draft: { bg: '#f5f3ee', color: 'var(--ink-soft)' },
  sent: { bg: '#d8dde8', color: 'var(--navy)' },
  signed: { bg: 'var(--warn-soft)', color: 'var(--warn)' },
  active: { bg: 'var(--success-soft)', color: 'var(--success)' },
  expired: { bg: '#ece3dd', color: '#6b5b50' },
  cancelled: { bg: 'var(--danger-soft)', color: 'var(--danger)' },
}

const inputBase: React.CSSProperties = {
  fontFamily: 'var(--sans)',
  fontSize: 14,
  color: 'var(--ink)',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 4,
  padding: '4px 6px',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
}

const inputFocusStyle = `
  .vt-input:hover { border-color: var(--line) !important; }
  .vt-input:focus { border-color: var(--blush) !important; background: #fff !important; }
  .vt-textarea:hover { border-color: var(--line) !important; }
  .vt-textarea:focus { border-color: var(--blush) !important; background: #fff !important; }
`

// ─── Create Form ─────────────────────────────────────────────────────────────

function CreateSowForm({
  engagement,
  teamMembers,
  engagementId,
}: {
  engagement: Props['engagement']
  teamMembers: Props['teamMembers']
  engagementId: string
}) {
  const router = useRouter()
  const clientName = engagement.company?.name ?? 'Client'

  const [form, setForm] = useState({
    title: `Vérité Health Collective — ${clientName} — Statement of Work`,
    effective_date: '',
    expiry_date: '',
    revenue_type: (engagement.revenue_type ?? 'project') as RevenueType,
    total_value: engagement.contract_value?.toString() ?? '',
    payment_terms: 'Net 30',
    billing_frequency: 'monthly',
    objectives: '',
    scope_of_work: '',
    out_of_scope: '',
    assumptions: '',
    client_responsibilities: '',
    verite_lead: engagement.lead ?? '',
    client_signatory: '',
    verite_signatory: 'Tana Whitt',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('sows').insert({
      engagement_id: engagementId,
      title: form.title,
      version: 1,
      status: 'draft',
      effective_date: form.effective_date || null,
      expiry_date: form.expiry_date || null,
      revenue_type: form.revenue_type,
      total_value: form.total_value ? parseFloat(form.total_value) : null,
      payment_terms: form.payment_terms,
      billing_frequency: form.billing_frequency,
      objectives: form.objectives,
      scope_of_work: form.scope_of_work,
      out_of_scope: form.out_of_scope,
      assumptions: form.assumptions,
      client_responsibilities: form.client_responsibilities,
      verite_lead: form.verite_lead,
      client_signatory: form.client_signatory,
      verite_signatory: form.verite_signatory,
      notes: form.notes,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      router.refresh()
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-soft)',
    marginBottom: 4,
    fontFamily: 'var(--sans)',
  }
  const fieldStyle: React.CSSProperties = {
    border: '1px solid var(--line)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'var(--sans)',
    color: 'var(--ink)',
    background: '#fff',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: 32,
        maxWidth: 760,
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 26,
          fontWeight: 600,
          color: 'var(--navy)',
          margin: '0 0 24px',
        }}
      >
        Create Statement of Work
      </h2>

      {error && (
        <div
          style={{
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 14,
            fontFamily: 'var(--sans)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 18 }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>Title</label>
          <input
            style={fieldStyle}
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>

        {/* Date row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Effective Date</label>
            <input
              type="date"
              style={fieldStyle}
              value={form.effective_date}
              onChange={e => set('effective_date', e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Expiry Date</label>
            <input
              type="date"
              style={fieldStyle}
              value={form.expiry_date}
              onChange={e => set('expiry_date', e.target.value)}
            />
          </div>
        </div>

        {/* Revenue row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Revenue Type</label>
            <select
              style={fieldStyle}
              value={form.revenue_type}
              onChange={e => set('revenue_type', e.target.value as RevenueType)}
            >
              <option value="retainer">Retainer</option>
              <option value="revenue-share">Revenue Share</option>
              <option value="project">Project</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Total Value</label>
            <input
              type="number"
              style={fieldStyle}
              value={form.total_value}
              placeholder="0"
              onChange={e => set('total_value', e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Payment Terms</label>
            <select
              style={fieldStyle}
              value={form.payment_terms}
              onChange={e => set('payment_terms', e.target.value)}
            >
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 45">Net 45</option>
              <option value="Due on Receipt">Due on Receipt</option>
            </select>
          </div>
        </div>

        {/* Billing */}
        <div style={{ maxWidth: 260 }}>
          <label style={labelStyle}>Billing Frequency</label>
          <select
            style={fieldStyle}
            value={form.billing_frequency}
            onChange={e => set('billing_frequency', e.target.value)}
          >
            <option value="monthly">Monthly</option>
            <option value="milestone">Milestone</option>
            <option value="on-completion">On Completion</option>
          </select>
        </div>

        {/* Text areas */}
        {(
          [
            ['objectives', 'Objectives'],
            ['scope_of_work', 'Scope of Work'],
            ['out_of_scope', 'Out of Scope'],
            ['assumptions', 'Assumptions'],
            ['client_responsibilities', 'Client Responsibilities'],
          ] as [keyof typeof form, string][]
        ).map(([key, lbl]) => (
          <div key={key}>
            <label style={labelStyle}>{lbl}</label>
            <textarea
              style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' }}
              value={form[key]}
              onChange={e => set(key, e.target.value)}
            />
          </div>
        ))}

        {/* Signatories */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Vérité Lead</label>
            <select
              style={fieldStyle}
              value={form.verite_lead}
              onChange={e => set('verite_lead', e.target.value)}
            >
              <option value="">— Select —</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Client Signatory</label>
            <input
              style={fieldStyle}
              value={form.client_signatory}
              onChange={e => set('client_signatory', e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Vérité Signatory</label>
            <input
              style={fieldStyle}
              value={form.verite_signatory}
              onChange={e => set('verite_signatory', e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...fieldStyle, minHeight: 70, resize: 'vertical' }}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: 'var(--wine)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--sans)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Save size={15} />
            {saving ? 'Creating…' : 'Create SOW'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SOW Viewer / Editor ──────────────────────────────────────────────────────

function SowEditor({
  sow: initialSow,
  teamMembers,
  engagementId,
}: {
  sow: Sow
  teamMembers: Props['teamMembers']
  engagementId: string
}) {
  const router = useRouter()
  const [sow, setSow] = useState<Sow>(initialSow)
  const [deliverables, setDeliverables] = useState<SowDeliverable[]>(
    initialSow.deliverables ?? []
  )
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [genMsg, setGenMsg] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    objectives: true,
    scope_of_work: true,
    out_of_scope: false,
    assumptions: false,
    client_responsibilities: false,
  })

  function toggleSection(k: string) {
    setOpenSections(prev => ({ ...prev, [k]: !prev[k] }))
  }

  function fieldUpdate(k: keyof Sow, v: string | number | null) {
    setSow(prev => ({ ...prev, [k]: v }))
  }

  async function saveSow() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('sows')
      .update({
        title: sow.title,
        effective_date: sow.effective_date,
        expiry_date: sow.expiry_date,
        revenue_type: sow.revenue_type,
        total_value: sow.total_value,
        payment_terms: sow.payment_terms,
        billing_frequency: sow.billing_frequency,
        objectives: sow.objectives,
        scope_of_work: sow.scope_of_work,
        out_of_scope: sow.out_of_scope,
        assumptions: sow.assumptions,
        client_responsibilities: sow.client_responsibilities,
        verite_lead: sow.verite_lead,
        client_signatory: sow.client_signatory,
        verite_signatory: sow.verite_signatory,
        notes: sow.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sow.id)
    setSaving(false)
    if (error) {
      setStatusMsg('Save failed: ' + error.message)
      return
    }
    setStatusMsg('Saved')
    setTimeout(() => setStatusMsg(null), 2500)
    router.refresh()
  }

  async function advanceStatus(next: SowStatus) {
    const supabase = createClient()
    const updates: Partial<Sow> = { status: next }
    if (next === 'signed') updates.signed_date = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('sows').update(updates).eq('id', sow.id)
    if (error) {
      setStatusMsg('Status update failed: ' + error.message)
      return
    }
    setSow(prev => ({ ...prev, ...updates }))
    router.refresh()
  }

  // Deliverable helpers
  async function addDeliverable() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('sow_deliverables')
      .insert({
        sow_id: sow.id,
        title: '',
        description: '',
        due_date: null,
        payment_amount: null,
        payment_month: null,
        is_milestone: false,
        sort_order: deliverables.length,
      })
      .select()
      .single()
    if (!error && data) setDeliverables(prev => [...prev, data])
  }

  async function updateDeliverable(id: string, k: keyof SowDeliverable, v: string | number | boolean | null) {
    const supabase = createClient()
    const { error } = await supabase.from('sow_deliverables').update({ [k]: v }).eq('id', id)
    if (error) {
      setStatusMsg('Update failed: ' + error.message)
      return
    }
    setDeliverables(prev => prev.map(d => (d.id === id ? { ...d, [k]: v } : d)))
  }

  async function deleteDeliverable(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('sow_deliverables').delete().eq('id', id)
    if (error) {
      setStatusMsg('Delete failed: ' + error.message)
      return
    }
    setDeliverables(prev => prev.filter(d => d.id !== id))
  }

  // Auto-generate tasks
  async function generateTasks() {
    const supabase = createClient()
    // check existing
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('engagement_id', engagementId)
      .eq('task_group', 'project')
    if (existing && existing.length > 0) {
      setGenMsg(`⚠ ${existing.length} project task(s) already exist. Remove them first to regenerate.`)
      return
    }
    const toInsert = deliverables
      .filter(d => d.title)
      .map((d, i) => ({
        engagement_id: engagementId,
        title: d.title,
        due_date: d.due_date,
        status: 'not-started' as const,
        priority: 'medium' as const,
        task_group: 'project' as const,
        sort_order: i,
        owner: sow.verite_lead ?? '',
        notes: d.description ?? '',
      }))
    if (toInsert.length === 0) {
      setGenMsg('No deliverables with titles to convert to tasks.')
      return
    }
    const { error } = await supabase.from('tasks').insert(toInsert)
    if (error) {
      setGenMsg(`Error: ${error.message}`)
    } else {
      setGenMsg(`✓ ${toInsert.length} task(s) created successfully.`)
      router.refresh()
    }
  }

  // Auto-generate revenue schedule
  async function generateRevenueSchedule() {
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('revenue_items')
      .select('id')
      .eq('engagement_id', engagementId)
    if (existing && existing.length > 0) {
      setGenMsg(`⚠ ${existing.length} revenue item(s) already exist. Remove them first to regenerate.`)
      return
    }
    const toInsert = deliverables
      .filter(d => d.payment_amount || d.payment_month)
      .map((d, i) => ({
        engagement_id: engagementId,
        label: d.title || `Deliverable ${i + 1}`,
        month: d.payment_month,
        milestone: d.is_milestone ? d.title : null,
        forecast_amount: d.payment_amount ?? 0,
        actual_amount: null,
        notes: d.description ?? '',
        sort_order: i,
      }))
    if (toInsert.length === 0) {
      setGenMsg('No deliverables have payment amounts or months set.')
      return
    }
    const { error } = await supabase.from('revenue_items').insert(toInsert)
    if (error) {
      setGenMsg(`Error: ${error.message}`)
    } else {
      setGenMsg(`✓ ${toInsert.length} revenue item(s) created successfully.`)
      router.refresh()
    }
  }

  const statusStyle = SOW_STATUS_COLORS[sow.status]

  const inlineInput = (
    value: string | number | null,
    onChange: (v: string) => void,
    opts?: { type?: string; style?: React.CSSProperties }
  ) => (
    <input
      className="vt-input"
      type={opts?.type ?? 'text'}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputBase, ...opts?.style }}
    />
  )

  const inlineTextarea = (
    value: string | null,
    onChange: (v: string) => void,
    minHeight = 80
  ) => (
    <textarea
      className="vt-textarea"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inputBase,
        minHeight,
        resize: 'vertical',
        lineHeight: 1.6,
      }}
    />
  )

  const sectionCard = (
    key: string,
    label: string,
    content: React.ReactNode
  ) => (
    <div
      style={{
        border: '1px solid var(--line-soft)',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      <button
        onClick={() => toggleSection(key)}
        style={{
          width: '100%',
          background: openSections[key] ? 'var(--line-soft)' : '#faf9f7',
          border: 'none',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink)',
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'var(--ink-soft)', fontSize: 16 }}>
          {openSections[key] ? '−' : '+'}
        </span>
      </button>
      {openSections[key] && (
        <div style={{ padding: '14px 16px', background: '#fff' }}>{content}</div>
      )}
    </div>
  )

  return (
    <>
      <style>{inputFocusStyle}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {inlineInput(sow.title, v => fieldUpdate('title', v), {
              style: {
                fontFamily: 'var(--serif)',
                fontSize: 28,
                fontWeight: 600,
                color: 'var(--navy)',
                letterSpacing: '-0.3px',
                paddingLeft: 0,
              },
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span
              style={{
                ...SOW_STATUS_COLORS[sow.status],
                display: 'inline-block',
                padding: '4px 11px',
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: 'var(--sans)',
              }}
            >
              {SOW_STATUS_LABELS[sow.status]}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--ink-faint)',
                fontFamily: 'var(--sans)',
              }}
            >
              v{sow.version}
            </span>
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--line)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        {[
          {
            label: 'Effective Date',
            value: sow.effective_date,
            key: 'effective_date',
            type: 'date',
          },
          { label: 'Expiry Date', value: sow.expiry_date, key: 'expiry_date', type: 'date' },
          {
            label: 'Total Value',
            value: sow.total_value,
            key: 'total_value',
            type: 'number',
          },
          {
            label: 'Payment Terms',
            value: sow.payment_terms,
            key: 'payment_terms',
            type: 'text',
          },
        ].map(col => (
          <div
            key={col.key}
            style={{ background: 'var(--surface)', padding: '14px 16px' }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
                fontFamily: 'var(--sans)',
                marginBottom: 4,
              }}
            >
              {col.label}
            </div>
            {inlineInput(col.value as string | number | null, v => {
              const val = col.type === 'number' ? (v ? parseFloat(v) : null) : v || null
              fieldUpdate(col.key as keyof Sow, val)
            }, { type: col.type })}
          </div>
        ))}
      </div>

      {/* Status actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}
      >
        {sow.status === 'draft' && (
          <button
            onClick={() => advanceStatus('sent')}
            style={actionBtnStyle('var(--navy)')}
          >
            <ArrowRight size={14} /> Mark as Sent
          </button>
        )}
        {sow.status === 'sent' && (
          <button
            onClick={() => advanceStatus('signed')}
            style={actionBtnStyle('var(--warn)')}
          >
            <CheckCircle size={14} /> Mark as Signed
          </button>
        )}
        {sow.status === 'signed' && (
          <button
            onClick={() => advanceStatus('active')}
            style={actionBtnStyle('var(--success)')}
          >
            <CheckCircle size={14} /> Activate
          </button>
        )}
        <a
          href={`/engagements/${engagementId}/sow/pdf`}
          target="_blank"
          style={actionBtnStyle('var(--wine)', true)}
        >
          <Download size={14} /> Download PDF
        </a>
        {(sow.status === 'sent' || sow.status === 'signed' || sow.status === 'active') && (
          <Link
            href={`/engagements/${engagementId}/sow/proposal`}
            style={actionBtnStyle('var(--indigo)', true)}
          >
            <FileCheck size={14} /> Generate Proposal →
          </Link>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {statusMsg && (
            <span
              style={{
                fontSize: 13,
                color: 'var(--success)',
                fontFamily: 'var(--sans)',
                alignSelf: 'center',
              }}
            >
              {statusMsg}
            </span>
          )}
          <button
            onClick={saveSow}
            disabled={saving}
            style={{
              background: 'var(--wine)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--sans)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Scope sections */}
      <div style={{ marginBottom: 24 }}>
        {sectionCard('objectives', 'Objectives', inlineTextarea(sow.objectives, v => fieldUpdate('objectives', v), 100))}
        {sectionCard('scope_of_work', 'Scope of Work', inlineTextarea(sow.scope_of_work, v => fieldUpdate('scope_of_work', v), 120))}
        {sectionCard('out_of_scope', 'Out of Scope', inlineTextarea(sow.out_of_scope, v => fieldUpdate('out_of_scope', v)))}
        {sectionCard('assumptions', 'Assumptions', inlineTextarea(sow.assumptions, v => fieldUpdate('assumptions', v)))}
        {sectionCard(
          'client_responsibilities',
          'Client Responsibilities',
          inlineTextarea(sow.client_responsibilities, v => fieldUpdate('client_responsibilities', v))
        )}
      </div>

      {/* Deliverables */}
      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: 'var(--line-soft)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
            }}
          >
            Deliverables &amp; Payment Schedule
          </span>
          <button
            onClick={addDeliverable}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--wine)',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--sans)',
              cursor: 'pointer',
            }}
          >
            <Plus size={13} /> Add Deliverable
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--sans)',
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: '#faf9f7' }}>
                {['Title', 'Description', 'Due Date', 'Amount ($)', 'Pay Month', 'Milestone', ''].map(
                  col => (
                    <th
                      key={col}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--line)',
                        fontWeight: 600,
                        fontSize: 11,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-soft)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {deliverables.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      color: 'var(--ink-faint)',
                      fontStyle: 'italic',
                    }}
                  >
                    No deliverables yet — click &quot;Add Deliverable&quot; to begin.
                  </td>
                </tr>
              )}
              {deliverables.map((d, idx) => (
                <tr
                  key={d.id}
                  style={{
                    borderBottom: '1px solid var(--line-soft)',
                    background: idx % 2 === 0 ? '#fff' : '#fdfcfb',
                  }}
                >
                  <td style={{ padding: '4px 8px', minWidth: 140 }}>
                    <input
                      className="vt-input"
                      value={d.title}
                      onChange={e => updateDeliverable(d.id, 'title', e.target.value)}
                      style={{ ...inputBase, fontSize: 13 }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', minWidth: 160 }}>
                    <input
                      className="vt-input"
                      value={d.description ?? ''}
                      onChange={e => updateDeliverable(d.id, 'description', e.target.value)}
                      style={{ ...inputBase, fontSize: 13 }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', minWidth: 120 }}>
                    <input
                      className="vt-input"
                      type="date"
                      value={d.due_date ?? ''}
                      onChange={e => updateDeliverable(d.id, 'due_date', e.target.value || null)}
                      style={{ ...inputBase, fontSize: 13 }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', minWidth: 100 }}>
                    <input
                      className="vt-input"
                      type="number"
                      value={d.payment_amount ?? ''}
                      onChange={e =>
                        updateDeliverable(
                          d.id,
                          'payment_amount',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      style={{ ...inputBase, fontSize: 13 }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', minWidth: 110 }}>
                    <input
                      className="vt-input"
                      type="month"
                      value={d.payment_month ?? ''}
                      onChange={e =>
                        updateDeliverable(d.id, 'payment_month', e.target.value || null)
                      }
                      style={{ ...inputBase, fontSize: 13 }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={d.is_milestone}
                      onChange={e => updateDeliverable(d.id, 'is_milestone', e.target.checked)}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <button
                      onClick={() => deleteDeliverable(d.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--danger)',
                        padding: 4,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {deliverables.length > 0 && (
                <tr style={{ background: 'var(--line-soft)', fontWeight: 600 }}>
                  <td colSpan={3} style={{ padding: '8px 12px', fontSize: 13, color: 'var(--ink-soft)' }}>
                    Total
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 13 }}>
                    {fmtMoney(
                      deliverables.reduce((s, d) => s + (d.payment_amount ?? 0), 0) || null
                    )}
                  </td>
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-generate section (signed or active) */}
      {(sow.status === 'signed' || sow.status === 'active') && (
        <div
          style={{
            background: 'var(--line-soft)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
              margin: '0 0 14px',
            }}
          >
            Auto-Generate from SOW
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={generateTasks}
              style={actionBtnStyle('var(--navy)')}
            >
              <FileText size={14} /> Generate Task List
            </button>
            <button
              onClick={generateRevenueSchedule}
              style={actionBtnStyle('var(--wine)')}
            >
              <ArrowRight size={14} /> Generate Revenue Schedule
            </button>
          </div>
          {genMsg && (
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                fontFamily: 'var(--sans)',
                color: genMsg.startsWith('⚠') ? 'var(--warn)' : genMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {genMsg}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div
        style={{
          border: '1px solid var(--line-soft)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: 'var(--line-soft)',
            padding: '10px 16px',
            fontFamily: 'var(--sans)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
          }}
        >
          Notes
        </div>
        <div style={{ padding: '12px 16px', background: '#fff' }}>
          {inlineTextarea(sow.notes, v => fieldUpdate('notes', v), 70)}
        </div>
      </div>

      {/* Signatories */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: 'Vérité Lead', key: 'verite_lead' as keyof Sow },
          { label: 'Client Signatory', key: 'client_signatory' as keyof Sow },
          { label: 'Vérité Signatory', key: 'verite_signatory' as keyof Sow },
        ].map(f => (
          <div
            key={f.key}
            style={{ border: '1px solid var(--line-soft)', borderRadius: 8, padding: '14px 16px', background: '#fff' }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
                fontFamily: 'var(--sans)',
                marginBottom: 4,
              }}
            >
              {f.label}
            </div>
            {inlineInput(sow[f.key] as string | null, v => fieldUpdate(f.key, v))}
          </div>
        ))}
      </div>
    </>
  )
}

function actionBtnStyle(bg: string, isAnchor = false): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--sans)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    textDecoration: 'none',
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SowClient({ engagement, sow, teamMembers, engagementId }: Props) {
  if (!sow) {
    return (
      <CreateSowForm
        engagement={engagement}
        teamMembers={teamMembers}
        engagementId={engagementId}
      />
    )
  }

  return (
    <SowEditor
      sow={sow}
      teamMembers={teamMembers}
      engagementId={engagementId}
    />
  )
}
