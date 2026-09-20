import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSowPdf } from '@/lib/sow-pdf'
import { Sow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { token, signatureDataUrl, clientName } = await req.json() as {
    token: string
    signatureDataUrl: string
    clientName: string
  }

  if (!token || !signatureDataUrl || !clientName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: sow, error: sowErr } = await admin
    .from('sows')
    .select('*, sow_phases(id, sow_id, title, description, sort_order, created_at), engagement:engagements(name, company:companies(name))')
    .eq('signing_token', token)
    .single()

  if (sowErr || !sow) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
  }

  if (sow.status !== 'sent') {
    return NextResponse.json({ error: 'This document is not awaiting signature' }, { status: 400 })
  }

  if (sow.client_signed_at) {
    return NextResponse.json({ error: 'Already signed' }, { status: 400 })
  }

  const sowTyped = { ...sow, phases: sow.sow_phases ?? [] } as Sow

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engagement = sow.engagement as any
  const orgName = engagement?.company?.name ?? undefined

  const pdfBytes = await generateSowPdf(sowTyped, {
    clientSignatureDataUrl: signatureDataUrl,
    orgName,
  })

  const path = `sows/${sow.id}/signed-final.pdf`
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
      client_signed_at: new Date().toISOString(),
      status: 'signed',
      signed_date: new Date().toISOString().slice(0, 10),
      client_signatory: clientName,
      signed_pdf_url: publicUrl,
    })
    .eq('id', sow.id)

  return NextResponse.json({ ok: true })
}
