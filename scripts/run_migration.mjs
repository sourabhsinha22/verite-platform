import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Client } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))

const client = new Client({
  host: 'db.glfnxzilgwtfvnrxzsxn.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'q#%6TRu_q2T?j8D',
  ssl: { rejectUnauthorized: false }
})

const sql = readFileSync(join(__dirname, '../supabase/multitenancy.sql'), 'utf8')

try {
  await client.connect()
  console.log('Connected to database')
  await client.query(sql)
  console.log('Migration complete ✓')

  // Verify
  const verify = await client.query(`
    SELECT 'orgs' as tbl, count(*)::int FROM orgs
    UNION ALL SELECT 'engagements without org_id', count(*)::int FROM engagements WHERE org_id IS NULL
    UNION ALL SELECT 'companies without org_id', count(*)::int FROM companies WHERE org_id IS NULL
    UNION ALL SELECT 'invoices without org_id', count(*)::int FROM invoices WHERE org_id IS NULL
    UNION ALL SELECT 'tasks without org_id', count(*)::int FROM tasks WHERE org_id IS NULL
  `)
  console.log('\nVerification:')
  verify.rows.forEach(r => console.log(' ', r.tbl, '→', r.count))
} catch (e) {
  console.error('Error:', e.message)
} finally {
  await client.end()
}
