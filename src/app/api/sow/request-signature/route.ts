import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

async function sendBrandedEmail(params: {
  to_email: string
  engagement_name: string
  sow_title: string
  sow_url: string
  message?: string
}) {
  const { to_email, engagement_name, sow_title, sow_url, message } = params
  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
      <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 28px;">
        <h1 style="font-size: 28px; font-weight: 600; margin: 0; color: #25314a;">Vérité Health Collective</h1>
        <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Statement of Work — Signature Request</p>
      </div>

      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 8px;">
        Please review and sign the Statement of Work for <strong>${engagement_name}</strong>.
      </p>
      <p style="font-size: 14px; color: #5f5f6e; margin-bottom: 6px;">
        <strong>Document:</strong> ${sow_title}
      </p>

      ${message ? `
      <div style="background: #faf6f2; border-left: 3px solid #5f3e3f; border-radius: 4px; padding: 14px 18px; margin: 20px 0; font-size: 14px; color: #3a3550; line-height: 1.6;">
        ${message.replace(/\n/g, '<br />')}
      </div>
      ` : ''}

      <div style="margin: 28px 0;">
        <a href="${sow_url}"
          style="display: inline-block; background: #5f3e3f; color: #ffffff; padding: 13px 28px; border-radius: 5px; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.04em;">
          Review &amp; Sign SOW →
        </a>
      </div>

      <p style="font-size: 12px; color: #9a9aa5; margin-top: 32px; line-height: 1.6;">
        Questions? Reply to this email or contact your Vérité Health Collective account manager.<br />
        Vérité Health Collective · Healthcare Revenue &amp; Operations
      </p>
      <div style="border-top: 1px solid #e6ddd4; margin-top: 24px; padding-top: 14px;">
        <p style="font-size: 11px; color: #b8b3a4; margin: 0; letter-spacing: 0.06em; text-transform: uppercase;">
          Vérité Health Collective — Confidential
        </p>
      </div>
    </div>
  `
  return sendEmail({
    to: to_email,
    subject: `Signature Requested — ${engagement_name}`,
    html,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { sow_id, to_email, to_name, engagement_name, sow_title, sow_url, message } = body as {
    sow_id: string
    to_email: string
    to_name: string
    engagement_name: string
    sow_title: string
    sow_url: string
    message?: string
  }

  if (!sow_id || !to_email) {
    return NextResponse.json({ ok: false, error: 'Missing sow_id or to_email' }, { status: 400 })
  }

  const apiKey = process.env.DROPBOX_SIGN_API_KEY

  const supabase = await createClient()

  // Send branded notification email regardless
  await sendBrandedEmail({ to_email, engagement_name, sow_title, sow_url, message })

  if (!apiKey) {
    // No API key — email-only flow
    await supabase
      .from('sows')
      .update({
        status: 'sent',
        signature_requested_at: new Date().toISOString(),
        signature_requested_to: to_email,
      })
      .eq('id', sow_id)

    return NextResponse.json({ ok: true, method: 'email_only' })
  }

  // Dropbox Sign API flow
  const pdfUrl = sow_url.replace(/\/sow$/, '/sow/pdf')
  const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64')

  let signatureRequestId: string | null = null
  let dsError: string | null = null

  try {
    const formData = new FormData()
    formData.append('title', sow_title)
    formData.append('subject', `Please sign: ${sow_title}`)
    formData.append('message', message ?? `Please review and sign the Statement of Work for ${engagement_name}.`)
    formData.append('file_url[0]', pdfUrl)
    formData.append('signers[0][email_address]', to_email)
    formData.append('signers[0][name]', to_name || to_email)

    const dsRes = await fetch('https://api.hellosign.com/v3/signature_request/send', {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: formData,
    })

    if (dsRes.ok) {
      const dsData = await dsRes.json() as { signature_request?: { signature_request_id?: string } }
      signatureRequestId = dsData?.signature_request?.signature_request_id ?? null
    } else {
      const errText = await dsRes.text()
      dsError = `Dropbox Sign API error ${dsRes.status}: ${errText}`
    }
  } catch (err) {
    dsError = err instanceof Error ? err.message : 'Network error calling Dropbox Sign'
  }

  // Update sow record
  const updates: Record<string, unknown> = {
    status: 'sent',
    signature_requested_at: new Date().toISOString(),
    signature_requested_to: to_email,
  }
  if (signatureRequestId) {
    updates.signature_link = signatureRequestId
  }
  await supabase.from('sows').update(updates).eq('id', sow_id)

  if (dsError) {
    return NextResponse.json({ ok: true, method: 'email_fallback', error: dsError })
  }

  return NextResponse.json({ ok: true, method: 'dropbox_sign', signature_request_id: signatureRequestId })
}
