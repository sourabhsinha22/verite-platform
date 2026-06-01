import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function fmtFull(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMonth(m: string | null) {
  if (!m) return '—'
  return new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default async function RevenuePage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('revenue_items')
    .select('*, engagement:engagements(id, name, company:companies(id, name))')
    .order('month', { ascending: true })

  const rows = items ?? []

  const totalForecast = rows.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
  const totalActual = rows.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
  const variance = totalActual - totalForecast
  const pctCollected = totalForecast > 0 ? Math.round((totalActual / totalForecast) * 100) : 0

  // Group by engagement
  const byEngagement: Record<string, {
    engagementId: string; engagementName: string; companyName: string; companyId: string; rows: typeof rows
  }> = {}
  for (const item of rows) {
    const eng = item.engagement as { id: string; name: string; company?: { id: string; name: string } } | null
    if (!eng) continue
    if (!byEngagement[eng.id]) {
      byEngagement[eng.id] = {
        engagementId: eng.id,
        engagementName: eng.name,
        companyName: eng.company?.name ?? '—',
        companyId: eng.company?.id ?? '',
        rows: [],
      }
    }
    byEngagement[eng.id].rows.push(item)
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
        Revenue
      </h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 36px' }}>
        Forecast vs. actuals across all engagements
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        <StatCard label="Total Forecast" value={fmt(totalForecast)} sub={`${rows.length} line items`} accent="info" />
        <StatCard label="Total Actual" value={fmt(totalActual)} sub="received" accent="green" />
        <StatCard label="Variance" value={(variance >= 0 ? '+' : '') + fmt(variance)} accent={variance >= 0 ? 'green' : 'rose'} />
        <StatCard label="% Collected" value={`${pctCollected}%`} sub="of forecast" accent={pctCollected >= 80 ? 'green' : pctCollected >= 50 ? 'warn' : 'rose'} />
      </div>

      {Object.values(byEngagement).length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
          No revenue data yet. Add revenue items inside an engagement to see them here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.values(byEngagement).map(group => {
            const grpForecast = group.rows.reduce((s, r) => s + (r.forecast_amount ?? 0), 0)
            const grpActual = group.rows.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
            const grpVariance = grpActual - grpForecast
            const grpPct = grpForecast > 0 ? Math.round((grpActual / grpForecast) * 100) : 0
            return (
              <div key={group.engagementId} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: 'var(--line-soft)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <Link href={`/engagements/${group.engagementId}`} style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--navy)', textDecoration: 'none' }}>
                      {group.engagementName}
                    </Link>
                    {group.companyName !== '—' && (
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                        — {group.companyName}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--ink-soft)' }}>
                    <span>Forecast: <strong style={{ color: 'var(--navy)' }}>{fmtFull(grpForecast)}</strong></span>
                    <span>Actual: <strong style={{ color: 'var(--success)' }}>{fmtFull(grpActual)}</strong></span>
                    <span style={{ color: grpVariance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {grpPct}% collected
                    </span>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(241,239,232,0.5)', borderBottom: '1px solid var(--line)' }}>
                      {['Label', 'Month', 'Forecast', 'Actual', 'Variance', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((item) => {
                      const v = (item.actual_amount ?? 0) - item.forecast_amount
                      const hasActual = item.actual_amount != null
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--line-soft)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--line-soft)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <td style={{ padding: '11px 16px', fontSize: 13 }}>{item.label}</td>
                          <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{fmtMonth(item.month)}</td>
                          <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--ink-soft)' }}>{fmtFull(item.forecast_amount)}</td>
                          <td style={{ padding: '11px 16px', fontSize: 13, color: hasActual ? 'var(--success)' : 'var(--ink-faint)', fontWeight: hasActual ? 500 : 400 }}>
                            {hasActual ? fmtFull(item.actual_amount!) : '—'}
                          </td>
                          <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 500, color: !hasActual ? 'var(--ink-faint)' : v >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {hasActual ? (v >= 0 ? '+' : '') + fmtFull(v) : '—'}
                          </td>
                          <td style={{ padding: '11px 16px' }}>
                            {hasActual ? (
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--success-soft)', color: 'var(--success)' }}>Received</span>
                            ) : (
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--line-soft)', color: 'var(--ink-faint)' }}>Forecast</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}

          {/* Grand total bar */}
          <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Grand Total</div>
            <div style={{ display: 'flex', gap: 40 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Forecast</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', fontFamily: 'var(--serif)' }}>{fmtFull(totalForecast)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Actual</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#7dd9a3', fontFamily: 'var(--serif)' }}>{fmtFull(totalActual)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Variance</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: variance >= 0 ? '#7dd9a3' : '#f5a0a0', fontFamily: 'var(--serif)' }}>
                  {(variance >= 0 ? '+' : '') + fmtFull(variance)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
