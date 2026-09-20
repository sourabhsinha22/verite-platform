export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number): string {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toLocaleString()
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%'
}

function stageBadgeStyle(stage: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    active:  { bg: '#d1fae5', color: '#065f46' },
    closed:  { bg: '#e5e7eb', color: '#374151' },
    paused:  { bg: '#fef3c7', color: '#92400e' },
  }
  return map[stage] ?? { bg: '#f3f4f6', color: '#374151' }
}

function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

type EngRow = {
  id: string
  name: string
  stage: string
  lead: string | null
  engagement_type: string | null
  company: { name: string } | null
  created_at: string
  contract_value: number | null
  billed: number
  collected: number
  outstanding: number
  forecastRevenue: number
  actualRevenue: number
  collectionRate: number
}

export default async function ProfitabilityPage() {
  const activeOrgId = (await cookies()).get('verite-active-org')?.value
  const currentUser = await getCurrentUser(activeOrgId)
  if (!currentUser || currentUser.role === 'Associate') redirect('/dashboard')

  const supabase = await createClient()

  const [
    { data: engagements },
    { data: revenueItems },
    { data: invoices },
    { data: contractorPayments },
    { data: contractors },
  ] = await Promise.all([
    supabase.from('engagements')
      .select('id, name, stage, lead, engagement_type, company:companies(name), created_at, contract_value')
      .in('stage', ['active', 'closed', 'paused']),
    supabase.from('revenue_items')
      .select('engagement_id, actual_amount, forecast_amount'),
    supabase.from('invoices')
      .select('engagement_id, amount, status, paid_date'),
    supabase.from('contractor_payments')
      .select('id, contractor_id, amount, description, date'),
    supabase.from('contractors')
      .select('id, name'),
  ])

  const engList = engagements ?? []
  const invList = invoices ?? []
  const revList = revenueItems ?? []
  const cpList = contractorPayments ?? []

  // Per-engagement compute
  const engRows: EngRow[] = engList.map(eng => {
    const engInvoices = invList.filter(i => i.engagement_id === eng.id)
    const engRevItems = revList.filter(r => r.engagement_id === eng.id)

    const billed = engInvoices.reduce((s, i) => s + (i.amount ?? 0), 0)
    const collected = engInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount ?? 0), 0)
    const outstanding = billed - collected
    const forecastRevenue = engRevItems.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
    const actualRevenue = engRevItems.filter(r => r.actual_amount != null).reduce((s, r) => s + (r.actual_amount ?? 0), 0)
    const collectionRate = billed > 0 ? (collected / billed) * 100 : 0

    return {
      id: eng.id,
      name: eng.name,
      stage: eng.stage,
      lead: eng.lead,
      engagement_type: eng.engagement_type,
      company: (Array.isArray(eng.company) ? (eng.company[0] ?? null) : eng.company) as { name: string } | null,
      created_at: eng.created_at,
      contract_value: eng.contract_value,
      billed,
      collected,
      outstanding,
      forecastRevenue,
      actualRevenue,
      collectionRate,
    }
  }).sort((a, b) => b.outstanding - a.outstanding)

  // Portfolio totals
  const totalBilled = engRows.reduce((s, r) => s + r.billed, 0)
  const totalCollected = engRows.reduce((s, r) => s + r.collected, 0)
  const totalOutstanding = totalBilled - totalCollected
  const overallCollectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0

  // Contractor totals
  const totalContractorSpend = cpList.reduce((s, p) => s + (p.amount ?? 0), 0)

  // Monthly collection trend (last 12 months, paid invoices)
  const now = new Date()
  const months: { year: number; month: number; label: string; amount: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: MO[d.getMonth()], amount: 0 })
  }
  for (const inv of invList) {
    if (inv.status === 'paid' && inv.paid_date) {
      const d = new Date(inv.paid_date)
      const yr = d.getFullYear()
      const mo = d.getMonth()
      const slot = months.find(m => m.year === yr && m.month === mo)
      if (slot) slot.amount += inv.amount ?? 0
    }
  }
  const maxAmount = Math.max(...months.map(m => m.amount), 1)

  const statCards = [
    { label: 'Total Billed', value: fmt(totalBilled), sub: 'All invoices issued' },
    { label: 'Total Collected', value: fmt(totalCollected), sub: 'Paid invoices', highlight: 'success' },
    { label: 'Total Outstanding', value: fmt(totalOutstanding), sub: 'Unpaid balance', highlight: totalOutstanding > 0 ? 'warn' : undefined },
    { label: 'Collection Rate', value: fmtPct(overallCollectionRate), sub: 'Across portfolio', highlight: overallCollectionRate < 80 ? 'danger' : 'success' },
  ]

  const highlightColor: Record<string, string> = {
    success: '#065f46',
    warn: '#92400e',
    danger: '#991b1b',
  }
  const highlightBg: Record<string, string> = {
    success: '#d1fae5',
    warn: '#fef3c7',
    danger: '#fee2e2',
  }

  return (
    <>
      <style>{`
        .prof-row:hover td { background: #fdf8f5 !important; }
        .stat-card:hover { box-shadow: 0 4px 16px rgba(37,49,74,0.10) !important; }
      `}</style>

      <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '48px 48px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '40px', fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>
            Profitability
          </h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontFamily: 'var(--sans)', fontSize: '15px' }}>
            Revenue, billing, and collection across engagements
          </p>
        </div>

        {/* Section 1: Portfolio Summary */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 16px' }}>
            Portfolio Summary
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {statCards.map(card => (
              <div key={card.label} className="stat-card" style={{
                background: 'var(--surface)',
                border: '1px solid #ede8e3',
                borderRadius: '8px',
                padding: '20px 24px',
                transition: 'box-shadow 0.15s',
              }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500, marginBottom: '8px', fontFamily: 'var(--sans)' }}>
                  {card.label}
                </div>
                <div style={{
                  fontFamily: 'var(--serif)', fontSize: '28px', fontWeight: 600,
                  color: card.highlight ? highlightColor[card.highlight] : 'var(--ink)',
                  lineHeight: 1.1, marginBottom: '4px',
                }}>
                  {card.value}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{card.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Profitability Table */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 16px' }}>
            Per-Engagement Profitability
          </h2>
          <div style={{ background: 'var(--surface)', border: '1px solid #ede8e3', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0ebe6', background: '#faf6f2' }}>
                  {['Engagement','Company','Stage','Lead','Contract Value','Billed','Collected','Outstanding','Collection Rate'].map(h => (
                    <th key={h} style={{
                      textAlign: h === 'Engagement' || h === 'Company' || h === 'Stage' || h === 'Lead' ? 'left' : 'right',
                      padding: '10px 14px',
                      fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engRows.map(row => {
                  const warnRow = row.collectionRate > 0 && row.collectionRate < 80
                  const dangerRow = row.outstanding > 10000
                  const rowBg = dangerRow ? '#fff5f5' : warnRow ? '#fffbeb' : 'transparent'
                  const badge = stageBadgeStyle(row.stage)
                  return (
                    <tr key={row.id} className="prof-row" style={{ borderBottom: '1px solid #f7f3f0' }}>
                      <td style={{ padding: '11px 14px', background: rowBg, fontWeight: 500, color: 'var(--wine)', maxWidth: '180px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', background: rowBg, color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {row.company?.name ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', background: rowBg }}>
                        <span style={{ background: badge.bg, color: badge.color, fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px' }}>
                          {stageLabel(row.stage)}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', background: rowBg, color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {row.lead ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', background: rowBg, textAlign: 'right', color: '#374151' }}>
                        {row.contract_value ? fmt(row.contract_value) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', background: rowBg, textAlign: 'right', color: '#374151' }}>
                        {row.billed > 0 ? fmt(row.billed) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', background: rowBg, textAlign: 'right', color: row.collected > 0 ? '#065f46' : '#9ca3af' }}>
                        {row.collected > 0 ? fmt(row.collected) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', background: rowBg, textAlign: 'right', color: row.outstanding > 10000 ? '#991b1b' : row.outstanding > 0 ? '#92400e' : '#9ca3af', fontWeight: row.outstanding > 0 ? 600 : 400 }}>
                        {row.outstanding > 0 ? fmt(row.outstanding) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', background: rowBg, textAlign: 'right' }}>
                        {row.billed > 0 ? (
                          <span style={{
                            fontWeight: 600,
                            color: row.collectionRate >= 80 ? '#065f46' : row.collectionRate >= 50 ? '#92400e' : '#991b1b',
                          }}>
                            {fmtPct(row.collectionRate)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
                {engRows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No engagements found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '16px', fontSize: '11px', color: '#9ca3af' }}>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: '#fffbeb', border: '1px solid #fde68a', marginRight: '4px' }} />Collection rate &lt; 80%</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: '#fff5f5', border: '1px solid #fecaca', marginRight: '4px' }} />Outstanding &gt; $10K</span>
          </div>
        </div>

        {/* Section 3: Contractor Costs */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 16px' }}>
            Contractor Costs
          </h2>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid #ede8e3',
            borderRadius: '8px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            <div style={{ width: '4px', borderRadius: '99px', background: 'var(--blush)', alignSelf: 'stretch', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                {fmt(totalContractorSpend)} <span style={{ fontFamily: 'var(--sans)', fontSize: '13px', fontWeight: 400, color: '#9ca3af' }}>total contractor spend</span>
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                Contractor costs are not yet allocated per engagement. Total platform contractor spend: <strong>{fmt(totalContractorSpend)}</strong> across {cpList.length} payment{cpList.length !== 1 ? 's' : ''}.
                To see per-engagement profitability, link contractor payments to engagements in the data model.
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Monthly Collection Trend */}
        <div>
          <h2 style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 20px' }}>
            Monthly Collection Trend — Last 12 Months
          </h2>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid #ede8e3',
            borderRadius: '8px',
            padding: '28px 24px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px' }}>
              {months.map((m, i) => {
                const barH = m.amount > 0 ? Math.max(4, Math.round((m.amount / maxAmount) * 130)) : 0
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    {m.amount > 0 && (
                      <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 500, whiteSpace: 'nowrap', marginBottom: '2px' }}>
                        {fmt(m.amount)}
                      </div>
                    )}
                    <div style={{
                      width: '100%',
                      height: `${barH}px`,
                      background: barH > 0 ? 'var(--wine)' : '#f0ebe6',
                      borderRadius: '3px 3px 0 0',
                      marginTop: 'auto',
                      transition: 'height 0.2s',
                      minHeight: '4px',
                    }} />
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{m.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
