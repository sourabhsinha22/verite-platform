import { NextResponse } from 'next/server'
import { verifyCronSecret, fmtDate, fmt, todayStr, inNDays } from '@/lib/cron'
import { sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = todayStr()
  const in7Days = inNDays(7)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'
  const testEmail = 'sourabhs@thesukhiproject.com'

  // Fetch real platform data for a realistic test
  const [{ data: tasks }, { data: invoices }, { data: engagements }] = await Promise.all([
    supabase.from('tasks').select('*, engagement:engagements(id, name)'),
    supabase.from('invoices').select('*, company:companies(name)').is('paid_date', null),
    supabase.from('engagements').select('id, name, lead, stage, expected_close_date, contract_value, company:companies(name)').eq('stage', 'active'),
  ])

  // Simulate Tana's digest
  const name = 'Tana Whitt'
  const firstName = 'Tana'

  const overdueTasks = (tasks ?? []).filter(t =>
    t.owner === name && t.status !== 'done' && t.due_date && t.due_date < today
  ).slice(0, 5)

  const myTasks = (tasks ?? []).filter(t =>
    t.owner === name && t.status !== 'done' && t.due_date && t.due_date >= today && t.due_date <= in7Days
  ).slice(0, 8)

  const blockedTasks = (tasks ?? []).filter(t =>
    t.owner === name && t.status === 'blocked'
  ).slice(0, 3)

  const myEngIds = new Set((engagements ?? []).filter(e => e.lead === name).map(e => e.id))
  const overdueInvoices = (invoices ?? []).filter(i =>
    i.engagement_id && myEngIds.has(i.engagement_id) && i.due_date && i.due_date < today
  ).slice(0, 4)

  const closingSoon = (engagements ?? []).filter(e =>
    e.lead === name && e.expected_close_date && e.expected_close_date <= inNDays(30) && e.expected_close_date >= today
  )

  const taskRow = (t: { title: string; engagement?: { name: string } | null; due_date?: string | null }) => `
    <tr>
      <td style="padding: 9px 12px; border-bottom: 1px solid #ead9cd; font-size: 13px;">${t.title}</td>
      <td style="padding: 9px 12px; border-bottom: 1px solid #ead9cd; font-size: 12px; color: #5f5f6e;">${(t.engagement as { name: string } | null)?.name ?? '—'}</td>
      <td style="padding: 9px 12px; border-bottom: 1px solid #ead9cd; font-size: 12px; ${t.due_date && t.due_date < today ? 'color: #a13030; font-weight: 600;' : 'color: #b8841a;'}">${fmtDate(t.due_date ?? null)}</td>
    </tr>`

  const html = `
<div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; color: #25314a; background: #faf6f2;">
  <div style="background: #2f2e4b; padding: 28px 32px 20px;">
    <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 600; margin: 0; color: #fff;">Vérité Health Collective</h1>
    <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #e3bca6; margin: 6px 0 0;">Weekly Digest — Test Email</p>
  </div>

  <div style="padding: 20px 32px 16px; background: #f5ebe3; border-bottom: 1px solid #ead9cd;">
    <p style="margin: 0; font-size: 12px; color: #5f3e3f; font-weight: 600;">TEST EMAIL — Sent to Sourabh (simulating Tana's Monday digest)</p>
  </div>

  <div style="padding: 28px 32px; background: #fff; border-bottom: 1px solid #ead9cd;">
    <p style="margin: 0 0 4px; font-size: 15px;">Good morning, ${firstName}.</p>
    <p style="margin: 0; font-size: 13px; color: #5f5f6e;">Here's your week ahead — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
  </div>

  ${overdueTasks.length > 0 ? `
  <div style="padding: 20px 32px; background: #f5e6e6; border-bottom: 1px solid #e8c5c5;">
    <h2 style="font-size: 14px; font-weight: 700; color: #a13030; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.12em;">Overdue (${overdueTasks.length})</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tbody>${overdueTasks.map(taskRow).join('')}</tbody>
    </table>
  </div>` : `
  <div style="padding: 20px 32px; background: #e8f1ea; border-bottom: 1px solid #c8dec9;">
    <p style="margin: 0; color: #2d6a3e; font-size: 14px; font-weight: 600;">No overdue tasks.</p>
  </div>`}

  ${myTasks.length > 0 ? `
  <div style="padding: 20px 32px; background: #fff; border-bottom: 1px solid #ead9cd;">
    <h2 style="font-size: 14px; font-weight: 700; color: #25314a; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.12em;">Due This Week (${myTasks.length})</h2>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #ead9cd;">
      <thead><tr style="background: #f5ebe3;">
        <th style="text-align: left; padding: 8px 12px; font-size: 10px; color: #5f3e3f; text-transform: uppercase; letter-spacing: 0.14em;">Task</th>
        <th style="text-align: left; padding: 8px 12px; font-size: 10px; color: #5f3e3f; text-transform: uppercase; letter-spacing: 0.14em;">Engagement</th>
        <th style="text-align: left; padding: 8px 12px; font-size: 10px; color: #5f3e3f; text-transform: uppercase; letter-spacing: 0.14em;">Due</th>
      </tr></thead>
      <tbody>${myTasks.map(taskRow).join('')}</tbody>
    </table>
  </div>` : `
  <div style="padding: 20px 32px; background: #fff; border-bottom: 1px solid #ead9cd;">
    <p style="margin: 0; color: #2d6a3e; font-size: 14px;">No tasks due this week.</p>
  </div>`}

  ${blockedTasks.length > 0 ? `
  <div style="padding: 20px 32px; background: #faf2dc; border-bottom: 1px solid #f0d8a0;">
    <h2 style="font-size: 14px; font-weight: 700; color: #b8841a; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.12em;">Blocked (${blockedTasks.length})</h2>
    ${blockedTasks.map(t => `<div style="font-size: 13px; color: #854F0B; padding: 4px 0;">${t.title} — <span style="color: #5f5f6e;">${(t.engagement as { name: string } | null)?.name ?? ''}</span></div>`).join('')}
  </div>` : ''}

  ${overdueInvoices.length > 0 ? `
  <div style="padding: 20px 32px; background: #fff; border-bottom: 1px solid #ead9cd;">
    <h2 style="font-size: 14px; font-weight: 700; color: #25314a; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.12em;">Overdue Invoices (${overdueInvoices.length})</h2>
    ${overdueInvoices.map(i => `
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5ebe3; font-size: 13px;">
        <span>${i.invoice_number} — ${(i.company as { name: string } | null)?.name ?? ''}</span>
        <span style="font-weight: 600; color: #a13030;">${fmt(i.amount)} · due ${fmtDate(i.due_date)}</span>
      </div>`).join('')}
  </div>` : ''}

  ${closingSoon.length > 0 ? `
  <div style="padding: 20px 32px; background: #fff; border-bottom: 1px solid #ead9cd;">
    <h2 style="font-size: 14px; font-weight: 700; color: #25314a; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.12em;">Closing Soon</h2>
    ${closingSoon.map(e => `
      <div style="padding: 8px 0; border-bottom: 1px solid #f5ebe3; font-size: 13px;">
        <strong>${e.name}</strong> — closes ${fmtDate(e.expected_close_date)}
        ${e.contract_value ? ` · ${fmt(e.contract_value)}` : ''}
      </div>`).join('')}
  </div>` : ''}

  <div style="padding: 24px 32px; text-align: center; background: #fff; border-bottom: 1px solid #ead9cd;">
    <a href="${appUrl}/dashboard" style="display: inline-block; background: #5f3e3f; color: #fff; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-size: 14px; font-family: Georgia, serif;">Open Dashboard</a>
  </div>

  <div style="padding: 16px 32px; border-top: 1px solid #ead9cd; text-align: center; background: #faf6f2;">
    <p style="font-size: 11px; color: #9a9aa5; margin: 0;">Vérité Health Collective · Weekly digest · Every Monday 8am UTC</p>
    <p style="font-size: 11px; color: #c59a88; margin: 4px 0 0;">This is a test email sent to ${testEmail}</p>
  </div>
</div>`

  const { ok, error } = await sendEmail({
    to: testEmail,
    subject: `[TEST] Weekly Digest — Tana's view — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    html,
  })

  return NextResponse.json({
    ok,
    to: testEmail,
    error: error ?? null,
    stats: {
      overdueTasks: overdueTasks.length,
      dueThisWeek: myTasks.length,
      blocked: blockedTasks.length,
      overdueInvoices: overdueInvoices.length,
      closingSoon: closingSoon.length,
    }
  })
}
