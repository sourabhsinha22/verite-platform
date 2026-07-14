import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  if (body.event !== 'invitee.created') return NextResponse.json({ ok: true, processed: false })

  const name = body.payload?.invitee?.name ?? ''
  const email = body.payload?.invitee?.email ?? ''
  const meetingType = body.payload?.event_type?.name ?? 'Discovery Call'

  if (!email) return NextResponse.json({ ok: false, error: 'No email' })

  // Find engagement by prospect_email
  const { data: eng } = await supabase.from('engagements').select('id, stage, lead, stage_history, company:companies(name)').eq('prospect_email', email).single()

  if (eng && ['prospect','engaged'].includes(eng.stage)) {
    const today = new Date().toISOString().slice(0,10)
    const updatedHistory = { ...(eng.stage_history ?? {}), qualified: today }
    await supabase.from('engagements').update({ stage: 'qualified', probability: 35, stage_history: updatedHistory }).eq('id', eng.id)

    await supabase.from('activity_log').insert({ engagement_id: eng.id, author: 'Calendly (automated)', entry_type: 'meeting', content: `Calendly: ${name} booked a ${meetingType}` })

    await supabase.from('tasks').insert({ engagement_id: eng.id, title: `Discovery call with ${name}`, task_group: 'sales', status: 'not-started', owner: eng.lead ?? '' })

    // Alert the lead
    const { data: members } = await supabase.from('team_members').select('name, email')
    const leadMember = members?.find(m => m.name === eng.lead)
    if (leadMember?.email) {
      const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const now = new Date()
      const dateStr = `${MO[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
      await sendEmail({
        to: leadMember.email,
        subject: `📅 Meeting booked: ${name} — ${(Array.isArray(eng.company) ? eng.company[0] : eng.company as {name:string}|null)?.name ?? ''}`,
        html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#25314a"><div style="border-bottom:2px solid #5f3e3f;padding-bottom:12px;margin-bottom:20px"><h2 style="margin:0">Discovery Call Booked</h2><p style="margin:4px 0 0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#5f3e3f">Calendly booking confirmed</p></div><p><strong>${name}</strong> just booked a <strong>${meetingType}</strong>.</p><p>Email: ${email}<br>Date: ${dateStr}</p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'}/pipeline" style="display:inline-block;background:#5f3e3f;color:#fff;padding:11px 22px;border-radius:4px;text-decoration:none;font-size:14px;margin-top:16px">View Pipeline →</a></div>`
      })
    }
  }

  await supabase.from('webhook_events').insert({ provider: 'calendly', event_type: body.event ?? 'unknown', payload: body, processed: true, result: eng ? 'qualified' : 'not_found' })

  return NextResponse.json({ ok: true, processed: !!eng })
}
