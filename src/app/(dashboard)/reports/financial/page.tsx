export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import ReportNav from '@/components/reports/ReportNav'
import PrintButton from '@/components/reports/PrintButton'
import PeriodSelector from '@/components/reports/PeriodSelector'
import { EXPENSE_CATEGORIES } from '@/lib/types'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function fmtMonthKey(month: string): string {
  // month format: YYYY-MM
  const parts = month.split('-')
  if (parts.length < 2) return month
  const y = parts[0]
  const m = parseInt(parts[1], 10) - 1
  return `${MO[m]} ${y}`
}

function fmtCurrency(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}

function fmtPct(n: number): string {
  return Math.round(n) + '%'
}

function periodLabel(period: string): string {
  const labels: Record<string, string> = {
    mtd: 'Month to Date',
    qtd: 'Quarter to Date',
    ytd: 'Year to Date',
    all: 'All Time',
  }
  return labels[period] ?? 'Year to Date'
}

interface RevenueItemRow {
  month: string | null
  forecast_amount: number
  actual_amount: number | null
  label: string | null
}

interface ExpenseRow {
  month: string
  category: string
  forecast: number
  actual: number | null
}

interface DistributionRow {
  recipient: string
  amount: number
  date: string
  notes: string | null
}

interface BankRow {
  balance: number
  as_of_date: string
  notes: string | null
}

