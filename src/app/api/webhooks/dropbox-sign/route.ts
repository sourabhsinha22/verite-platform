import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface DropboxSignEvent {
  event: {
    event_type: string
    event_time: string
    event_hash?: string
  }
  signature_request?: {
    signature_request_id: string
    title?: string
  }
}

export async function POST(req: NextRequest) {
  let payload: DropboxSignEvent

  try {
    // Dropbox Sign sends JSON
    payload = await req.json()
  } catch {
    // Dropbox Sign also sends form-encoded; try that
    const text = await req.text()
    const params = new URLSearchParams(text)
    const jsonStr = params.get('json')
    if (!jsonStr) {
      return NextResponse.json({ hello: 'hellosign' })
    }
    payload = JSON.parse(jsonStr)
  }

  const eventType = payload?.event?.event_type
  const signatureRequestId = payload?.signature_request?.signature_request_id

  if (!eventType || !signatureRequestId) {
    return NextResponse.json({ hello: 'hellosign' })
  }

  if (
    eventType === 'signature_request_signed' ||
    eventType === 'signature_request_all_signed'
  ) {
    const supabase = await createClient()

    // Find sow by signature_link which stores the signature_request_id
    const { data: sow } = await supabase
      .from('sows')
      .select('id, engagement_id')
      .eq('signature_link', signatureRequestId)
      .single()

    if (sow) {
      const today = new Date().toISOString().slice(0, 10)
      await supabase
        .from('sows')
        .update({
          status: 'signed',
          signed_date: today,
        })
        .eq('id', sow.id)

      if (eventType === 'signature_request_all_signed') {
        // Log activity
        await supabase.from('activity_entries').insert({
          engagement_id: sow.engagement_id,
          author: 'System',
          author_id: null,
          entry_type: 'milestone',
          content: 'SOW signed via Dropbox Sign — all parties have signed.',
          metadata: { signature_request_id: signatureRequestId },
        })
      }
    }
  }

  // Dropbox Sign requires this exact response
  return NextResponse.json({ hello: 'hellosign' })
}
