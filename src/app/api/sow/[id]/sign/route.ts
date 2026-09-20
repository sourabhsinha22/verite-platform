import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isPartner } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSowPdf } from '@/lib/sow-pdf'
import { Sow } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user || !isPartner(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { signatureDataUrl } = await req.json() as { signatureDataUrl: string }
  if (!signatureDataUrl) {
    return NextResponse.json({ error: 'Missing signatureDataUrl' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch SOW with phases
  const { data: sow, error: sowErr } = await admin
    .from('sows')
    .select('*, sow_phases(id, sow_id, title, description, sort_order, created_at)')
    .eq('id', id)
    .single()

  if (sowErr || !sow) {
    return NextResponse.json({ error: 'SOW not found' }, { status: 404 })
  }

  const sowTyped = { ...sow, phases: sow.sow_phases ?? [] } as Sow

  const pdfBytes = await generateSowPdf(sowTyped, {
    internalSignatureDataUrl: signatureDataUrl,
    orgName: user.orgName ?? undefined,
  })

  const path = `sows/${id}/signed-internal.pdf`
  const { error: uploadErr } = await admin.storage
    .from('documents')
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) {
    return NextResponse.json({ error: 'Upload failed: ' + uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(path)

  await admin
    .from('sows')
    .update({
      internal_signed_at: new Date().toISOString(),
      verite_signatory: user.name,
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, pdfUrl: publicUrl })
}
