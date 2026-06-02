'use client'

import { useState } from 'react'
import Link from 'next/link'

interface MonthData {
  month: string
  revenue_forecast: number
  revenue_actual: number
  cogs_forecast: number
  cogs_actual: number
  opex_forecast: number
  opex_actual: number
  opex_by_cat_forecast: Record<string, number>
  opex_by_cat_actual: Record<string, number>
  gross_profit_forecast: number
  gross_profit_actual: number
  net_income_forecast: number
  net_income_actual: number
}

interface Props {
  months: MonthData[]
  opexCategories: string[]
  hasExpenses: boolean
}

function fmtCurrency(n: number): string {
  if (n === 0) return '-'
  const abs = Math.abs(n)
  const formatted = abs >= 1000
    ? '$' + abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : '$' + abs.toFixed(0)
  return n < 0 ? '-' + formatted : formatted
}

function sumMonths(months: MonthData[], key: keyof MonthData): number {
  return months.reduce((s, m) => s + (typeof m[key] === 'number' ? (m[key] as number) : 0), 0)
}

function ValueCell({ value, small }: { value: number; small?: boolean }) {
  const color = value > 0 ? 'var(--success)' : value < 0 ? 'var(--danger)' : 'var(--ink-faint)'
  return (
    <td style={{
      padding: small ? '6px 12px' : '10px 12px',
      textAlign: 'right',
      fontSize: small ? 11 : 13,
      color,
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {fmtCurrency(value)}
    </td>
  )
}

function PctCell({ num, den, white }: { num: number; den: number; white?: boolean }) {
  const pct = den !== 0 ? Math.round((num / den) * 100) : 0
  return (
    <td style={{
      padding: '4px 12px 8px',
      textAlign: 'right',
      fontSize: 10,
      color: white ? 'rgba(255,255,255,0.7)' : 'var(--ink-faint)',
      whiteSpace: 'nowrap',
    }}>
      {den !== 0 ? pct + '%' : '-'}
    </td>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'right',
  fontSize: 10,
  color: 'var(--wine)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: 'var(--line-soft)',
  position: 'sticky',
  top: 0,
  zIndex: 2,
}

const labelThStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'left',
  position: 'sticky',
  left: 0,
  zIndex: 3,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'var(--wine)',
  background: 'var(--line-soft)',
  padding: '8px 12px',
  fontWeight: 600,
}

const labelCellStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--ink)',
  whiteSpace: 'nowrap',
  background: 'var(--surface)',
  position: 'sticky',
  left: 0,
  zIndex: 1,
}

