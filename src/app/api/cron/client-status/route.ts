import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function currentWeekLabel(): string {
  const now = new Date()
  return `${MO[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
}

function buildClientStatusEmail(params: {
  contactFirstName: string
  engagementName: string
  completedTasks: { title: string }[]
  openTasks: { title: string; due_date: string | null }[]
  nextAction: string
  nextInvoice: { invoice_number: string; amount: number; due_date: string | null } | null
  leadEmail: string
}): string {
  const completedRows = params.completedTasks.length > 0
    ? params.completedTasks.map(t =>
        `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #ead9cd; font-size: 13px; color: #25314a;">✓ ${t.title}</td></tr>`
      ).join('')
    : `<tr><td style="padding: 8px 12px; font-size: 13px; color: #9a9aa5; font-style: italic;">No tasks completed this week</td></tr>`

  const openRows = params.openTasks.length > 0
    ? params.openTasks.map(t =>
        `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ead9cd; font-size: 13px; color: #25314a;">${t.title}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ead9cd; font-size: 12px; color: #5f5f6e; white-space: nowrap;">${fmtDate(t.due_date)}</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="2" style="padding: 8px 12px; font-size: 13px; color: #9a9aa5; font-style: italic;">No open items</td></tr>`

  const invoiceSection = params.nextInvoice
    ? `<div style="background: #faf6f2; border: 1px solid #ead9cd; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #5f3e3f; margin-bottom: 10px;">Upcoming Invoice</div>
        <table style="width: 100%;">
          <tr>
            <td style="font-size: 13px; color: #5f5f6e;">Invoice</td>
            <td style="text-align: right; font-size: 13px; font-weight: 600; color: #25314a;">${params.nextInvoice.invoice_number}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #5f5f6e;">Amount</td>
            <td style="text-align: right; font-size: 13px; font-weight: 600; color: #25314a;">${fmtCurrency(params.nextInvoice.amount)}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #5f5f6e;">Due</td>
            <td style="text-align: right; font-size: 13px; color: #25314a;">${fmtDate(params.nextInvoice.due_date)}</td>
          </tr>
        </table>
      </div>`
    : ''

  const nextActionSection = params.nextAction
    ? `<div style="background: #faf6f2; border-left: 3px solid #5f3e3f; border-radius: 0 6px 6px 0; padding: 12px 16px; margin-bottom: 24px;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #5f3e3f; margin-bottom: 6px;">Next Steps</div>
        <p style="margin: 0; font-size: 13px; color: #25314a;">${params.nextAction}</p>
      </div>`
    : ''

  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a; background: #ffffff; padding: 40px 40px 32px;">
      <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 32px;">
        <h1 style="font-size: 28px; font-weight: 600; margin: 0; color: #25314a;">Vérité Health Collective</h1>
        <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Weekly Project Update</p>
      </div>

      <p style="font-size: 15px; color: #25314a; margin-bottom: 24px;">Hi ${params.contactFirstName},</p>
      <p style="font-size: 14px; color: #5f5f6e; margin-bottom: 32px;">Here's your project update for <strong>${params.engagementName}</strong>.</p>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #5f3e3f; margin-bottom: 10px;">Tasks Completed This Week</div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ead9cd; border-radius: 6px; overflow: hidden;">
          <tbody>${completedRows}</tbody>
        </table>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #5f3e3f; margin-bottom: 10px;">Open Items</div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ead9cd; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #f5ebe3;">
              <th style="text-align: left; padding: 8px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #5f3e3f;">Item</th>
              <th style="text-align: left; padding: 8px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #5f3e3f;">Due</th>
            </tr>
          </thead>
          <tbody>${openRows}</tbody>
        </table>
      </div>

      ${nextActionSection}
      ${invoiceSection}

      <div style="border-top: 1px solid #ead9cd; padding-top: 20px; margin-top: 32px;">
        <p style="font-size: 12px; color: #9a9aa5; margin: 0;">Questions? Reply to this email or contact your Vérité lead at <a href="mailto:${params.leadEmail}" style="color: #5f3e3f;">${params.leadEmail}</a>.</p>
      </div>
    </div>
  `
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Fetch all active engagements with status_email_enabled
  const { data: engagements, error } = await supabase
    .from('engagements')
    .select(`
      id, name, stage, lead, next_action, status_email_enabled,
      company:companies(id, name, contacts(*)),
      tasks(*),
      invoices(*),
      activity_log(*)
    `)
    .eq('stage', 'active')
    .eq('status_email_enabled', true)

  if (error) {
    console.error('client-status cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get team member emails for leads
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('name, email')

  const teamEmailMap: Record<string, string> = {}
  for (const tm of teamMembers ?? []) {
    if (tm.name && tm.email) teamEmailMap[tm.name] = tm.email
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekLabel = currentWeekLabel()

  let sent = 0
  const skipped: string[] = []

  for (const eng of engagements ?? []) {
    const companyRaw = eng.company as unknown as { id: string; name: string; contacts: { name: string; email: string; is_primary: boolean }[] }[] | { id: string; name: string; contacts: { name: string; email: string; is_primary: boolean }[] } | null
    const company = Array.isArray(companyRaw) ? (companyRaw[0] ?? null) : companyRaw
    const contacts = company?.contacts ?? []
    const primaryContact = contacts.find((c) => c.is_primary)

    if (!primaryContact?.email) {
      skipped.push(`${eng.name} — no primary contact`)
      continue
    }

    const contactFirstName = (primaryContact.name ?? '').split(' ')[0] || 'there'

    // Tasks completed in last 7 days
    const allTasks = (eng.tasks as { id: string; title: string; status: string; due_date: string | null; updated_at?: string }[]) ?? []
    const completedTasks = allTasks.filter(t => t.status === 'done')
    const openTasks = allTasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })

    // Next unpaid invoice
    const invoices = (eng.invoices as { id: string; invoice_number: string; amount: number; due_date: string | null; status: string }[]) ?? []
    const nextInvoice = invoices
      .filter(i => i.status !== 'paid')
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })[0] ?? null

    const leadEmail = teamEmailMap[eng.lead ?? ''] ?? 'team@veritehealth.com'

    const html = buildClientStatusEmail({
      contactFirstName,
      engagementName: eng.name,
      completedTasks,
      openTasks,
      nextAction: eng.next_action ?? '',
      nextInvoice,
      leadEmail,
    })

    const subject = `Your ${eng.name} update — ${weekLabel}`
    const result = await sendEmail({ to: primaryContact.email, subject, html })

    if (result.ok) {
      sent++
      // Log to activity_log
      await supabase.from('activity_log').insert({
        engagement_id: eng.id,
        entry_type: 'email',
        author: 'Automated',
        content: `Weekly status email sent to ${primaryContact.email}`,
      })
    } else {
      skipped.push(`${eng.name} — send failed: ${result.error}`)
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    total: (engagements ?? []).length,
  })
}
