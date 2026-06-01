import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, invoiceOverdueEmail, taskDueTomorrowEmail, newEngagementEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, payload } = body as {
    type: 'invoice_overdue' | 'tasks_due' | 'new_engagement'
    payload: Record<string, unknown>
  }

  if (!type || !payload) {
    return NextResponse.json({ error: 'Missing type or payload' }, { status: 400 })
  }

  if (type === 'invoice_overdue') {
    const { invoiceId } = payload as { invoiceId: string }
    const supabase = await createClient()

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, engagement:engagements(id, name), company:companies(id, name, contacts(id, name, email, is_primary))')
      .eq('id', invoiceId)
      .single()

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const inv = invoice as typeof invoice & {
      engagement?: { id: string; name: string }
      company?: { id: string; name: string; contacts?: { id: string; name: string; email: string; is_primary: boolean }[] }
    }

    // Find recipient email: primary contact or lead's email
    const primaryContact = inv.company?.contacts?.find((c: { id: string; name: string; email: string; is_primary: boolean }) => c.is_primary) ?? inv.company?.contacts?.[0]
    let recipientEmail = primaryContact?.email

    if (!recipientEmail && inv.engagement) {
      // Try to find lead email from team_members
      const { data: lead } = await supabase
        .from('team_members')
        .select('email')
        .eq('name', (inv as Record<string, unknown> & { lead?: string }).lead ?? '')
        .single()
      recipientEmail = lead?.email
    }

    if (!recipientEmail) {
      return NextResponse.json({ error: 'No recipient email found' }, { status: 422 })
    }

    const fmtDate = (d: string | null) => d
      ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—'
    const fmtMoney = (v: number | null) => v != null ? `$${Math.round(v).toLocaleString()}` : '—'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'

    const result = await sendEmail({
      to: recipientEmail,
      subject: `Payment Reminder: Invoice ${inv.invoice_number || invoiceId.slice(0, 8).toUpperCase()} is overdue`,
      html: invoiceOverdueEmail({
        clientName: inv.company?.name ?? 'Valued Client',
        invoiceNumber: inv.invoice_number || `INV-${invoiceId.slice(0, 8).toUpperCase()}`,
        amount: fmtMoney(inv.amount),
        dueDate: fmtDate(inv.due_date),
        invoiceUrl: `${appUrl}/pay/${invoiceId}`,
      }),
    })

    return NextResponse.json(result)
  }

  if (type === 'tasks_due') {
    const { ownerEmail, ownerName, tasks } = payload as {
      ownerEmail: string
      ownerName: string
      tasks: { title: string; engagement: string; dueDate: string }[]
    }

    const result = await sendEmail({
      to: ownerEmail,
      subject: `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} due tomorrow`,
      html: taskDueTomorrowEmail({
        recipientName: ownerName,
        tasks,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'}/tasks`,
      }),
    })

    return NextResponse.json(result)
  }

  if (type === 'new_engagement') {
    const { leadEmail, leadName, engagementName, clientName, engagementId } = payload as {
      leadEmail: string
      leadName: string
      engagementName: string
      clientName: string
      engagementId: string
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'

    const result = await sendEmail({
      to: leadEmail,
      subject: `New Engagement Assigned: ${engagementName}`,
      html: newEngagementEmail({
        leadName,
        engagementName,
        clientName,
        engagementUrl: `${appUrl}/engagements/${engagementId}`,
      }),
    })

    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
}
