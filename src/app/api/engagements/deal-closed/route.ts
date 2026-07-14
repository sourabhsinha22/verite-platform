import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST(request: Request) {
  const { engagement_id, engagement_name, company_name, contract_value, lead } = await request.json()
  const supabase = createAdminClient()
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  const dateStr = `${MO[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'

  const { data: members } = await supabase.from('team_members').select('name, email')
  const emails = (members ?? []).map(m => m.email).filter(Boolean)

  const contractStr = contract_value ? '$' + Math.round(contract_value).toLocaleString() : 'TBD'

  for (const email of emails) {
    await sendEmail({
      to: email,
      subject: `🎉 Deal closed: ${engagement_name} — ${company_name}`,
      html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#25314a"><div style="background:#2f2e4b;padding:28px 32px 24px"><h1 style="margin:0;color:#fff;font-size:26px">🎉 New Client Signed</h1><p style="margin:6px 0 0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#e3bca6">Deal Closed</p></div><div style="padding:28px 32px;background:#fff"><p style="font-size:16px;margin:0 0 20px"><strong>${engagement_name}</strong> with <strong>${company_name}</strong> is now active.</p><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:8px 0;color:#5f5f6e;width:140px">Lead Partner</td><td style="padding:8px 0;font-weight:600">${lead || '—'}</td></tr><tr><td style="padding:8px 0;color:#5f5f6e">Company</td><td style="padding:8px 0">${company_name}</td></tr><tr><td style="padding:8px 0;color:#5f5f6e">Contract Value</td><td style="padding:8px 0;font-weight:600">${contractStr}</td></tr><tr><td style="padding:8px 0;color:#5f5f6e">Signed</td><td style="padding:8px 0">${dateStr}</td></tr></table><p style="margin:20px 0;font-size:13px;color:#5f5f6e">Onboarding tasks have been created automatically in the platform.</p><a href="${appUrl}/engagements/${engagement_id}" style="display:inline-block;background:#5f3e3f;color:#fff;padding:11px 22px;border-radius:4px;text-decoration:none;font-size:14px">View Engagement →</a></div><div style="padding:16px 32px;border-top:1px solid #ead9cd;text-align:center"><p style="font-size:11px;color:#9a9aa5;margin:0">Vérité Health Collective · Automated deal notification</p></div></div>`
    })
  }

  return NextResponse.json({ ok: true })
}
