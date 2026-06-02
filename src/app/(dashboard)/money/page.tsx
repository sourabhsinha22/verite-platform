export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import StatCard from '@/components/ui/StatCard'
import Link from 'next/link'
import BankClient from '@/components/bank/BankClient'
import DistributionsClient, { DistRowActions } from '@/components/distributions/DistributionsClient'
import ReimbursementsClient, { ReimbRowActions } from '@/components/reimbursements/ReimbursementsClient'
import ContractorsClient, { ContractorRowActions, PaymentRowActions } from '@/components/contractors/ContractorsClient'
import type { Distribution, Reimbursement, Contractor, ContractorPayment } from '@/lib/types'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TABS = [
  { id: 'bank', label: 'Bank Balance' },
  { id: 'distributions', label: 'Distributions' },
  { id: 'reimbursements', label: 'Reimbursements' },
  { id: 'contractors', label: 'Contractors' },
]

const TAB_TITLES: Record<string, string> = {
  bank: 'Bank Balance',
  distributions: 'Distributions',
  reimbursements: 'Reimbursements',
  contractors: 'Contractors (1099)',
}

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'bank' } = await searchParams
  const activeTab = TABS.find(t => t.id === tab) ? tab : 'bank'

  const supabase = await createClient()

  const tabBar = (
    <div style={{ display: 'flex', gap: 4, marginBottom: 32, background: 'var(--line-soft)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
      {TABS.map(t => (
        <Link
          key={t.id}
          href={`/money?tab=${t.id}`}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            background: activeTab === t.id ? 'var(--navy)' : 'transparent',
            color: activeTab === t.id ? '#fff' : 'var(--ink-soft)',
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // TAB: BANK BALANCE
  // ═══════════════════════════════════════════════════════════════
  if (activeTab === 'bank') {
    const { data: balanceRows } = await supabase
      .from('bank_balance')
      .select('*')
      .order('as_of_date', { ascending: false })
      .limit(1)

    const { data: revenueItems } = await supabase
      .from('revenue_items')
      .select('*')
      .not('actual_amount', 'is', null)

    const { data: distributions } = await supabase.from('distributions').select('*')
    const { data: reimbursements } = await supabase.from('reimbursements').select('*')

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

    events.sort((a, b) => a.date.localeCompare(b.date))

    const ledger: LedgerRow[] = []
    let running = balance ? balance.balance : 0
    const startDate = balance ? balance.as_of_date : null

    const relevantEvents = startDate ? events.filter(e => e.date > startDate) : events

    for (const ev of relevantEvents) {
      running += ev.amount
      ledger.push({ ...ev, running_balance: running })
    }

    const displayLedger = [...ledger].reverse()

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
        {tabBar}
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

  // ═══════════════════════════════════════════════════════════════
  // TAB: DISTRIBUTIONS
  // ═══════════════════════════════════════════════════════════════
  if (activeTab === 'distributions') {
    const { data } = await supabase
      .from('distributions')
      .select('*')
      .order('date', { ascending: false })

    const distributions: Distribution[] = data ?? []
    const totalDistributed = distributions.reduce((s, d) => s + d.amount, 0)

    const byRecipient: Record<string, number> = {}
    for (const d of distributions) {
      byRecipient[d.recipient] = (byRecipient[d.recipient] ?? 0) + d.amount
    }
    const topRecipients = Object.entries(byRecipient).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const allRecipients = Object.keys(byRecipient)
    const existingRecipients = Array.from(new Set(['Tana Whitt', 'Shannon Chema', 'Charissa Duffy', ...allRecipients]))

    const monthlyGrid: Record<string, Record<string, number>> = {}
    for (const d of distributions) {
      const month = d.date.slice(0, 7)
      if (!monthlyGrid[month]) monthlyGrid[month] = {}
      monthlyGrid[month][d.recipient] = (monthlyGrid[month][d.recipient] ?? 0) + d.amount
    }
    const months = Object.keys(monthlyGrid).sort()
    const recipients = allRecipients.length > 0 ? allRecipients : ['Tana Whitt', 'Shannon Chema', 'Charissa Duffy']

    function fmtMonthLabel(m: string) {
      return new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }

    return (
      <div>
        <style>{`.hover-row:hover { background: var(--line-soft) !important; }`}</style>
        {tabBar}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
            Distributions
          </h1>
          <DistributionsClient distributions={distributions} />
        </div>
        <p style={{ color: 'var(--ink-soft)', margin: '0 0 36px' }}>Partner distributions from company revenue</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
          <StatCard label="Total Distributed" value={fmt(totalDistributed)} accent="info" />
          {topRecipients[0] && <StatCard label={topRecipients[0][0]} value={fmt(topRecipients[0][1])} accent="warn" />}
          {topRecipients[1] && <StatCard label={topRecipients[1][0]} value={fmt(topRecipients[1][1])} accent="warn" />}
          {topRecipients[2] && <StatCard label={topRecipients[2][0]} value={fmt(topRecipients[2][1])} accent="warn" />}
        </div>

        {months.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--line-soft)' }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Monthly Grid</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>Month</th>
                    {recipients.map(r => (
                      <th key={r} style={{ textAlign: 'right', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{r}</th>
                    ))}
                    <th style={{ textAlign: 'right', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => {
                    const rowTotal = recipients.reduce((s, r) => s + (monthlyGrid[m]?.[r] ?? 0), 0)
                    return (
                      <tr key={m} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{fmtMonthLabel(m)}</td>
                        {recipients.map(r => (
                          <td key={r} style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right', color: monthlyGrid[m]?.[r] ? 'var(--ink)' : 'var(--ink-faint)' }}>
                            {monthlyGrid[m]?.[r] ? fmt(monthlyGrid[m][r]) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{fmt(rowTotal)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ borderTop: '2px solid var(--line)', background: 'var(--line-soft)' }}>
                    <td style={{ padding: '13px 16px', fontSize: 12, fontWeight: 600, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Total</td>
                    {recipients.map(r => (
                      <td key={r} style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>
                        {fmt(byRecipient[r] ?? 0)}
                      </td>
                    ))}
                    <td style={{ padding: '13px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{fmt(totalDistributed)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--line-soft)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>All Distributions</h2>
          </div>
          {distributions.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>No distributions yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                  {['Date', 'Recipient', 'Amount', 'Notes', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {distributions.map(d => (
                  <tr key={d.id} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '13px 16px', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>{fmtDate(d.date)}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500 }}>{d.recipient}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: 'var(--warn)' }}>{fmt(d.amount)}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-faint)' }}>{d.notes || '—'}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <DistRowActions distribution={d} existingRecipients={existingRecipients} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB: REIMBURSEMENTS
  // ═══════════════════════════════════════════════════════════════
  if (activeTab === 'reimbursements') {
    const { data } = await supabase
      .from('reimbursements')
      .select('*')
      .order('date', { ascending: false })

    const reimbursements: Reimbursement[] = data ?? []

    const totalOut = reimbursements.reduce((s, r) => s + (r.amount_out ?? 0), 0)
    const totalIn = reimbursements.reduce((s, r) => s + (r.amount_in ?? 0), 0)
    const pending = totalOut - totalIn

    const existingClients = Array.from(new Set(reimbursements.map(r => r.client)))

    const statusBadge = (status: Reimbursement['status']) => {
      if (status === 'received') return { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Received' }
      if (status === 'partial') return { bg: '#e8f0fc', color: '#2f5fb3', label: 'Partial' }
      return { bg: 'var(--warn-soft)', color: 'var(--warn)', label: 'Pending' }
    }

    return (
      <div>
        <style>{`.hover-row:hover { background: var(--line-soft) !important; }`}</style>
        {tabBar}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
              Reimbursements
            </h1>
            <p style={{ color: 'var(--ink-soft)', margin: '6px 0 0', fontSize: 13 }}>
              Pass-through expenses you paid on behalf of clients. Doesn&apos;t affect revenue or P&amp;L.
            </p>
          </div>
          <ReimbursementsClient reimbursements={reimbursements} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32, marginBottom: 40 }}>
          <StatCard label="Total Paid Out" value={fmt(totalOut)} accent="warn" />
          <StatCard label="Total Reimbursed" value={fmt(totalIn)} accent="green" />
          <StatCard label="Pending Recovery" value={fmt(pending)} accent={pending > 0 ? 'rose' : 'green'} />
          <StatCard label="Total Entries" value={reimbursements.length} accent="info" />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--line-soft)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>All Reimbursements</h2>
          </div>
          {reimbursements.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>No reimbursements yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                  {['Date', 'Client', 'Description', 'Paid Out', 'Reimbursed', 'Net', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reimbursements.map(r => {
                  const net = (r.amount_in ?? 0) - (r.amount_out ?? 0)
                  const badge = statusBadge(r.status)
                  const rowBg = r.status === 'pending' ? 'rgba(184,132,26,0.04)' : 'transparent'
                  return (
                    <tr key={r.id} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)', background: rowBg }}>
                      <td style={{ padding: '13px 16px', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>{fmtDate(r.date)}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500 }}>{r.client}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{r.description}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500, color: 'var(--danger)' }}>{fmt(r.amount_out ?? 0)}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500, color: (r.amount_in ?? 0) > 0 ? 'var(--success)' : 'var(--ink-faint)' }}>
                        {(r.amount_in ?? 0) > 0 ? fmt(r.amount_in) : '—'}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: net === 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {net === 0 ? '—' : fmt(net)}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <ReimbRowActions reimbursement={r} existingClients={existingClients} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB: CONTRACTORS
  // ═══════════════════════════════════════════════════════════════
  const { data: contractorData } = await supabase
    .from('contractors')
    .select('*')
    .order('name')

  const { data: paymentData } = await supabase
    .from('contractor_payments')
    .select('*')
    .order('date', { ascending: false })

  const contractors: Contractor[] = contractorData ?? []
  const payments: ContractorPayment[] = paymentData ?? []

  const currentYear = new Date().getFullYear()
  const ytdStart = `${currentYear}-01-01`

  const contractorStats = contractors.map(c => {
    const cPayments = payments.filter(p => p.contractor_id === c.id)
    const ytd = cPayments.filter(p => p.date >= ytdStart).reduce((s, p) => s + p.amount, 0)
    const allTime = cPayments.reduce((s, p) => s + p.amount, 0)
    return { ...c, ytd, allTime, needs1099: ytd >= 600 }
  })

  const totalYtd = contractorStats.reduce((s, c) => s + c.ytd, 0)
  const need1099Count = contractorStats.filter(c => c.needs1099).length
  const missingW9Count = contractors.filter(c => !c.w9_on_file).length

  const contractorMap = Object.fromEntries(contractors.map(c => [c.id, c.name]))

  return (
    <div>
      <style>{`.hover-row:hover { background: var(--line-soft) !important; }`}</style>
      {tabBar}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
            Contractors (1099)
          </h1>
          <p style={{ color: 'var(--ink-soft)', margin: '6px 0 0', fontSize: 13 }}>
            Anyone paid $600+ in a calendar year needs a 1099-NEC filed by January 31
          </p>
        </div>
        <ContractorsClient contractors={contractors} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32, marginBottom: 40 }}>
        <StatCard label="Total Contractors" value={contractors.length} accent="info" />
        <StatCard label={`YTD Paid (${currentYear})`} value={fmt(totalYtd)} accent="warn" />
        <StatCard label="Need 1099 This Year" value={need1099Count} sub="YTD ≥ $600" accent={need1099Count > 0 ? 'warn' : 'green'} />
        <StatCard label="Missing W-9" value={missingW9Count} accent={missingW9Count > 0 ? 'rose' : 'green'} />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--line-soft)' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Contractors</h2>
        </div>
        {contractors.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>No contractors yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Name', 'Role', 'W-9', `YTD (${currentYear})`, '1099 Status', 'All-Time', 'Payments', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contractorStats.map(c => {
                const payCount = payments.filter(p => p.contractor_id === c.id).length
                return (
                  <tr key={c.id} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{c.role || '—'}</td>
                    <td style={{ padding: '13px 16px' }}>
                      {c.w9_on_file
                        ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--success-soft)', color: 'var(--success)' }}>On file</span>
                        : <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--danger-soft)', color: 'var(--danger)' }}>Missing</span>
                      }
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{fmt(c.ytd)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      {c.needs1099 && (
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--warn-soft)', color: 'var(--warn)' }}>1099 needed</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{fmt(c.allTime)}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-faint)' }}>{payCount}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <ContractorRowActions contractor={c} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--line-soft)' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Payment Log</h2>
        </div>
        {payments.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>No payments logged yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Date', 'Contractor', 'Amount', 'Description', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="hover-row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <td style={{ padding: '13px 16px', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>{fmtDate(p.date)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500 }}>{contractorMap[p.contractor_id] ?? '—'}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: 'var(--warn)' }}>{fmt(p.amount)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{p.description || '—'}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <PaymentRowActions payment={p} contractors={contractors} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
