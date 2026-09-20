import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://glfnxzilgwtfvnrxzsxn.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZm54emlsZ3d0ZnZucnh6c3huIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDM0MTA2OSwiZXhwIjoyMDk1OTE3MDY5fQ.GlSESf9_TE4s8k8ObjypKZf6f5E1wk-qoSAh59H_ZxQ'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
const target = list?.users?.find(u => u.email === 'sourabh.sinha@nouvelleed.com')

if (!target) {
  console.error('User not found in auth.users')
  console.log('All users:', list?.users?.map(u => u.email))
  process.exit(1)
}

console.log('Found user:', target.id, target.email)

const { error } = await admin.from('platform_admins').upsert(
  { user_id: target.id },
  { onConflict: 'user_id' }
)

if (error) {
  console.error('Insert error:', error.message)
  process.exit(1)
}

console.log('✓ Seeded platform_admins for', target.email, '(' + target.id + ')')
