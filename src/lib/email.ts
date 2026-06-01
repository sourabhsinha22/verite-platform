// Resend email client
// Install: npm install resend
// Set env var: RESEND_API_KEY=re_...

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'notifications@veritehealth.com'
const FROM_NAME = 'Vérité Health Collective'

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email not sent:', subject)
    return { ok: false, error: 'No API key' }
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html }),
  })
  const data = await resp.json()
  return { ok: resp.ok, data, error: resp.ok ? null : data.message }
}

export function invoiceOverdueEmail(params: {
  clientName: string
  invoiceNumber: string
  amount: string
  dueDate: string
  invoiceUrl: string
}) {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
      <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 600; margin: 0; color: #25314a;">Vérité Health Collective</h1>
        <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Payment Reminder</p>
      </div>
      <p>Dear ${params.clientName},</p>
      <p>Invoice <strong>${params.invoiceNumber}</strong> for <strong>${params.amount}</strong> was due on <strong>${params.dueDate}</strong> and remains outstanding.</p>
      <div style="background: #faf6f2; border: 1px solid #ead9cd; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%;">
          <tr><td style="color: #5f5f6e; font-size: 13px;">Invoice</td><td style="text-align: right; font-weight: 600;">${params.invoiceNumber}</td></tr>
          <tr><td style="color: #5f5f6e; font-size: 13px;">Amount Due</td><td style="text-align: right; font-weight: 600; color: #a13030;">${params.amount}</td></tr>
          <tr><td style="color: #5f5f6e; font-size: 13px;">Due Date</td><td style="text-align: right;">${params.dueDate}</td></tr>
        </table>
      </div>
      <a href="${params.invoiceUrl}" style="display: inline-block; background: #5f3e3f; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-size: 14px;">View &amp; Pay Invoice</a>
      <p style="margin-top: 32px; font-size: 12px; color: #9a9aa5;">Questions? Reply to this email or contact your Vérité account manager.</p>
    </div>
  `
}

export function taskDueTomorrowEmail(params: {
  recipientName: string
  tasks: { title: string; engagement: string; dueDate: string }[]
  dashboardUrl: string
}) {
  const taskRows = params.tasks.map(t =>
    `<tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #ead9cd; font-size: 13px;">${t.title}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #ead9cd; font-size: 12px; color: #5f5f6e;">${t.engagement}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #ead9cd; font-size: 12px; color: #b8841a; font-weight: 600;">${t.dueDate}</td>
    </tr>`
  ).join('')
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
      <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 600; margin: 0;">Vérité Health Collective</h1>
        <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">Task Reminder</p>
      </div>
      <p>Hi ${params.recipientName},</p>
      <p>You have <strong>${params.tasks.length} task${params.tasks.length > 1 ? 's' : ''} due tomorrow</strong>:</p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #ead9cd; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f5ebe3;">
            <th style="text-align: left; padding: 10px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #5f3e3f;">Task</th>
            <th style="text-align: left; padding: 10px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #5f3e3f;">Engagement</th>
            <th style="text-align: left; padding: 10px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #5f3e3f;">Due</th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
      <a href="${params.dashboardUrl}" style="display: inline-block; background: #5f3e3f; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 24px;">View Dashboard</a>
    </div>
  `
}

export function newEngagementEmail(params: {
  leadName: string
  engagementName: string
  clientName: string
  engagementUrl: string
}) {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #25314a;">
      <div style="border-bottom: 2px solid #5f3e3f; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 600; margin: 0;">Vérité Health Collective</h1>
        <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #5f3e3f; margin: 4px 0 0;">New Engagement</p>
      </div>
      <p>Hi ${params.leadName},</p>
      <p>A new engagement has been assigned to you: <strong>${params.engagementName}</strong> with <strong>${params.clientName}</strong>.</p>
      <a href="${params.engagementUrl}" style="display: inline-block; background: #5f3e3f; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 16px;">View Engagement</a>
    </div>
  `
}
