export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import StatCard from '@/components/ui/StatCard'
import ReimbursementsClient, { ReimbRowActions } from '@/components/reimbursements/ReimbursementsClient'
import type { Reimbursement } from '@/lib/types'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function ReimbursementsPage() {
  const supabase = await createClient()
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
