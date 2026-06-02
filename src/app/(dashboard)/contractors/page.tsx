export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import StatCard from '@/components/ui/StatCard'
import ContractorsClient, { ContractorRowActions, PaymentRowActions } from '@/components/contractors/ContractorsClient'
import type { Contractor, ContractorPayment } from '@/lib/types'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function ContractorsPage() {
  const supabase = await createClient()

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

  // Per-contractor stats
  const contractorStats = contractors.map(c => {
    const cPayments = payments.filter(p => p.contractor_id === c.id)
    const ytd = cPayments.filter(p => p.date >= ytdStart).reduce((s, p) => s + p.amount, 0)
    const allTime = cPayments.reduce((s, p) => s + p.amount, 0)
    return { ...c, ytd, allTime, needs1099: ytd >= 600 }
  })

  const totalYtd = contractorStats.reduce((s, c) => s + c.ytd, 0)
  const need1099Count = contractorStats.filter(c => c.needs1099).length
  const missingW9Count = contractors.filter(c => !c.w9_on_file).length

  // Contractor lookup for payments table
  const contractorMap = Object.fromEntries(contractors.map(c => [c.id, c.name]))

  return (
    <div>
      <style>{`.hover-row:hover { background: var(--line-soft) !important; }`}</style>
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

      {/* Contractors table */}
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

      {/* Payments table */}
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