interface InvoiceRow {
  amount: number
  paid_date: string | null
  date_sent: string | null
  status: string
  company: { name: string } | null
}

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period = 'ytd' } = await searchParams
  const supabase = await createClient()

  const [revenueRes, expensesRes, distributionsRes, bankRes, invoicesRes] = await Promise.all([
    supabase.from('revenue_items').select('month, forecast_amount, actual_amount, label').order('month'),
    supabase.from('expenses').select('month, category, forecast, actual').order('month'),
    supabase.from('distributions').select('recipient, amount, date, notes').order('date', { ascending: false }),
    supabase.from('bank_balance').select('*').order('as_of_date', { ascending: false }).limit(1),
    supabase.from('invoices').select('amount, paid_date, date_sent, status, company:companies(name)').order('date_sent'),
  ])

  const allRevenue = (revenueRes.data ?? []) as unknown as RevenueItemRow[]
  const allExpenses = (expensesRes.data ?? []) as unknown as ExpenseRow[]
  const allDistributions = (distributionsRes.data ?? []) as unknown as DistributionRow[]
  const bankBalance = ((bankRes.data ?? []) as unknown as BankRow[])[0] ?? null
  const allInvoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[]

  // ── Period start date ─────────────────────────────────────────────────────────
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() // 0-indexed

  function getStartDate(): Date | null {
    if (period === 'mtd') return new Date(nowYear, nowMonth, 1)
    if (period === 'qtd') {
      const q = Math.floor(nowMonth / 3)
      return new Date(nowYear, q * 3, 1)
    }
    if (period === 'ytd') return new Date(nowYear, 0, 1)
    return null // all
  }

  const startDate = getStartDate()

  function inPeriod(dateStr: string | null): boolean {
    if (!dateStr) return false
    if (!startDate) return true
    return new Date(dateStr) >= startDate
  }

  function inPeriodMonth(monthStr: string | null): boolean {
    if (!monthStr) return false
    if (!startDate) return true
    // month is YYYY-MM, compare as string (works for same year; use Date for safety)
    const parts = monthStr.split('-')
    if (parts.length < 2) return false
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1)
    return d >= startDate
  }

  // ── Filter data ───────────────────────────────────────────────────────────────
  const revenue = allRevenue.filter(r => inPeriodMonth(r.month))
  const expenses = allExpenses.filter(e => inPeriodMonth(e.month))
  const distributions = allDistributions.filter(d => inPeriod(d.date))
  const invoices = allInvoices.filter(inv => inPeriod(inv.date_sent))

  // ── Revenue stats ─────────────────────────────────────────────────────────────
  const totalForecast = revenue.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
  const totalActual = revenue.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
  const outstandingInvoices = invoices.filter(inv => !inv.paid_date && inv.status !== 'paid')
  const totalOutstanding = outstandingInvoices.reduce((s, inv) => s + (inv.amount ?? 0), 0)
  const collectionRate = totalForecast > 0 ? Math.round((totalActual / totalForecast) * 100) : 0

  // ── P&L calculation ───────────────────────────────────────────────────────────
  type ExpCatKey = keyof typeof EXPENSE_CATEGORIES
  function catType(category: string): 'cogs' | 'opex' | null {
    // Normalize em-dash variants
    const normalized = category.replace(/ - /g, ' — ')
    return (EXPENSE_CATEGORIES[normalized as ExpCatKey] as 'cogs' | 'opex') ?? null
  }

  const cogsActual = expenses
    .filter(e => catType(e.category) === 'cogs')
    .reduce((s, e) => s + (e.actual ?? e.forecast ?? 0), 0)

  const opexActual = expenses
    .filter(e => catType(e.category) === 'opex')
    .reduce((s, e) => s + (e.actual ?? e.forecast ?? 0), 0)

  const grossProfit = totalActual - cogsActual
  const grossMarginPct = totalActual > 0 ? (grossProfit / totalActual) * 100 : 0
  const netIncome = grossProfit - opexActual
  const netMarginPct = totalActual > 0 ? (netIncome / totalActual) * 100 : 0

  // OpEx by category
  const opexByCategory: Record<string, number> = {}
  for (const e of expenses) {
    if (catType(e.category) === 'opex') {
      const label = e.category.replace(/ - /g, ' — ')
      opexByCategory[label] = (opexByCategory[label] ?? 0) + (e.actual ?? e.forecast ?? 0)
    }
  }

  // ── Revenue by month ──────────────────────────────────────────────────────────
  const revenueByMonth: Record<string, { forecast: number; actual: number }> = {}
  for (const r of revenue) {
    if (!r.month) continue
    if (!revenueByMonth[r.month]) revenueByMonth[r.month] = { forecast: 0, actual: 0 }
    revenueByMonth[r.month].forecast += r.forecast_amount ?? 0
    revenueByMonth[r.month].actual += r.actual_amount ?? 0
  }
  const monthKeys = Object.keys(revenueByMonth).sort()

  // ── Totals ────────────────────────────────────────────────────────────────────
  const distTotal = distributions.reduce((s, d) => s + (d.amount ?? 0), 0)

  const pLabel = periodLabel(period)
  const dateLabel = `${MO[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-letterhead { display: block !important; }
          aside, nav { display: none !important; }
          main { margin-left: 0 !important; padding: 24px !important; }
          body { background: white !important; }
          .fin-section { break-inside: avoid; }
        }
      `}</style>

      {/* ── Print-only letterhead ───────────────────────────────────────────────── */}
      <div className="print-letterhead" style={{ display: 'none', marginBottom: 28, paddingBottom: 14, borderBottom: '2px solid #5f3e3f' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600, color: '#25314a' }}>
          Vérité Health Collective — Financial Report — {pLabel}
        </div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Generated: {dateLabel}</div>
      </div>

      <div style={{ maxWidth: 900 }}>

        {/* ── Screen header ────────────────────────────────────────────────────── */}
        <div className="no-print" style={{ marginBottom: 4 }}>
          <ReportNav active="financial" />
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: 20, flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 600,
              color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px', marginBottom: 6,
            }}>
              Financial Report
            </h1>
            <p style={{ color: 'var(--ink-soft)', margin: 0, fontSize: 13 }}>
              {pLabel} · Generated {dateLabel}
            </p>
          </div>
          <div className="no-print" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <PeriodSelector current={period} />
            <PrintButton />
          </div>
        </div>

        {/* ── Section 1: Revenue Summary ──────────────────────────────────────── */}
        <div className="fin-section" style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 14 }}>
            Revenue Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Forecast', value: fmtCurrency(totalForecast), color: 'var(--navy)' },
              { label: 'Total Received', value: fmtCurrency(totalActual), color: 'var(--success)' },
              { label: 'Outstanding', value: fmtCurrency(totalOutstanding), color: totalOutstanding > 0 ? 'var(--warn)' : 'var(--ink)' },
              { label: 'Collection Rate', value: fmtPct(collectionRate), color: collectionRate >= 80 ? 'var(--success)' : collectionRate >= 50 ? 'var(--warn)' : 'var(--danger)' },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '18px 20px',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, fontFamily: 'var(--serif)' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: Revenue by Month ─────────────────────────────────────── */}
        {monthKeys.length > 0 && (
          <div className="fin-section" style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 14 }}>
              Revenue by Month
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)' }}>
                    {['Month', 'Forecast', 'Actual', 'Variance', 'Status'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: h === 'Month' ? 'left' : 'right',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: 'var(--wine)',
                        borderBottom: '1px solid var(--line)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthKeys.map((mk, i) => {
                    const row = revenueByMonth[mk]
                    const variance = row.actual - row.forecast
                    const hasActual = row.actual > 0
                    return (
                      <tr key={mk} style={{ borderBottom: i < monthKeys.length - 1 ? '1px solid var(--line-soft)' : undefined }}>
                        <td style={{ padding: '10px 16px', color: 'var(--ink)', fontWeight: 500 }}>{fmtMonthKey(mk)}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--ink-soft)' }}>{fmtCurrency(row.forecast)}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--ink)', fontWeight: 500 }}>{fmtCurrency(row.actual)}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', color: variance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                          {variance >= 0 ? '+' : ''}{fmtCurrency(variance)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                            background: hasActual ? 'var(--success-soft)' : 'var(--line-soft)',
                            color: hasActual ? 'var(--success)' : 'var(--ink-faint)',
                            letterSpacing: '0.04em',
                          }}>
                            {hasActual ? 'Received' : 'Forecast'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr style={{ background: 'var(--navy)' }}>
                    <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 700 }}>Total</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>{fmtCurrency(totalForecast)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#fff', fontWeight: 700 }}>{fmtCurrency(totalActual)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: totalActual - totalForecast >= 0 ? '#a8f0a8' : '#ffb3b3', fontWeight: 600 }}>
                      {totalActual - totalForecast >= 0 ? '+' : ''}{fmtCurrency(totalActual - totalForecast)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>
                      {fmtPct(collectionRate)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Section 3: P&L Summary ──────────────────────────────────────────── */}
        <div className="fin-section" style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 14 }}>
            P&amp;L Summary
          </div>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '20px 24px',
            fontFamily: 'var(--mono, monospace)',
            fontSize: 13,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--line-soft)', marginBottom: 8 }}>
              <span style={{ color: 'var(--ink)' }}>Revenue</span>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtCurrency(totalActual)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--ink-soft)' }}>Less: COGS</span>
              <span style={{ color: 'var(--ink-soft)' }}>({fmtCurrency(cogsActual)})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--line-soft)', marginBottom: 8, fontWeight: 600 }}>
              <span style={{ color: 'var(--navy)' }}>Gross Profit</span>
              <span style={{ color: grossProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {fmtCurrency(grossProfit)} ({fmtPct(grossMarginPct)})
              </span>
            </div>

            {/* OpEx lines */}
            {Object.entries(opexByCategory).map(([cat, amt]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--ink-soft)' }}>{cat}</span>
                <span style={{ color: 'var(--ink-soft)' }}>({fmtCurrency(amt)})</span>
              </div>
            ))}
            {opexActual > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, paddingTop: 4, borderTop: '1px dashed var(--line-soft)' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Less: Total OpEx</span>
                <span style={{ color: 'var(--ink-soft)' }}>({fmtCurrency(opexActual)})</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line-soft)', marginTop: 4, fontWeight: 700, fontSize: 14 }}>
              <span style={{ color: 'var(--navy)' }}>Net Income</span>
              <span style={{ color: netIncome >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {fmtCurrency(netIncome)} ({fmtPct(netMarginPct)})
              </span>
            </div>
          </div>
        </div>

        {/* ── Section 4: Distributions ────────────────────────────────────────── */}
        {distributions.length > 0 && (
          <div className="fin-section" style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 14 }}>
              Distributions
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--line-soft)' }}>
                    {['Date', 'Recipient', 'Amount', 'Notes'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: h === 'Amount' ? 'right' : 'left',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: 'var(--wine)',
                        borderBottom: '1px solid var(--line)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {distributions.map((d, i) => (
                    <tr key={i} style={{ borderBottom: i < distributions.length - 1 ? '1px solid var(--line-soft)' : undefined }}>
                      <td style={{ padding: '10px 16px', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink)', fontWeight: 500 }}>{d.recipient}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--ink)', fontWeight: 500 }}>{fmtCurrency(d.amount)}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink-soft)', fontSize: 12 }}>{d.notes ?? '—'}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background: 'var(--line-soft)', borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--ink-faint)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }} colSpan={2}>Total</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--navy)', fontWeight: 700, fontSize: 14 }}>{fmtCurrency(distTotal)}</td>
                    <td style={{ padding: '10px 16px' }} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Section 5: Bank Balance ─────────────────────────────────────────── */}
        {bankBalance && (
          <div className="fin-section" style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 14 }}>
              Bank Balance
            </div>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
                As of {fmtDate(bankBalance.as_of_date)}:
              </span>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--serif)' }}>
                {fmtCurrency(bankBalance.balance)}
              </span>
              {bankBalance.notes && (
                <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{bankBalance.notes}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
