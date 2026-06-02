export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import StatCard from '@/components/ui/StatCard'
import BankClient from '@/components/bank/BankClient'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function BankPage() {
  const supabase = await createClient()

  const { data: balanceRows } = await supabase
    .from('bank_balance')
    .select('*')
    .order('as_of_date', { ascending: false })
    .limit(1)

  const { data: revenueItems } = await supabase
    .from('revenue_items')
    .select('*')
    .not('actual_amount', 'is', null)

  const { data: distributions } = await supabase
    .from('distributions')
    .select('*')

  const { data: reimbursements } = await supabase
    .from('reimbursements')
    .select('*')

  const balance = balanceRows?.[0] ?? null
  const revenues = revenueItems ?? []
  const dists = distributions ?? []
  const reimbs = reimbursements ?? []

  type LedgerRow = {
    date: string
    type: 'Revenue' | 'Distribution' | 'Reimbursement'
    description: string
    amount: number
    running_balance: number
  }

  // Build ledger
  const events: Array<{ date: string; type: LedgerRow['type']; description: string; amount: number }> = []

  for (const r of revenues) {
    if (r.month) {
      events.push({ date: r.month + '-01', type: 'Revenue', description: r.label ?? 'Revenue', amount: r.actual_amount })
    }
  }
  for (const d of dists) {
    events.push({ date: d.date, type: 'Distribution', description: `Distribution — ${d.recipient}`, amount: -(d.amount) })
  }
  for (const r of reimbs) {
    if (r.amount_out > 0) {
      events.push({ date: r.date, type: 'Reimbursement', description: `Reimbursement paid — ${r.client}`, amount: -(r.amount_out) })
    }
    if (r.amount_in > 0) {
      events.push({ date: r.date, type: 'Reimbursement', description: `Reimbursement received — ${r.client}`, amount: r.amount_in })
    }
  }

  // Sort chronologically
  events.sort((a, b) => a.date.localeCompare(b.date))

  const ledger: LedgerRow[] = []
  let running = balance ? balance.balance : 0
  const startDate = balance ? balance.as_of_date : null

  // Only include events after the start date
  const relevantEvents = startDate
    ? events.filter(e => e.date > startDate)
    : events

  for (const ev of relevantEvents) {
    running += ev.amount
    ledger.push({ ...ev, running_balance: running })
  }

  // Sort newest first for display
  const displayLedger = [...ledger].reverse()

  // Stats
  const currentBalance = ledger.length > 0 ? ledger[ledger.length - 1].running_balance : (balance?.balance ?? 0)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDayStr = thirtyDaysAgo.toISOString().slice(0, 10)
  const oldEntries = ledger.filter(e => e.date <= thirtyDayStr)
  const balanceThirtyAgo = oldEntries.length > 0 ? oldEntries[oldEntries.length - 1].running_balance : (balance?.balance ?? 0)
  const thirtyDayChange = currentBalance - balanceThirtyAgo

  const totalIn = revenues.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
  const totalOut = dists.reduce((s, d) => s + d.amount, 0) + reimbs.reduce((s, r) => s + (r.amount_out ?? 0), 0)

  return (
    <div>
      <style>{`.hover-row:hover { background: var(--line-soft) !important; }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
          Bank Balance
        </h1>
        <BankClient hasBalance={!!balance} balanceId={balance?.id} />
      </div>
      {balance && (
        <p style={{ color: 'var(--ink-faint)', margin: '0 0 32px', fontSize: 13 }}>
          Anchored at {fmt(balance.balance)} on {fmtDate(balance.as_of_date)}
          {balance.notes ? ` — ${balance.notes}` : ''}
        </p>
      )}

      {!balance ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', marginTop: 32 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink-soft)', marginBottom: 12 }}>
            No starting balance set
          </div>
          <p style={{ color: 'var(--ink-faint)', marginBottom: 24 }}>
            Set your starting balance to anchor the ledger and track running totals.
          </p>
          <BankClient hasBalance={false} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
            <StatCard label="Current Balance" value={fmt(currentBalance)} sub="as of today" accent={currentBalance >= 0 ? 'green' : 'rose'} />
            <StatCard label="30-Day Change" value={(thirtyDayChange >= 0 ? '+' : '') + fmt(thirtyDayChange)} accent={thirtyDayChange >= 0 ? 'green' : 'rose'} />
            <StatCard label="Total In" value={fmt(totalIn)} sub="revenue actuals" accent="info" />
            <StatCard label="Total Out" value={fmt(totalOut)} sub="distributions + reimbursements" accent="warn" />
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--line-soft)' }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Ledger</h2>
            </div>
            {displayLedger.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
                No transactions recorded yet.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                    {['Date', 'Type', 'Description', 'Amount', 'Running Balance'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayLedger.map((row, i) => (
                    <tr key={i} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '13px 16px', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>{fmtDate(row.date)}</td>
                      <td style={{ padding: '13px 16px' }}>
                        {row.type === 'Revenue' && (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--success-soft)', color: 'var(--success)' }}>Revenue</span>
                        )}
                        {row.type === 'Distribution' && (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--warn-soft)', color: 'var(--warn)' }}>Distribution</span>
                        )}
                        {row.type === 'Reimbursement' && (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', background: '#e8f0fc', color: '#2f5fb3' }}>Reimbursement</span>
                        )}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink)' }}>{row.description}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: row.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {row.amount >= 0 ? '+' : ''}{fmt(row.amount)}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: row.running_balance >= 0 ? 'var(--navy)' : 'var(--danger)' }}>
                        {fmt(row.running_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
