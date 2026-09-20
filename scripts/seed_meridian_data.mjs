import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://glfnxzilgwtfvnrxzsxn.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZm54emlsZ3d0ZnZucnh6c3huIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDM0MTA2OSwiZXhwIjoyMDk1OTE3MDY5fQ.GlSESf9_TE4s8k8ObjypKZf6f5E1wk-qoSAh59H_ZxQ'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Get Meridian org
const { data: org } = await admin.from('orgs').select('id').eq('slug', 'meridian-health').single()
if (!org) { console.error('meridian-health org not found'); process.exit(1) }
console.log('Meridian org ID:', org.id)

// Get the company we already created
const { data: company } = await admin.from('companies').select('id,name').eq('org_id', org.id).single()
console.log('Company:', company?.name, company?.id)

// Insert engagement with correct column names
const { data: engagement, error: engErr } = await admin.from('engagements').insert({
  name: 'BlueSky — Care Coordination',
  engagement_type: 'care-model',
  engagement_category: 'verite_client',
  stage: 'active',
  contract_value: 95000,
  probability: 100,
  org_id: org.id,
  company_id: company?.id,
  notes: 'Cross-org test engagement for Meridian Health Partners',
}).select().single()

if (engErr) { console.error('Engagement error:', engErr.message); process.exit(1) }
console.log('✓ Engagement:', engagement.name, engagement.id)

// Task
const { error: taskErr } = await admin.from('tasks').insert({
  title: 'Meridian Q4 care coordination review',
  status: 'not_started',
  priority: 'high',
  engagement_id: engagement.id,
  org_id: org.id,
})
if (taskErr) console.error('Task error:', taskErr.message)
else console.log('✓ Task seeded')

// Second task
await admin.from('tasks').insert({
  title: 'BlueSky onboarding kickoff — schedule stakeholder meeting',
  status: 'in_progress',
  priority: 'medium',
  engagement_id: engagement.id,
  org_id: org.id,
})
console.log('✓ Task 2 seeded')

// Invoice
const { error: invErr } = await admin.from('invoices').insert({
  invoice_number: 'MHP-001',
  engagement_id: engagement.id,
  amount: 15000,
  status: 'sent',
  org_id: org.id,
})
if (invErr) console.error('Invoice error:', invErr.message)
else console.log('✓ Invoice seeded')

console.log('\n✓ Meridian data complete')