export default function PnLClient({ months, opexCategories, hasExpenses }: Props) {
  const [mode, setMode] = useState<'forecast' | 'actual'>('forecast')
  const isF = mode === 'forecast'

  const totalRevenue = sumMonths(months, isF ? 'revenue_forecast' : 'revenue_actual')
  const totalCogs = sumMonths(months, isF ? 'cogs_forecast' : 'cogs_actual')
  const totalOpex = sumMonths(months, isF ? 'opex_forecast' : 'opex_actual')
  const totalGross = sumMonths(months, isF ? 'gross_profit_forecast' : 'gross_profit_actual')
  const totalNet = sumMonths(months, isF ? 'net_income_forecast' : 'net_income_actual')
  const netMarginPct = totalRevenue !== 0 ? Math.round((totalNet / totalRevenue) * 100) : 0

  return (
    <div>
      {/* Header row with toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0 }}>
          Profit &amp; Loss &mdash; forecast vs. actual
        </p>
        <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid var(--line)', overflow: 'hidden' }}>
          {(['forecast', 'actual'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '7px 18px',
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: mode === m ? 'var(--navy)' : 'var(--surface)',
                color: mode === m ? '#fff' : 'var(--ink-soft)',
                transition: 'all 0.15s',
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Revenue', value: fmtCurrency(totalRevenue) },
          { label: 'Gross Profit', value: fmtCurrency(totalGross) },
          { label: 'Net Income', value: fmtCurrency(totalNet) },
          { label: 'Net Margin', value: totalRevenue !== 0 ? netMarginPct + '%' : '-' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ ...labelThStyle, minWidth: 200 }}>Line Item</th>
              {months.map(m => (
                <th key={m.month} style={thStyle}>{m.month}</th>
              ))}
              <th style={thStyle}>Total</th>
            </tr>
          </thead>
          <tbody>
            {/* REVENUE */}
            <tr>
              <td colSpan={months.length + 2} style={sectionHeaderStyle}>Revenue</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={labelCellStyle}>Total Revenue</td>
              {months.map(m => <ValueCell key={m.month} value={isF ? m.revenue_forecast : m.revenue_actual} />)}
              <ValueCell value={totalRevenue} />
            </tr>

            {/* COGS */}
            <tr>
              <td colSpan={months.length + 2} style={sectionHeaderStyle}>Cost of Goods Sold</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <td style={labelCellStyle}>Total COGS</td>
              {months.map(m => <ValueCell key={m.month} value={isF ? m.cogs_forecast : m.cogs_actual} />)}
              <ValueCell value={totalCogs} />
            </tr>

            {/* GROSS PROFIT */}
            <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ ...labelCellStyle, fontWeight: 600, background: 'var(--line-soft)' }}>Gross Profit</td>
              {months.map(m => <ValueCell key={m.month} value={isF ? m.gross_profit_forecast : m.gross_profit_actual} />)}
              <ValueCell value={totalGross} />
            </tr>
            <tr style={{ borderBottom: '2px solid var(--line)' }}>
              <td style={{ ...labelCellStyle, fontSize: 11, color: 'var(--ink-faint)', paddingTop: 4, paddingBottom: 8 }}>Gross Margin %</td>
              {months.map(m => {
                const rev = isF ? m.revenue_forecast : m.revenue_actual
                const gp = isF ? m.gross_profit_forecast : m.gross_profit_actual
                return <PctCell key={m.month} num={gp} den={rev} />
              })}
              <PctCell num={totalGross} den={totalRevenue} />
            </tr>

            {/* OPEX */}
            <tr>
              <td colSpan={months.length + 2} style={sectionHeaderStyle}>Operating Expenses</td>
            </tr>
            {opexCategories.map(cat => {
              const total = months.reduce((s, m) => s + (isF ? (m.opex_by_cat_forecast[cat] ?? 0) : (m.opex_by_cat_actual[cat] ?? 0)), 0)
              return (
                <tr key={cat} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <td style={{ ...labelCellStyle, fontSize: 12, color: 'var(--ink-soft)' }}>{cat}</td>
                  {months.map(m => {
                    const v = isF ? (m.opex_by_cat_forecast[cat] ?? 0) : (m.opex_by_cat_actual[cat] ?? 0)
                    return <ValueCell key={m.month} value={v} />
                  })}
                  <ValueCell value={total} />
                </tr>
              )
            })}
            <tr style={{ background: 'var(--line-soft)', borderBottom: '2px solid var(--line)' }}>
              <td style={{ ...labelCellStyle, fontWeight: 600, background: 'var(--line-soft)' }}>Total OpEx</td>
              {months.map(m => <ValueCell key={m.month} value={isF ? m.opex_forecast : m.opex_actual} />)}
              <ValueCell value={totalOpex} />
            </tr>

            {/* NET INCOME */}
            <tr style={{ background: 'var(--navy)', borderBottom: '1px solid var(--line-soft)' }}>
              <td style={{ ...labelCellStyle, fontWeight: 700, color: '#fff', background: 'var(--navy)', fontSize: 14 }}>Net Income</td>
              {months.map(m => {
                const v = isF ? m.net_income_forecast : m.net_income_actual
                return (
                  <td key={m.month} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#fff', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(v)}
                  </td>
                )
              })}
              <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                {fmtCurrency(totalNet)}
              </td>
            </tr>
            <tr style={{ background: 'var(--navy)' }}>
              <td style={{ ...labelCellStyle, fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'var(--navy)', paddingTop: 2, paddingBottom: 10 }}>Net Margin %</td>
              {months.map(m => {
                const rev = isF ? m.revenue_forecast : m.revenue_actual
                const net = isF ? m.net_income_forecast : m.net_income_actual
                return <PctCell key={m.month} num={net} den={rev} white />
              })}
              <PctCell num={totalNet} den={totalRevenue} white />
            </tr>
          </tbody>
        </table>
      </div>

      {!hasExpenses && (
        <div style={{ marginTop: 32, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
          No expenses logged yet.{' '}
          <Link href="/expenses" style={{ color: 'var(--wine)', textDecoration: 'none' }}>Add some &rarr;</Link>
        </div>
      )}
    </div>
  )
}
