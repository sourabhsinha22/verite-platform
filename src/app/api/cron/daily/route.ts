import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, invoiceOverdueEmail } from '@/lib/email'
import { verifyCronSecret, fmtDate, fmt, addMonths, todayStr, inNDays, alreadyNotified, logNotification } from '@/lib/cron'
import { computeHealth } from '@/lib/types'

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = todayStr()
  const results: string[] = []
  let totalActions = 0

  // ─────────────────────────────────────────────────────────────────────
  // 1. GENERATE RECURRING INVOICES
  // ─────────────────────────────────────────────────────────────────────
  const { data: recurringTemplates } = await supabase
    .from('invoices')
    .select('*, engagement:engagements(id, name), company:companies(id, name)')
    .eq('is_recurring', true)
    .lte('next_billing_date', today)
    .or('recurring_end_date.is.null,recurring_end_date.gte.' + today)

  for (const template of recurringTemplates ?? []) {
    // Compute next invoice number: append sequence
    const invoiceNumber = `${template.invoice_number.replace(/-\d+$/, '')}-${new Date().toISOString().slice(0, 7)}`
    const dueDate = addMonths(today, template.billing_frequency === 'monthly' ? 0 : template.billing_frequency === 'quarterly' ? 0 : 0)

    // Calculate due date based on payment terms
    const sentDate = today
    let dueInDays = 30
    if (template.notes?.includes('Net 15')) dueInDays = 15
    if (template.notes?.includes('Net 30')) dueInDays = 30

    const dueDateStr = new Date(Date.now() + dueInDays * 86400000).toISOString().slice(0, 10)

    await supabase.from('invoices').insert({
      engagement_id: template.engagement_id,
      company_id: template.company_id,
      invoice_number: invoiceNumber,
      amount: template.amount,
      date_sent: sentDate,
      due_date: dueDateStr,
      status: 'sent',
      notes: `Auto-generated recurring invoice (from ${template.invoice_number})`,
      is_recurring: false,
      generated_from_id: template.id,
    })

    // Advance the template's next_billing_date
    const nextDate = addMonths(
      template.next_billing_date,
      template.billing_frequency === 'monthly' ? 1 : template.billing_frequency === 'quarterly' ? 3 : 12
    )
    await supabase.from('invoices').update({ next_billing_date: nextDate }).eq('id', template.id)

    results.push(`Generated invoice ${invoiceNumber} for ${template.company?.name ?? 'unknown'} ($${template.amount})`)
    totalActions++
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2. INVOICE OVERDUE ALERTS
  // ─────────────────────────────────────────────────────────────────────
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('*, engagement:engagements(id, name, lead), company:companies(id, name)')
    .is('paid_date', null)
    .lt('due_date', today)

  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('name, email')

  const memberByName = Object.fromEntries((teamMembers ?? []).map(m => [m.name, m.email]))

  for (const inv of overdueInvoices ?? []) {
    const lead = inv.engagement?.lead
    if (!lead || !memberByName[lead]) continue

    const recipientEmail = memberByName[lead]
    const alreadySent = await alreadyNotified(supabase, recipientEmail, 'invoice_overdue', inv.id, 24)
    if (alreadySent) continue

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'
    const html = invoiceOverdueEmail({
      clientName: inv.company?.name ?? 'Client',
      invoiceNumber: inv.invoice_number,
      amount: fmt(inv.amount),
      dueDate: fmtDate(inv.due_date),
      invoiceUrl: `${appUrl}/pay/${inv.id}`,
    })

    const { ok } = await sendEmail({
      to: recipientEmail,
      subject: `Overdue Invoice: ${inv.invoice_number} — ${inv.company?.name ?? ''} (${fmt(inv.amount)})`,
      html,
    })

    if (ok) {
      await logNotification(supabase, recipientEmail, 'invoice_overdue', inv.id)
      results.push(`Overdue alert sent to ${lead} for invoice ${inv.invoice_number}`)
      totalActions++
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3. SOW EXPIRY ALERTS (30 days out)
  // ─────────────────────────────────────────────────────────────────────
  const in30Days = inNDays(30)
  const { data: expiringEngagements } = await supabase
    .from('engagements')
    .select('id, name, lead, end_date, company:companies(name)')
    .eq('stage', 'active')
    .not('end_date', 'is', null)
    .lte('end_date', in30Days)
    .gte('end_date', today)

  for (const eng of expiringEngagements ?? []) {
    const lead = eng.lead
    if (!lead || !memberByName[lead]) continue

    const recipientEmail = memberByName[lead]
    const alreadySent = await alreadyNotified(supabase, recipientEmail, 'sow_expiry', eng.id, 48)
    if (alreadySent) continue

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'
    const daysLeft = Math.round((new Date(eng.end_date).getTime() - Date.now()) / 86400000)

    const html = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
        <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="font-size: 28px; font-weight: 600; margin: 0;">Vérité Health Collective</h1>
          <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Engagement Alert</p>
        </div>
        <p>Hi ${lead.split(' ')[0]},</p>
        <p><strong>${eng.name}</strong> with <strong>${(eng.company as unknown as { name: string } | null)?.name ?? 'your client'}</strong> ends in <strong>${daysLeft} days</strong> (${fmtDate(eng.end_date)}).</p>
        <p>Time to start a renewal conversation or formally close out this engagement.</p>
        <a href="${appUrl}/engagements/${eng.id}" style="display: inline-block; background: #5f3e3f; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 16px;">View Engagement</a>
        <p style="margin-top: 32px; font-size: 12px; color: #9a9aa5;">This is an automated reminder from your Vérité platform.</p>
      </div>`

    const { ok } = await sendEmail({
      to: recipientEmail,
      subject: `Engagement ending in ${daysLeft} days: ${eng.name}`,
      html,
    })

    if (ok) {
      await logNotification(supabase, recipientEmail, 'sow_expiry', eng.id)
      results.push(`SOW expiry alert sent to ${lead} — "${eng.name}" ends in ${daysLeft} days`)
      totalActions++
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. STALE ENGAGEMENT ALERTS (no activity in 14 days)
  // ─────────────────────────────────────────────────────────────────────
  const staleCutoff = new Date(Date.now() - 14 * 86400000).toISOString()

  const { data: activeEngs } = await supabase
    .from('engagements')
    .select('id, name, lead, company:companies(name)')
    .eq('stage', 'active')

  for (const eng of activeEngs ?? []) {
    const { data: recentActivity } = await supabase
      .from('activity_log')
      .select('id')
      .eq('engagement_id', eng.id)
      .gte('created_at', staleCutoff)
      .limit(1)

    if ((recentActivity?.length ?? 0) > 0) continue

    const lead = eng.lead
    if (!lead || !memberByName[lead]) continue

    const recipientEmail = memberByName[lead]
    const alreadySent = await alreadyNotified(supabase, recipientEmail, 'stale_engagement', eng.id, 72)
    if (alreadySent) continue

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'
    const html = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
        <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="font-size: 28px; font-weight: 600; margin: 0;">Vérité Health Collective</h1>
          <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Engagement Reminder</p>
        </div>
        <p>Hi ${lead.split(' ')[0]},</p>
        <p>No activity has been logged for <strong>${eng.name}</strong> in the last 14 days.</p>
        <p>If this engagement is still active, add a note to keep the record current.</p>
        <a href="${appUrl}/engagements/${eng.id}" style="display: inline-block; background: #5f3e3f; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 16px;">View Engagement</a>
      </div>`

    const { ok } = await sendEmail({
      to: recipientEmail,
      subject: `No activity logged: ${eng.name} (14 days)`,
      html,
    })

    if (ok) {
      await logNotification(supabase, recipientEmail, 'stale_engagement', eng.id)
      results.push(`Stale alert sent to ${lead} — "${eng.name}"`)
      totalActions++
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 5. HEALTH SCORE RECALCULATION
  // ─────────────────────────────────────────────────────────────────────
  const { data: healthEngs } = await supabase
    .from('engagements')
    .select('id, end_date')
    .eq('stage', 'active')

  let healthUpdated = 0
  for (const eng of healthEngs ?? []) {
    // 1. Count blocked tasks
    const { count: blockedCount } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('engagement_id', eng.id)
      .eq('status', 'blocked')

    // 2. Count overdue tasks
    const { count: overdueCount } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('engagement_id', eng.id)
      .neq('status', 'done')
      .lt('due_date', today)

    // 3. Days since last activity_log entry
    const { data: lastActivity } = await supabase
      .from('activity_log')
      .select('created_at')
      .eq('engagement_id', eng.id)
      .order('created_at', { ascending: false })
      .limit(1)

    let daysSinceActivity: number | null = null
    if (lastActivity && lastActivity.length > 0) {
      daysSinceActivity = Math.floor((Date.now() - new Date(lastActivity[0].created_at).getTime()) / 86400000)
    }

    // 4. Max overdue invoice aging
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('due_date')
      .eq('engagement_id', eng.id)
      .is('paid_date', null)
      .lt('due_date', today)

    let overdueInvoiceAging = 0
    for (const inv of overdueInvoices ?? []) {
      const aging = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
      if (aging > overdueInvoiceAging) overdueInvoiceAging = aging
    }

    // 5. SOW expiry days
    let sowExpiryDays: number | null = null
    if (eng.end_date) {
      sowExpiryDays = Math.floor((new Date(eng.end_date).getTime() - Date.now()) / 86400000)
    }

    // 6. Compute health
    const health = computeHealth({
      blockedTasks: blockedCount ?? 0,
      overdueTasks: overdueCount ?? 0,
      daysSinceActivity,
      overdueInvoiceAging,
      sowExpiryDays,
    })

    // 7. Update engagement health
    await supabase.from('engagements').update({ health }).eq('id', eng.id)
    healthUpdated++
  }

  results.push(`Health updated for ${healthUpdated} engagements`)

  // Log the run
  await supabase.from('cron_log').insert({
    job: 'daily',
    status: 'ok',
    message: results.join('; ') || 'Nothing to do',
    actions: totalActions,
  })

  return NextResponse.json({ ok: true, actions: totalActions, results })
}
