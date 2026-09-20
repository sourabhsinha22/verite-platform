// RLS test: sign in as each demo user and verify data access
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://glfnxzilgwtfvnrxzsxn.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZm54emlsZ3d0ZnZucnh6c3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDEwNjksImV4cCI6MjA5NTkxNzA2OX0.QEWDaUSxP7nGEz4GCtAazeONowZrLdBmpQr-68P-POQ'
const DEMO_PASSWORD = 'Demo2026!'

const users = [
  { email: 'demo.admin@veritehealth.com',     role: 'Admin' },
  { email: 'demo.partner@veritehealth.com',   role: 'Partner' },
  { email: 'demo.associate@veritehealth.com', role: 'Associate' },
]

async function testUser({ email, role }) {
  const client = createClient(SUPABASE_URL, ANON_KEY)
  const { error: loginErr } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
  if (loginErr) { console.log(`✗ ${role}: login failed — ${loginErr.message}`); return }
  console.log(`\n=== ${role} (${email}) ===`)

  const checks = [
    ['org_members',   () => client.from('org_members').select('role, org_id')],
    ['orgs',          () => client.from('orgs').select('name, slug')],
    ['engagements',   () => client.from('engagements').select('id', { count: 'exact', head: true })],
    ['companies',     () => client.from('companies').select('id', { count: 'exact', head: true })],
    ['tasks',         () => client.from('tasks').select('id', { count: 'exact', head: true })],
    ['invoices',      () => client.from('invoices').select('id', { count: 'exact', head: true })],
    ['expenses',      () => client.from('expenses').select('id', { count: 'exact', head: true })],
    ['distributions', () => client.from('distributions').select('id', { count: 'exact', head: true })],
    ['bank_balance',  () => client.from('bank_balance').select('id', { count: 'exact', head: true })],
  ]

  for (const [table, query] of checks) {
    const { data, count, error } = await query()
    if (error) {
      console.log(`  ✗ ${table.padEnd(15)} blocked (${error.code}: ${error.message.slice(0, 60)})`)
    } else {
      const result = count !== null ? `${count} rows` : JSON.stringify(data).slice(0, 80)
      console.log(`  ✓ ${table.padEnd(15)} accessible — ${result}`)
    }
  }
  await client.auth.signOut()
}

for (const u of users) {
  await testUser(u)
}
console.log('\n✓ RLS test complete')
