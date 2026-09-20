import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
const KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const { data, error } = await admin
  .from('sows')
  .select('id, signed_pdf_url, signing_token, internal_signed_at, client_signed_at')
  .limit(1)

if (error) {
  console.log('✗ Columns NOT present:', error.message)
} else {
  console.log('✓ All 4 columns present on sows table')
}
