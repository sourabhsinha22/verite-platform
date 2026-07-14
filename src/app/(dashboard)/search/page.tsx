import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q: qRaw } = await searchParams
  const q = (qRaw ?? '').trim()
  const supabase = await createClient()

  if (!q || q.length < 2) {
    return (
      <div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 600, color: 'var(--navy)', margin: '0 0 12px' }}>
          Search
        </h1>
        <p style={{ color: 'var(--ink-faint)', fontSize: 14 }}>Type at least 2 characters to search.</p>
      </div>
    )
  }

  const pattern = `%${q}%`

  const [engagements, companies, tasks, invoices] = await Promise.all([
    supabase
      .from('engagements')
      .select('id, name, notes, stage, lead, contract_value, company:companies(id, name)')
      .or(`name.ilike.${pattern},notes.ilike.${pattern}`)
      .limit(20),
    supabase
      .from('companies')
      .select('id, name, tag, industry, account_owner')
      .ilike('name', pattern)
      .limit(20),
    supabase
      .from('tasks')
      .select('id, title, engagement_id, status, due_date, owner')
      .ilike('title', pattern)
      .limit(20),
    supabase
      .from('invoices')
      .select('id, invoice_number, notes, engagement_id, amount, status, due_date, company:companies(name)')
      .or(`invoice_number.ilike.${pattern},notes.ilike.${pattern}`)
      .limit(20),
  ])

  const engRows = engagements.data ?? []
  const coRows = companies.data ?? []
  const taskRows = tasks.data ?? []
  const invRows = invoices.data ?? []

  const totalCount = engRows.length + coRows.length + taskRows.length + invRows.length

  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  function fmtDate(d: string | null | undefined): string {
    if (!d) return '—'
    const dt = new Date(d + 'T00:00:00')
    return `${MO[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`
  }

  function fmtMoney(v: number | null | undefined): string {
    if (v == null) return '—'
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
    if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K'
    return '$' + Math.round(v).toLocaleString()
  }

  const sectionHeader = (label: string, count: number) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
      paddingBottom: 8,
      borderBottom: '1px solid var(--line)',
    }}>
      <h2 style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wine)', margin: 0 }}>
        {label}
      </h2>
      <span style={{
        background: 'var(--line-soft)',
        color: 'var(--ink-soft)',
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 10,
        padding: '1px 7px',
        fontFamily: 'var(--sans)',
      }}>{count}</span>
    </div>
  )

  const stageBadge = (stage: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      active:        { bg: '#e6f4ec', color: '#2d6a3e' },
      prospect:      { bg: '#eef2ff', color: '#3b4fd8' },
      engaged:       { bg: '#eef2ff', color: '#3b4fd8' },
      qualified:     { bg: '#eef2ff', color: '#3b4fd8' },
      proposal_sent: { bg: '#fff8e6', color: '#b8841a' },
      lead:          { bg: '#eef2ff', color: '#3b4fd8' },
      opportunity:   { bg: '#eef2ff', color: '#3b4fd8' },
      closed:        { bg: '#f0f0f3', color: '#5f5f6e' },
      paused:        { bg: '#f5ebe3', color: '#7a4a2a' },
    }
    const c = colors[stage] ?? { bg: 'var(--line-soft)', color: 'var(--ink-soft)' }
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.color,
        fontFamily: 'var(--sans)', whiteSpace: 'nowrap' as const,
      }}>
        {stage.replace('_', ' ')}
      </span>
    )
  }

  const statusChip = (status: string | null | undefined, isOverdue?: boolean) => {
    if (!status) return null
    const overdue = isOverdue
    const colors: Record<string, { bg: string; color: string }> = {
      done:      { bg: '#e6f4ec', color: '#2d6a3e' },
      'in-progress': { bg: '#eef2ff', color: '#3b4fd8' },
      todo:      { bg: '#f0f0f3', color: '#5f5f6e' },
      blocked:   { bg: '#fce8e8', color: '#a13030' },
      sent:      { bg: '#fff8e6', color: '#b8841a' },
      paid:      { bg: '#e6f4ec', color: '#2d6a3e' },
      overdue:   { bg: '#fce8e8', color: '#a13030' },
      draft:     { bg: '#f0f0f3', color: '#5f5f6e' },
    }
    const c = overdue ? { bg: '#fce8e8', color: '#a13030' } : (colors[status] ?? { bg: 'var(--line-soft)', color: 'var(--ink-soft)' })
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.color,
        fontFamily: 'var(--sans)', whiteSpace: 'nowrap' as const,
      }}>
        {status.replace('-', ' ')}
      </span>
    )
  }

  const tagChip = (tag: string | null | undefined) => {
    if (!tag) return null
    const colors: Record<string, { bg: string; color: string }> = {
      Current:  { bg: '#e6f4ec', color: '#2d6a3e' },
      Prospect: { bg: '#eef2ff', color: '#3b4fd8' },
      Past:     { bg: '#f0f0f3', color: '#5f5f6e' },
    }
    const c = colors[tag] ?? { bg: 'var(--line-soft)', color: 'var(--ink-soft)' }
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.color,
        fontFamily: 'var(--sans)', whiteSpace: 'nowrap' as const,
      }}>
        {tag}
      </span>
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <style>{`.sr-row:hover { background: var(--line-soft) !important; }`}</style>

      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 600, color: 'var(--navy)', margin: '0 0 4px' }}>
        Search results for &ldquo;{q}&rdquo;
      </h1>
      <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: '0 0 32px' }}>
        {totalCount} result{totalCount !== 1 ? 's' : ''} found
      </p>

      {totalCount === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '48px 32px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
          No results found for &ldquo;{q}&rdquo;. Try a different search term.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {engRows.length > 0 && (
          <div>
            {sectionHeader('Engagements', engRows.length)}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {engRows.map((eng, i) => {
                const companyRaw = eng.company as unknown as { id: string; name: string }[] | { id: string; name: string } | null
                const company = Array.isArray(companyRaw) ? (companyRaw[0] ?? null) : companyRaw
                return (
                  <Link
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    className="sr-row"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', textDecoration: 'none', color: 'var(--ink)',
                      fontFamily: 'var(--sans)', borderBottom: i < engRows.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 14, marginBottom: 2 }}>{eng.name}</div>
                      {company && <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{company.name}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      {eng.lead && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{eng.lead}</span>}
                      {eng.contract_value != null && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fmtMoney(eng.contract_value)}</span>
                      )}
                      {stageBadge(eng.stage)}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {coRows.length > 0 && (
          <div>
            {sectionHeader('Companies', coRows.length)}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {coRows.map((co, i) => (
                <Link
                  key={co.id}
                  href={`/directory/${co.id}`}
                  className="sr-row"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', textDecoration: 'none', color: 'var(--ink)',
                    fontFamily: 'var(--sans)', borderBottom: i < coRows.length - 1 ? '1px solid var(--line-soft)' : 'none',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 14 }}>{co.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {co.account_owner && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{co.account_owner}</span>}
                    {co.industry && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{co.industry}</span>}
                    {tagChip(co.tag)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {taskRows.length > 0 && (
          <div>
            {sectionHeader('Tasks', taskRows.length)}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {taskRows.map((task, i) => {
                const isOverdue = !!(task.due_date && task.due_date < today && task.status !== 'done')
                return (
                  <Link
                    key={task.id}
                    href={`/engagements/${task.engagement_id}`}
                    className="sr-row"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', textDecoration: 'none', color: 'var(--ink)',
                      fontFamily: 'var(--sans)', borderBottom: i < taskRows.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500, color: isOverdue ? 'var(--danger)' : 'var(--ink)', fontSize: 14 }}>{task.title}</span>
                      {task.owner && <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 8 }}>{task.owner}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {task.due_date && (
                        <span style={{ fontSize: 12, color: isOverdue ? 'var(--danger)' : 'var(--ink-faint)', fontWeight: isOverdue ? 600 : 400 }}>
                          {fmtDate(task.due_date)}
                        </span>
                      )}
                      {statusChip(task.status, isOverdue)}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {invRows.length > 0 && (
          <div>
            {sectionHeader('Invoices', invRows.length)}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              {invRows.map((inv, i) => {
                const companyRaw = (inv as unknown as { company: { name: string }[] | { name: string } | null }).company
                const invCompany = Array.isArray(companyRaw) ? (companyRaw[0] ?? null) : companyRaw
                const isOverdue = !!(inv.due_date && inv.due_date < today && inv.status !== 'paid')
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="sr-row"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', textDecoration: 'none', color: 'var(--ink)',
                      fontFamily: 'var(--sans)', borderBottom: i < invRows.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 14, marginBottom: 2 }}>{inv.invoice_number}</div>
                      {invCompany && <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{invCompany.name}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {inv.due_date && (
                        <span style={{ fontSize: 12, color: isOverdue ? 'var(--danger)' : 'var(--ink-faint)', fontWeight: isOverdue ? 600 : 400 }}>
                          {fmtDate(inv.due_date)}
                        </span>
                      )}
                      {inv.amount != null && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtMoney(inv.amount)}</span>
                      )}
                      {statusChip(isOverdue ? 'overdue' : inv.status)}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
