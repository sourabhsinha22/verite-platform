import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}
function toCSV(headers: string[], rows: string[][]): string {
  return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
}
const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(d: string | null) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${MO[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'invoices'
  const supabase = createAdminClient()

  if (type === 'invoices') {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number, amount, status, date_sent, due_date, paid_date, notes, company:companies(name), engagement:engagements(name)')
      .order('date_sent', { ascending: false })
    const headers = ['Invoice #', 'Company', 'Engagement', 'Amount', 'Status', 'Date Sent', 'Due Date', 'Paid Date', 'Notes']
    const rows = (data ?? []).map(r => {
      const co = Array.isArray(r.company) ? (r.company as {name:string}[])[0] : r.company as {name:string}|null
      const eng = Array.isArray(r.engagement) ? (r.engagement as {name:string}[])[0] : r.engagement as {name:string}|null
      return [r.invoice_number, co?.name ?? '', eng?.name ?? '', String(r.amount ?? ''), r.status ?? '', fmtDate(r.date_sent), fmtDate(r.due_date), fmtDate(r.paid_date), r.notes ?? '']
    })
    return new Response(toCSV(headers, rows), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="invoices-export.csv"' },
    })
  }

  if (type === 'engagements') {
    const { data } = await supabase
      .from('engagements')
      .select('name, stage, lead, contract_value, start_date, expected_close_date, engagement_type, company:companies(name)')
      .order('created_at', { ascending: false })
    const headers = ['Name', 'Company', 'Type', 'Stage', 'Lead', 'Contract Value', 'Start Date', 'Expected Close']
    const rows = (data ?? []).map(r => {
      const co = Array.isArray(r.company) ? (r.company as {name:string}[])[0] : r.company as {name:string}|null
      return [r.name, co?.name ?? '', r.engagement_type ?? '', r.stage ?? '', r.lead ?? '', String(r.contract_value ?? ''), fmtDate(r.start_date), fmtDate(r.expected_close_date)]
    })
    return new Response(toCSV(headers, rows), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="engagements-export.csv"' },
    })
  }

  if (type === 'tasks') {
    const { data } = await supabase
      .from('tasks')
      .select('title, status, priority, due_date, owner, engagement:engagements(name)')
      .order('due_date', { ascending: true, nullsFirst: false })
    const headers = ['Title', 'Engagement', 'Owner', 'Status', 'Priority', 'Due Date']
    const rows = (data ?? []).map(r => {
      const eng = Array.isArray(r.engagement) ? (r.engagement as {name:string}[])[0] : r.engagement as {name:string}|null
      return [r.title, eng?.name ?? '', r.owner ?? '', r.status ?? '', r.priority ?? '', fmtDate(r.due_date)]
    })
    return new Response(toCSV(headers, rows), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="tasks-export.csv"' },
    })
  }

  return new Response('Unknown type', { status: 400 })
}
