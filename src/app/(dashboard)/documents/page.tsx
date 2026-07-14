export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import DocumentsClient from '@/components/documents/DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('documents')
    .select('*, engagement:engagements(id, name), company:companies(id, name)')
    .order('created_at', { ascending: false })

  const docs = (data ?? []).map(d => ({
    ...d,
    engagement: Array.isArray(d.engagement) ? (d.engagement[0] ?? null) : d.engagement as { id: string; name: string } | null,
    company: Array.isArray(d.company) ? (d.company[0] ?? null) : d.company as { id: string; name: string } | null,
  }))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
          Documents
        </h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 8, marginBottom: 0 }}>
          {docs.length} file{docs.length !== 1 ? 's' : ''} across all engagements and companies
        </p>
      </div>
      <DocumentsClient docs={docs} supabaseUrl={supabaseUrl} />
    </div>
  )
}
