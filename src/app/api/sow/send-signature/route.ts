import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { sow_id, to_email, message, engagement_name, sow_title, sow_url } = body as {
    sow_id: string
    to_email: string
    message?: string
    engagement_name: string
    sow_title: string
    sow_url: string
  }

  if (!sow_id || !to_email) {
    return NextResponse.json({ ok: false, error: 'Missing sow_id or to_email' }, { status: 400 })
  }

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
      <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 28px;">
        <h1 style="font-size: 28px; font-weight: 600; margin: 0; color: #25314a;">Vérité Health Collective</h1>
        <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Statement of Work</p>
      </div>

      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 8px;">
        Please review the Statement of Work for <strong>${engagement_name}</strong>.
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
          View SOW →
        </a>
      </div>

      <div style="background: #f5f3ee; border: 1px solid #e6ddd4; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 13px; color: #5f5f6e; line-height: 1.6;">
        <strong style="color: #25314a;">To sign:</strong> Please print, sign, and return a copy — or reply to this email to arrange electronic signing.
      </div>

      <p style="font-size: 12px; color: #9a9aa5; margin-top: 32px; line-height: 1.6;">
        Questions? Reply to this email or contact your Vérité Health Collective account manager.<br />
        Vérité Health Collective · Healthcare Revenue & Operations
      </p>
      <div style="border-top: 1px solid #e6ddd4; margin-top: 24px; padding-top: 14px;">
        <p style="font-size: 11px; color: #b8b3a4; margin: 0; letter-spacing: 0.06em; text-transform: uppercase;">
          Vérité Health Collective — Confidential
        </p>
      </div>
    </div>
  `

  const result = await sendEmail({
    to: to_email,
    subject: `Statement of Work Ready for Review — ${engagement_name}`,
    html,
  })

  if (!result.ok && result.error !== 'No API key') {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  const supabase = await createClient()
  await supabase
    .from('sows')
    .update({
      signature_requested_at: new Date().toISOString(),
      signature_requested_to: to_email,
    })
    .eq('id', sow_id)

  return NextResponse.json({ ok: true, sent: true })
}
