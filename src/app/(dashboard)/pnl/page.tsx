export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Expense, RevenueItem, EXPENSE_CATEGORIES } from '@/lib/types'
import PnLClient from '@/components/pnl/PnLClient'

export default async function PnLPage() {
  const supabase = await createClient()

  const [{ data: revenueData }, { data: expenseData }] = await Promise.all([
    supabase.from('revenue_items').select('forecast_amount, actual_amount, month'),
    supabase.from('expenses').select('month, category, forecast, actual'),
  ])

  const revenue = (revenueData ?? []) as Pick<RevenueItem, 'forecast_amount' | 'actual_amount' | 'month'>[]
  const expenses = (expenseData ?? []) as Pick<Expense, 'month' | 'category' | 'forecast' | 'actual'>[]

  // Gather all months from both datasets
  const monthSet = new Set<string>()
  for (const r of revenue) { if (r.month) monthSet.add(r.month) }
  for (const e of expenses) { if (e.month) monthSet.add(e.month) }
  const months = Array.from(monthSet).sort()

  // Determine opex categories that have data
  const opexCatSet = new Set<string>()
  for (const e of expenses) {
    const norm = e.category.replace(/ - /g, ' — ')
    const catType = EXPENSE_CATEGORIES[norm as keyof typeof EXPENSE_CATEGORIES]
      || EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES]
    if (catType === 'opex') opexCatSet.add(norm)
  }
  const opexCategories = Array.from(opexCatSet).sort()

  // Build month data
  const monthData = months.map(month => {
    const revRows = revenue.filter(r => r.month === month)
    const revenue_forecast = revRows.reduce((s, r) => s + (r.forecast_amount || 0), 0)
    const revenue_actual = revRows.reduce((s, r) => s + (r.actual_amount || 0), 0)

    const expRows = expenses.filter(e => e.month === month)
    let cogs_forecast = 0, cogs_actual = 0, opex_forecast = 0, opex_actual = 0
    const opex_by_cat_forecast: Record<string, number> = {}
    const opex_by_cat_actual: Record<string, number> = {}

    for (const e of expRows) {
      const norm = e.category.replace(/ - /g, ' — ')
      const catType = EXPENSE_CATEGORIES[norm as keyof typeof EXPENSE_CATEGORIES]
        || EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES]
      if (catType === 'cogs') {
        cogs_forecast += e.forecast || 0
        cogs_actual += e.actual || 0
      } else if (catType === 'opex') {
        opex_forecast += e.forecast || 0
        opex_actual += e.actual || 0
        opex_by_cat_forecast[norm] = (opex_by_cat_forecast[norm] ?? 0) + (e.forecast || 0)
        opex_by_cat_actual[norm] = (opex_by_cat_actual[norm] ?? 0) + (e.actual || 0)
      }
    }

    const gross_profit_forecast = revenue_forecast - cogs_forecast
    const gross_profit_actual = revenue_actual - cogs_actual
    const net_income_forecast = gross_profit_forecast - opex_forecast
    const net_income_actual = gross_profit_actual - opex_actual

    return {
      month,
      revenue_forecast,
      revenue_actual,
      cogs_forecast,
      cogs_actual,
      opex_forecast,
      opex_actual,
      opex_by_cat_forecast,
      opex_by_cat_actual,
      gross_profit_forecast,
      gross_profit_actual,
      net_income_forecast,
      net_income_actual,
    }
  })

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', marginBottom: 8, letterSpacing: '-0.5px' }}>
        P&amp;L Statement
      </h1>
      <PnLClient
        months={monthData}
        opexCategories={opexCategories}
        hasExpenses={expenses.length > 0}
      />
    </div>
  )
}
