import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://glfnxzilgwtfvnrxzsxn.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZm54emlsZ3d0ZnZucnh6c3huIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDM0MTA2OSwiZXhwIjoyMDk1OTE3MDY5fQ.GlSESf9_TE4s8k8ObjypKZf6f5E1wk-qoSAh59H_ZxQ'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── 1. Create new org ──────────────────────────────────────────────────────
console.log('\n── Creating Meridian Health Partners org ──')
const { data: org, error: orgErr } = await admin.from('orgs').insert({
  name: 'Meridian Health Partners',
  slug: 'meridian-health',
  brand: { primary: '#1a4a6e', accent: '#2a7a5a' }, // teal/forest green palette
}).select().single()

if (orgErr) { console.error('org insert error:', orgErr.message); process.exit(1) }
console.log('✓ Org created:', org.id, org.slug)

// ── 2. Create org-only user (pure Meridian, no verite-health) ─────────────
console.log('\n── Creating meridian.admin@meridianhealth.com ──')
const { data: mAdminAuth, error: mAdminErr } = await admin.auth.admin.createUser({
  email: 'meridian.admin@meridianhealth.com',
  password: 'Demo2026!',
  email_confirm: true,
  user_metadata: { name: 'Meridian Admin' },
})
if (mAdminErr && !mAdminErr.message.includes('already')) {
  console.error('create meridian admin error:', mAdminErr.message)
} else {
  const mAdminId = mAdminAuth?.user?.id ?? (await admin.auth.admin.listUsers({ perPage: 200 }))
    .data?.users?.find(u => u.email === 'meridian.admin@meridianhealth.com')?.id
  console.log('  Auth user:', mAdminId)

  await admin.from('org_members').upsert({ org_id: org.id, user_id: mAdminId, role: 'Admin' }, { onConflict: 'org_id,user_id' })
  await admin.from('team_members').upsert({ email: 'meridian.admin@meridianhealth.com', name: 'Meridian Admin', role: 'Admin', auth_user_id: mAdminId, org_id: org.id }, { onConflict: 'email' })
  console.log('  ✓ org_members + team_members: OK')
}

// ── 3. Add demo.partner to BOTH orgs (cross-org test user) ────────────────
console.log('\n── Adding demo.partner to Meridian org (dual-org user) ──')
const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 })
const demoPartner = users?.users?.find(u => u.email === 'demo.partner@veritehealth.com')
if (!demoPartner) { console.error('demo.partner not found'); process.exit(1) }
console.log('  demo.partner auth id:', demoPartner.id)

const { error: omErr } = await admin.from('org_members').upsert(
  { org_id: org.id, user_id: demoPartner.id, role: 'Associate' },
  { onConflict: 'org_id,user_id' }
)
if (omErr) console.error('  org_members error:', omErr.message)
else console.log('  ✓ demo.partner added to meridian-health as Associate')

// ── 4. Seed some Meridian-specific data ───────────────────────────────────
console.log('\n── Seeding Meridian data ──')

// Company in Meridian org
const { data: company } = await admin.from('companies').insert({
  name: 'BlueSky Behavioral Health',
  industry: 'Behavioral Health',
  org_id: org.id,
}).select().single()
console.log('  ✓ Company:', company?.name)

// Engagement in Meridian org
const { data: engagement } = await admin.from('engagements').insert({
  name: 'BlueSky — Care Coordination',
  type: 'Care Model',
  stage: 'active',
  contract_value: 95000,
  probability: 100,
  org_id: org.id,
  company_id: company?.id,
}).select().single()
console.log('  ✓ Engagement:', engagement?.name)

// Task in Meridian org
if (engagement) {
  await admin.from('tasks').insert({
    title: 'Meridian Q4 care coordination review',
    status: 'not_started',
    priority: 'high',
    engagement_id: engagement.id,
    org_id: org.id,
  })
  console.log('  ✓ Task seeded')
}

// Invoice in Meridian org
if (engagement) {
  await admin.from('invoices').insert({
    invoice_number: 'MHP-001',
    engagement_id: engagement.id,
    amount: 15000,
    status: 'sent',
    org_id: org.id,
  })
  console.log('  ✓ Invoice seeded')
}

console.log('\n══════════════════════════════════════════════')
console.log('Meridian org ID:', org.id)
console.log('Meridian org slug:', org.slug)
console.log('Brand: primary=#1a4a6e (teal navy), accent=#2a7a5a (forest green)')
console.log('\nTest accounts:')
console.log('  meridian.admin@meridianhealth.com  (Admin, Meridian only)')
console.log('  demo.partner@veritehealth.com      (Associate in Meridian + Partner in Vérité)')
console.log('  Password: Demo2026!')
console.log('══════════════════════════════════════════════')
