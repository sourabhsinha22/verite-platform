import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://glfnxzilgwtfvnrxzsxn.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZm54emlsZ3d0ZnZucnh6c3huIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDM0MTA2OSwiZXhwIjoyMDk1OTE3MDY5fQ.GlSESf9_TE4s8k8ObjypKZf6f5E1wk-qoSAh59H_ZxQ'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEMO_PASSWORD = 'Demo2026!'

const demoUsers = [
  { email: 'demo.admin@veritehealth.com',     name: 'Demo Admin',     role: 'Admin' },
  { email: 'demo.partner@veritehealth.com',   name: 'Demo Partner',   role: 'Partner' },
  { email: 'demo.associate@veritehealth.com', name: 'Demo Associate', role: 'Associate' },
]

// Get the verite-health org
const { data: org } = await admin.from('orgs').select('id').eq('slug', 'verite-health').single()
if (!org) { console.error('verite-health org not found'); process.exit(1) }
console.log('Org ID:', org.id)

for (const u of demoUsers) {
  console.log(`\n--- ${u.role}: ${u.email} ---`)

  // Create or fetch auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: u.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: u.name },
  })

  let userId
  if (createErr) {
    if (createErr.message.includes('already been registered')) {
      // fetch existing
      const { data: list } = await admin.auth.admin.listUsers()
      const existing = list?.users?.find(usr => usr.email === u.email)
      if (!existing) { console.error('  Could not find existing user'); continue }
      userId = existing.id
      console.log('  Auth user already exists:', userId)
    } else {
      console.error('  Create error:', createErr.message)
      continue
    }
  } else {
    userId = created.user.id
    console.log('  Auth user created:', userId)
  }

  // Upsert org_members
  const { error: omErr } = await admin.from('org_members').upsert({
    org_id: org.id,
    user_id: userId,
    role: u.role,
  }, { onConflict: 'org_id,user_id' })
  if (omErr) console.error('  org_members error:', omErr.message)
  else console.log('  org_members: OK')

  // Upsert team_members
  const { error: tmErr } = await admin.from('team_members').upsert({
    email: u.email,
    name: u.name,
    role: u.role,
    auth_user_id: userId,
    org_id: org.id,
    user_id: userId,
  }, { onConflict: 'email' })
  if (tmErr) console.error('  team_members error:', tmErr.message)
  else console.log('  team_members: OK')
}

console.log('\n✓ Done. Password for all demo accounts:', DEMO_PASSWORD)
console.log('\nDemo accounts:')
for (const u of demoUsers) {
  console.log(`  ${u.role.padEnd(10)} ${u.email}`)
}
