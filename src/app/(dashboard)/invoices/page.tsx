export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import StatCard from '@/components/ui/StatCard'
import InvoicesClient from '@/components/invoices/InvoicesClient'
import { Invoice } from '@/lib/types'

function computeStatus(inv: Invoice): 'paid' | 'overdue' | 'open' {
  if (inv.paid_date) return 'paid'
  if (inv.due_date && new Date(inv.due_date) < new Date()) return 'overdue'
  return 'open'
}

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function avgDaysToPay(invoices: Invoice[]) {
  const paid = invoices.filter(i => i.paid_date && i.date_sent)
  if (paid.length === 0) return 0
  const total = paid.reduce((s, i) => {
    const days = (new Date(i.paid_date!).getTime() - new Date(i.date_sent!).getTime()) / (1000 * 60 * 60 * 24)
    return s + days
  }, 0)
  return Math.round(total / paid.length)
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, engagement:engagements(id, name), company:companies(id, name)')
    .order('created_at', { ascending: false })

  const rows = (invoices ?? []) as (Invoice & { engagement?: { id: string; name: string }; company?: { id: string; name: string } })[]

  const totalInvoiced = rows.reduce((s, i) => s + i.amount, 0)
  const outstanding = rows.filter(i => computeStatus(i) === 'open').reduce((s, i) => s + i.amount, 0)
  const overdue = rows.filter(i => computeStatus(i) === 'overdue').reduce((s, i) => s + i.amount, 0)
  const avgDays = avgDaysToPay(rows)

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
        Invoices
      </h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 36px' }}>
        {rows.length} invoices &middot; {rows.filter(i => computeStatus(i) === 'paid').length} paid &middot; {rows.filter(i => computeStatus(i) === 'overdue').length} overdue
      </p>
      <InvoicesClient invoices={rows} />
    </div>
  )
}

