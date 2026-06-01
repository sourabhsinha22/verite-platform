import { EngagementStage, EngagementType, CompanyTag, TaskStatus, ENGAGEMENT_TYPE_LABELS, ENGAGEMENT_STAGE_LABELS, COMPANY_TAG_LABELS, TASK_STATUS_LABELS } from '@/lib/types'

type BadgeVariant = 'type' | 'stage' | 'tag' | 'status' | 'health'

const TYPE_STYLES: Record<EngagementType, { bg: string; color: string }> = {
  opportunity:    { bg: '#d8dde8', color: 'var(--navy)' },
  'project-based':{ bg: '#ead9cd', color: 'var(--wine)' },
  'sales-growth': { bg: '#e3bca6', color: 'var(--wine)' },
  'care-model':   { bg: '#c59a88', color: '#fff'        },
}

const STAGE_STYLES: Record<EngagementStage, { bg: string; color: string }> = {
  lead:        { bg: '#f3e4dc', color: 'var(--wine)' },
  opportunity: { bg: '#d8dde8', color: 'var(--navy)' },
  active:      { bg: 'var(--success-soft)', color: 'var(--success)' },
  paused:      { bg: 'var(--warn-soft)', color: 'var(--warn)' },
  closed:      { bg: '#ece3dd', color: '#6b5b50' },
}

const TAG_STYLES: Record<CompanyTag, { bg: string; color: string }> = {
  current:  { bg: 'var(--success-soft)', color: 'var(--success)' },
  prospect: { bg: '#d8dde8', color: 'var(--navy)' },
  past:     { bg: '#ece3dd', color: '#6b5b50' },
}

const STATUS_STYLES: Record<TaskStatus, { bg: string; color: string; border: string }> = {
  'not-started': { bg: '#f5f3ee', color: 'var(--ink-soft)', border: 'var(--line)' },
  'in-progress': { bg: '#fff4dc', color: '#8a5a00', border: '#f0d8a0' },
  'blocked':     { bg: 'var(--danger-soft)', color: 'var(--danger)', border: '#e8c5c5' },
  'done':        { bg: 'var(--success-soft)', color: 'var(--success)', border: '#c8dec9' },
}

const HEALTH_STYLES = {
  green:  { bg: 'var(--success-soft)', color: 'var(--success)' },
  yellow: { bg: 'var(--warn-soft)', color: 'var(--warn)' },
  red:    { bg: 'var(--danger-soft)', color: 'var(--danger)' },
}

interface BadgeProps {
  type?: EngagementType
  stage?: EngagementStage
  tag?: CompanyTag
  status?: TaskStatus
  health?: 'green' | 'yellow' | 'red'
  label?: string
}

const BASE = {
  display: 'inline-block',
  padding: '4px 11px',
  borderRadius: '3px',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
}

export default function Badge({ type, stage, tag, status, health, label }: BadgeProps) {
  if (type) {
    const s = TYPE_STYLES[type]
    return <span style={{ ...BASE, background: s.bg, color: s.color }}>{ENGAGEMENT_TYPE_LABELS[type]}</span>
  }
  if (stage) {
    const s = STAGE_STYLES[stage]
    return <span style={{ ...BASE, background: s.bg, color: s.color }}>{ENGAGEMENT_STAGE_LABELS[stage]}</span>
  }
  if (tag) {
    const s = TAG_STYLES[tag]
    return <span style={{ ...BASE, background: s.bg, color: s.color }}>{COMPANY_TAG_LABELS[tag]}</span>
  }
  if (status) {
    const s = STATUS_STYLES[status]
    return <span style={{ ...BASE, background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>{TASK_STATUS_LABELS[status]}</span>
  }
  if (health) {
    const s = HEALTH_STYLES[health]
    return <span style={{ ...BASE, background: s.bg, color: s.color }}>{health}</span>
  }
  if (label) {
    return <span style={{ ...BASE, background: 'var(--line-soft)', color: 'var(--ink-soft)' }}>{label}</span>
  }
  return null
}
