export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Engagement, Sow, SowPhase, SowDeliverable } from '@/lib/types'
import PdfPrintButton from '@/components/reports/PdfPrintButton'

interface Props {
  params: Promise<{ id: string }>
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  return `$${Math.round(v).toLocaleString()}`
}

export default async function ProposalPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: engagement }, { data: sows }, { data: teamMembers }] = await Promise.all([
    supabase
      .from('engagements')
      .select('*, company:companies(id, name)')
      .eq('id', id)
      .single(),
    supabase
      .from('sows')
      .select('*, phases:sow_phases(*, deliverables:sow_deliverables(*)), deliverables:sow_deliverables(*)')
      .eq('engagement_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('team_members').select('id, name').order('name'),
  ])

  const sow: Sow | null = sows && sows.length > 0 ? sows[0] : null
  const eng = engagement as (Engagement & { company?: { id: string; name: string } }) | null

  if (!eng) {
    return (
      <div style={{ padding: 48, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
        Engagement not found.
      </div>
    )
  }

  const clientName = eng.company?.name ?? 'Client'
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  if (!sow) {
    return (
      <div style={{ padding: 48 }}>
        <Link href={`/engagements/${id}/sow`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-soft)', fontSize: 14, fontFamily: 'var(--sans)', textDecoration: 'none', marginBottom: 24 }}>
          ← Back to SOW
        </Link>
        <div style={{
          background: 'var(--warn-soft)',
          border: '1px solid var(--warn)',
          borderRadius: 8,
          padding: '20px 24px',
          fontFamily: 'var(--sans)',
          fontSize: 15,
          color: 'var(--warn)',
          maxWidth: 480,
        }}>
          Create a SOW first before generating a proposal.
        </div>
      </div>
    )
  }

  // Collect all deliverables
  const allDeliverables: (SowDeliverable & { phaseName?: string })[] = []
  const phases: SowPhase[] = sow.phases ?? []
  if (phases.length > 0) {
    for (const phase of phases) {
      for (const d of (phase.deliverables ?? [])) {
        allDeliverables.push({ ...d, phaseName: phase.title })
      }
    }
  } else {
    for (const d of (sow.deliverables ?? [])) {
      allDeliverables.push(d)
    }
  }

  const totalInvestment = sow.total_value
    ?? allDeliverables.reduce((s, d) => s + (d.payment_amount ?? 0), 0)
    ?? eng.contract_value
    ?? null

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--sans)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--wine)',
    marginBottom: 10,
    marginTop: 0,
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: 'var(--serif)',
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--navy)',
    margin: '0 0 14px',
    letterSpacing: '-0.2px',
  }

  const bodyText: React.CSSProperties = {
    fontFamily: 'var(--sans)',
    fontSize: 14,
    lineHeight: 1.75,
    color: 'var(--ink)',
    margin: 0,
  }

  const divider = (
    <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '32px 0' }} />
  )

  return (
    <>
      <title>Proposal — {clientName} — Vérité Health Collective</title>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #faf6f2 !important; }
        }
      `}</style>

      <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '40px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Print controls — hidden on print */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <Link
              href={`/engagements/${id}/sow`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-soft)', fontSize: 14, fontFamily: 'var(--sans)', textDecoration: 'none' }}
            >
              ← Back to SOW
            </Link>
            <div style={{ marginLeft: 'auto' }}>
              <PdfPrintButton />
            </div>
          </div>

          {/* Document */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: '52px 60px',
            boxShadow: '0 2px 24px rgba(37,49,74,0.08)',
          }}>
            {/* Letterhead */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.2 }}>
                  V<em style={{ color: 'var(--wine)', fontStyle: 'italic' }}>é</em>rit<em style={{ color: 'var(--wine)', fontStyle: 'italic' }}>é</em>
                  <span style={{ display: 'block', fontStyle: 'italic', color: 'var(--wine)', fontWeight: 500, fontSize: '22px' }}>
                    Health Collective
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-soft)' }}>{today}</div>
                {sow.verite_lead && (
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                    Prepared by: {sow.verite_lead}
                  </div>
                )}
              </div>
            </div>

            {/* Proposal heading */}
            <div style={{ marginBottom: 6 }}>
              <h1 style={{
                fontFamily: 'var(--serif)',
                fontSize: 48,
                fontWeight: 700,
                color: 'var(--wine)',
                margin: 0,
                letterSpacing: '-1px',
                lineHeight: 1,
              }}>
                PROPOSAL
              </h1>
              <p style={{
                fontFamily: 'var(--sans)',
                fontSize: 14,
                color: 'var(--ink-soft)',
                margin: '8px 0 0',
                fontStyle: 'italic',
              }}>
                Prepared exclusively for {clientName}
              </p>
            </div>

            {divider}

            {/* About Vérité */}
            <div style={{ marginBottom: 36 }}>
              <p style={sectionLabel}>About Vérité Health Collective</p>
              <p style={bodyText}>
                Vérité Health Collective is a healthcare consulting firm specializing in behavioral health integration, care model design, and clinical program development. We partner with healthcare organizations to build sustainable, revenue-generating programs. Our team brings hands-on clinical and operational experience to every engagement — not just advice, but real solutions.
              </p>
            </div>

            {divider}

            {/* Engagement overview */}
            <div style={{ marginBottom: 36 }}>
              <p style={sectionLabel}>Engagement Overview</p>
              <h2 style={sectionTitle}>{eng.name}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 0 }}>
                {[
                  { label: 'Engagement Type', value: eng.engagement_type?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—' },
                  { label: 'Proposed Start', value: fmtDate(eng.start_date ?? sow.effective_date) },
                  { label: 'Total Investment', value: totalInvestment ? fmtMoney(totalInvestment) : '—' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--line-soft)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontFamily: 'var(--sans)', marginBottom: 5 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', fontFamily: 'var(--sans)' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {divider}

            {/* What we'll deliver */}
            {allDeliverables.length > 0 && (
              <>
                <div style={{ marginBottom: 36 }}>
                  <p style={sectionLabel}>What We&apos;ll Deliver</p>
                  <h2 style={sectionTitle}>Deliverables</h2>
                  {phases.length > 0 ? (
                    phases.map(phase => {
                      const phaseDeliverables = allDeliverables.filter(d => d.phaseName === phase.title)
                      if (phaseDeliverables.length === 0) return null
                      return (
                        <div key={phase.id} style={{ marginBottom: 20 }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', marginBottom: 10 }}>
                            {phase.title}
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {phaseDeliverables.map(d => (
                              <li key={d.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <span style={{ color: 'var(--wine)', fontWeight: 700, fontSize: 14, flexShrink: 0, lineHeight: 1.75 }}>•</span>
                                <div>
                                  <span style={{ fontWeight: 600, fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)' }}>{d.title}</span>
                                  {d.description && (
                                    <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-soft)', marginLeft: 6 }}>
                                      — {d.description}
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {allDeliverables.map(d => (
                        <li key={d.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--wine)', fontWeight: 700, fontSize: 14, flexShrink: 0, lineHeight: 1.75 }}>•</span>
                          <div>
                            <span style={{ fontWeight: 600, fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)' }}>{d.title}</span>
                            {d.description && (
                              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-soft)', marginLeft: 6 }}>
                                — {d.description}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {divider}
              </>
            )}

            {/* Our approach */}
            {sow.objectives && (
              <>
                <div style={{ marginBottom: 36 }}>
                  <p style={sectionLabel}>Our Approach</p>
                  <h2 style={sectionTitle}>How We Work</h2>
                  {sow.objectives.split('\n').filter(Boolean).map((para, i) => (
                    <p key={i} style={{ ...bodyText, marginBottom: 12 }}>{para}</p>
                  ))}
                </div>
                {divider}
              </>
            )}

            {/* Investment & timeline */}
            {allDeliverables.length > 0 && (
              <>
                <div style={{ marginBottom: 36 }}>
                  <p style={sectionLabel}>Investment &amp; Timeline</p>
                  <h2 style={sectionTitle}>Milestones &amp; Fees</h2>
                  <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--line-soft)' }}>
                          {['Deliverable', 'Due Date', 'Investment'].map(h => (
                            <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allDeliverables.map((d, i) => (
                          <tr key={d.id} style={{ background: i % 2 === 0 ? '#fff' : '#fdfcfb', borderBottom: '1px solid var(--line-soft)' }}>
                            <td style={{ padding: '9px 14px', fontWeight: 500, color: 'var(--ink)' }}>{d.title || `Deliverable ${i + 1}`}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--ink-soft)' }}>{fmtDate(d.due_date)}</td>
                            <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--ink)' }}>{d.payment_amount ? fmtMoney(d.payment_amount) : '—'}</td>
                          </tr>
                        ))}
                        {totalInvestment != null && (
                          <tr style={{ background: 'var(--line-soft)', fontWeight: 700 }}>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--navy)' }} colSpan={2}>Total Investment</td>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--wine)', fontSize: 15 }}>{fmtMoney(totalInvestment)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {sow.payment_terms && (
                    <p style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
                      Payment terms: <strong style={{ color: 'var(--ink)' }}>{sow.payment_terms}</strong>
                      {sow.billing_frequency && ` · Billing: ${sow.billing_frequency}`}
                    </p>
                  )}
                </div>
                {divider}
              </>
            )}

            {/* Why Vérité */}
            <div style={{ marginBottom: 36 }}>
              <p style={sectionLabel}>Why Vérité</p>
              <h2 style={sectionTitle}>What Sets Us Apart</h2>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'Deep expertise in behavioral health integration (BHI, BHCM) programs — we\'ve built and scaled them ourselves.',
                  'Proven track record with healthcare systems across the US — from community health centers to regional health systems.',
                  'Dedicated team with direct accountability — not a staffing firm. You work with us, not through us.',
                ].map((point, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--wine)', fontWeight: 700, fontSize: 16, flexShrink: 0, lineHeight: 1.6 }}>•</span>
                    <p style={bodyText}>{point}</p>
                  </li>
                ))}
              </ul>
            </div>

            {divider}

            {/* Next steps */}
            <div style={{ marginBottom: 40 }}>
              <p style={sectionLabel}>Next Steps</p>
              <h2 style={sectionTitle}>Moving Forward</h2>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Review this proposal with your leadership team.',
                  'Sign the Statement of Work to confirm the engagement.',
                  `We begin within ${sow.effective_date ? fmtDate(sow.effective_date) : '2 weeks of signing'}.`,
                ].map((step, i) => (
                  <li key={i} style={{ fontFamily: 'var(--sans)', fontSize: 14, lineHeight: 1.75, color: 'var(--ink)' }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {divider}

            {/* Signature block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              {[
                { label: 'For Vérité Health Collective', name: sow.verite_signatory || 'Tana Whitt' },
                { label: `For ${clientName}`, name: sow.client_signatory || '_________________________' },
              ].map(sig => (
                <div key={sig.label}>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 24 }}>
                    {sig.label}
                  </div>
                  <div style={{ borderBottom: '1px solid var(--ink)', marginBottom: 8, height: 32 }} />
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                    {sig.name}
                  </div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>
                    Date: _____________________
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 48, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                Vérité Health Collective · Confidential &amp; Proprietary
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
