export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import NewCompanyButton from '@/components/directory/NewCompanyButton'
import DirectoryClient, { CompanyRow } from '@/components/directory/DirectoryClient'

export default async function DirectoryPage() {
  const supabase = await createClient()

  const [{ data: companies }, { data: invoices }] = await Promise.all([
    supabase.from('companies').select('*, contacts(id), engagements(id, stage)').order('name'),
    supabase.from('invoices').select('company_id, amount, status, paid_date'),
  ])

  // Compute total paid revenue per company
  const revenueByCompany: Record<string, number> = {}
  for (const inv of invoices ?? []) {
    if (inv.status === 'paid' && inv.company_id) {
      revenueByCompany[inv.company_id] = (revenueByCompany[inv.company_id] ?? 0) + (inv.amount ?? 0)
    }
  }

  const companyRows: CompanyRow[] = (companies ?? []).map(company => {
    const contacts = (company.contacts ?? []) as { id: string }[]
    const engagements = (company.engagements ?? []) as { id: string; stage: string }[]
    return {
      id: company.id,
      name: company.name,
      tag: company.tag ?? 'prospect',
      industry: company.industry ?? null,
      address: company.address ?? null,
      account_owner: company.account_owner ?? null,
      contactCount: contacts.length,
      engagementCount: engagements.length,
      activeEngagementCount: engagements.filter(e => e.stage === 'active').length,
      totalRevenue: revenueByCompany[company.id] ?? 0,
    }
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: 'var(--navy)', letterSpacing: '-0.5px', margin: 0 }}>
            Directory
          </h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 8, marginBottom: 0 }}>
            {companyRows.length} {companyRows.length === 1 ? 'company' : 'companies'} &nbsp;&middot;&nbsp; click a row for contacts and engagements
          </p>
        </div>
        <NewCompanyButton />
      </div>

      {companyRows.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '64px 32px', textAlign: 'center', color: 'var(--ink-faint)' }}>
          <p style={{ fontSize: 15, marginBottom: 12 }}>No companies yet</p>
          <NewCompanyButton />
        </div>
      ) : (
        <DirectoryClient companies={companyRows} />
      )}
    </div>
  )
}
