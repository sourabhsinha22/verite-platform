export type CompanyTag = 'current' | 'prospect' | 'past'
export type EngagementType = 'opportunity' | 'project-based' | 'sales-growth' | 'care-model'
export type EngagementStage = 'lead' | 'opportunity' | 'active' | 'paused' | 'closed'
export type TaskStatus = 'not-started' | 'in-progress' | 'blocked' | 'done'
export type RevenueType = 'retainer' | 'revenue-share' | 'project' | 'hourly'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface Contact {
  id: string
  company_id: string
  name: string
  title: string
  department: string
  email: string
  phone: string
  linkedin: string
  notes: string
  is_primary: boolean
  created_at: string
}

export interface Company {
  id: string
  name: string
  tag: CompanyTag
  industry: string
  size: string
  website: string
  address: string
  notes: string
  account_owner: string
  created_at: string
  contacts?: Contact[]
  engagements?: Engagement[]
}

export interface Task {
  id: string
  engagement_id: string
  title: string
  owner: string
  due_date: string | null
  status: TaskStatus
  priority: 'low' | 'medium' | 'high'
  notes: string
  task_group: 'sales' | 'project' | 'custom'
  sort_order: number
  created_at: string
}

export interface RevenueItem {
  id: string
  engagement_id: string
  label: string
  month: string | null
  milestone: string | null
  forecast_amount: number
  actual_amount: number | null
  invoice_id: string | null
  notes: string
  sort_order: number
  created_at: string
}

export interface Invoice {
  id: string
  engagement_id: string
  company_id: string
  invoice_number: string
  amount: number
  date_sent: string | null
  due_date: string | null
  paid_date: string | null
  status: InvoiceStatus
  notes: string
  created_at: string
}

export interface Engagement {
  id: string
  company_id: string
  name: string
  engagement_type: EngagementType
  stage: EngagementStage
  lead: string
  start_date: string | null
  end_date: string | null
  contract_value: number | null
  revenue_type: RevenueType | null
  revenue_share_pct: number | null
  notes: string
  health: 'green' | 'yellow' | 'red'
  created_at: string
  company?: Company
  tasks?: Task[]
  revenue_items?: RevenueItem[]
  invoices?: Invoice[]
}

export type SowStatus = 'draft' | 'sent' | 'signed' | 'active' | 'expired' | 'cancelled'

export interface SowDeliverable {
  id: string
  sow_id: string
  phase_id: string | null
  title: string
  description: string
  due_date: string | null
  payment_amount: number | null
  payment_month: string | null
  is_milestone: boolean
  sort_order: number
  created_at: string
}

export interface SowPhase {
  id: string
  sow_id: string
  title: string
  description: string
  start_date: string | null
  end_date: string | null
  sort_order: number
  deliverables?: SowDeliverable[]
  created_at: string
}

export interface Sow {
  id: string
  engagement_id: string
  title: string
  version: number
  status: SowStatus
  effective_date: string | null
  expiry_date: string | null
  signed_date: string | null
  objectives: string
  scope_of_work: string
  out_of_scope: string
  assumptions: string
  client_responsibilities: string
  total_value: number | null
  revenue_type: RevenueType | null
  revenue_share_pct: number | null
  payment_terms: string
  billing_frequency: string
  verite_lead: string
  client_signatory: string
  verite_signatory: string
  notes: string
  created_at: string
  updated_at: string
  phases?: SowPhase[]
  deliverables?: SowDeliverable[]
}

export const SOW_STATUS_LABELS: Record<SowStatus, string> = {
  draft: 'Draft',
  sent: 'Sent to Client',
  signed: 'Signed',
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string | null
}

// UI helpers
export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  'opportunity': 'Opportunity',
  'project-based': 'Project-Based',
  'sales-growth': 'Sales & Growth',
  'care-model': 'Care Model',
}

export const ENGAGEMENT_STAGE_LABELS: Record<EngagementStage, string> = {
  lead: 'Lead',
  opportunity: 'Opportunity',
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
}

export const COMPANY_TAG_LABELS: Record<CompanyTag, string> = {
  current: 'Current Client',
  prospect: 'Prospect',
  past: 'Past Client',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'blocked': 'Blocked',
  'done': 'Done',
}
