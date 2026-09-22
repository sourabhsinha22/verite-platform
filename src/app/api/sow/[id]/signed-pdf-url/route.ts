import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get('verite-active-org')?.value
  const currentUser = await getCurrentUser(activeOrgId)

  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (currentUser.role === 'Associate') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: sow } = await supabaseAdmin
    .from('sows')
    .select('id, signed_pdf_url, org_id')
    .eq('id', id)
    .single()

  if (!sow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (sow.org_id !== currentUser.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!sow.signed_pdf_url) return NextResponse.json({ error: 'No signed PDF' }, { status: 404 })

  // Extract storage path from the stored URL
  // stored as: https://<project>.supabase.co/storage/v1/object/public/documents/sows/...
  // or just the path: sows/<id>/signed-final.pdf
  let storagePath = sow.signed_pdf_url
  const match = sow.signed_pdf_url.match(/\/object\/(?:public\/)?documents\/(.+)$/)
  if (match) storagePath = match[1]

  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 5) // 5 minutes

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
