import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'Admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (!currentUser.orgId) {
    return NextResponse.json({ error: 'No org found' }, { status: 400 })
  }

  const { email, role } = await req.json()
  if (!email || !role) {
    return NextResponse.json({ error: 'email and role required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check for existing active invite
  const { data: existing } = await admin
    .from('org_invites')
    .select('id')
    .eq('org_id', currentUser.orgId)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  let invite
  if (existing) {
    // Reuse existing invite (resend email)
    const { data } = await admin
      .from('org_invites')
      .select('*')
      .eq('id', existing.id)
      .single()
    invite = data
  } else {
    const { data, error } = await admin
      .from('org_invites')
      .insert({
        org_id: currentUser.orgId,
        email: email.toLowerCase(),
        role,
        invited_by: currentUser.id,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invite = data
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'
  const acceptUrl = `${appUrl}/accept-invite/${invite.token}`

  const { data: org } = await admin.from('orgs').select('name, brand').eq('id', currentUser.orgId).single()
  const productName = (org?.brand as Record<string, string>)?.product_name ?? org?.name ?? 'the platform'

  await sendEmail({
    to: email,
    subject: `You're invited to ${productName}`,
    html: inviteEmailHtml({ inviterName: currentUser.name, productName, role, acceptUrl }),
  })

  return NextResponse.json({ ok: true, inviteId: invite.id })
}

function inviteEmailHtml({ inviterName, productName, role, acceptUrl }: {
  inviterName: string
  productName: string
  role: string
  acceptUrl: string
}) {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
      <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 600; margin: 0; color: #25314a;">${productName}</h1>
        <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Team Invitation</p>
      </div>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${productName}</strong> as a <strong>${role}</strong>.</p>
      <p>Click the button below to accept your invitation and set up your account. This link expires in 7 days.</p>
      <a href="${acceptUrl}" style="display: inline-block; background: #5f3e3f; color: #fff; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 8px;">Accept Invitation</a>
      <p style="margin-top: 32px; font-size: 12px; color: #9a9aa5;">If you weren't expecting this invitation, you can ignore this email.</p>
    </div>
  `
}
