import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser, isPartner } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get('verite-active-org')?.value
  const user = await getCurrentUser(activeOrgId)
  if (!user || !isPartner(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { clientEmail?: string }
  const token = crypto.randomUUID()

  const admin = createAdminClient()

  // Fetch SOW + org for email context
  const { data: sow } = await admin
    .from('sows')
    .select('title, engagement:engagements(name, company:companies(name))')
    .eq('id', id)
    .single()

  const { error } = await admin
    .from('sows')
    .update({
      status: 'sent',
      signing_token: token,
      signature_requested_at: new Date().toISOString(),
      signature_requested_to: body.clientEmail ?? null,
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const signingUrl = '/sign/' + token
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'
  const fullSigningUrl = appUrl + signingUrl

  // Send email if client email provided
  if (body.clientEmail) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engagement = sow?.engagement as any
    const companyName = engagement?.company?.name ?? 'your organization'
    const sowTitle = sow?.title ?? 'Statement of Work'
    const orgName = user.orgName ?? 'Vérité Health Collective'

    await sendEmail({
      to: body.clientEmail,
      subject: `Signature requested: ${sowTitle}`,
      html: signingRequestEmailHtml({
        orgName,
        requesterName: user.name,
        companyName,
        sowTitle,
        signingUrl: fullSigningUrl,
      }),
      fromName: orgName,
    })
  }

  return NextResponse.json({ ok: true, signingUrl })
}

function signingRequestEmailHtml({ orgName, requesterName, companyName, sowTitle, signingUrl }: {
  orgName: string
  requesterName: string
  companyName: string
  sowTitle: string
  signingUrl: string
}) {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
      <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 600; margin: 0; color: #25314a;">${orgName}</h1>
        <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Signature Request</p>
      </div>
      <p><strong>${requesterName}</strong> from <strong>${orgName}</strong> has shared a document with <strong>${companyName}</strong> that requires your signature.</p>
      <div style="background: #faf6f2; border: 1px solid #ead9cd; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9a9aa5;">Document</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #25314a;">${sowTitle}</p>
      </div>
      <a href="${signingUrl}" style="display: inline-block; background: #5f3e3f; color: #fff; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 8px;">Review &amp; Sign Document</a>
      <p style="margin-top: 32px; font-size: 12px; color: #9a9aa5;">This link is unique to you and expires once signed. If you weren't expecting this, please contact ${requesterName} directly.</p>
    </div>
  `
}
