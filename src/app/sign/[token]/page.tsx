import { createAdminClient } from '@/lib/supabase/admin'
import ClientSigningForm from '@/components/sow/ClientSigningForm'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function SignPage({ params }: PageProps) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: sow } = await admin
    .from('sows')
    .select(`
      id, title, total_value, revenue_type, payment_terms, objectives,
      scope_of_work, client_signatory, status, client_signed_at,
      engagement:engagements(name, company:companies(name)),
      sow_phases(title, description)
    `)
    .eq('signing_token', token)
    .single()

  const cardStyle: React.CSSProperties = {
    maxWidth: 680,
    margin: '0 auto',
    padding: '0 20px 60px',
  }

  const headStyle: React.CSSProperties = {
    background: '#1e2d4e',
    color: '#fff',
    padding: '20px 32px',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engagement = sow?.engagement as any

  if (!sow || sow.status !== 'sent') {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <div style={headStyle}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600 }}>Vérité Health Collective</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>STATEMENT OF WORK</span>
        </div>
        <div style={cardStyle}>
          <div style={{ paddingTop: 80, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#1e2d4e', margin: '0 0 12px' }}>
              This link is invalid or has expired
            </h2>
            <p style={{ color: '#6b7280', fontSize: 15 }}>
              Please contact the sender for a new signing link.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (sow.client_signed_at) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <div style={headStyle}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600 }}>Vérité Health Collective</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>STATEMENT OF WORK</span>
        </div>
        <div style={cardStyle}>
          <div style={{ paddingTop: 80, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#166534', margin: '0 0 12px' }}>
              This document has already been signed. Thank you.
            </h2>
            <p style={{ color: '#6b7280', fontSize: 15 }}>
              Please reach out if you have any questions.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phases = (sow.sow_phases as any[]) ?? []
  const companyName = engagement?.company?.name ?? 'Client'
  const engagementName = engagement?.name ?? ''

  function fmtMoney(v: number | null | undefined): string {
    if (v == null) return '—'
    return `$${Math.round(v).toLocaleString()}`
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: 20,
  }
  const sectionHeadStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 6,
    fontFamily: 'system-ui, sans-serif',
  }
  const sectionBodyStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#374151',
    lineHeight: 1.65,
    fontFamily: 'system-ui, sans-serif',
    whiteSpace: 'pre-wrap',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={headStyle}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600 }}>Vérité Health Collective</span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>STATEMENT OF WORK</span>
      </div>

      <div style={cardStyle}>
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          marginTop: 32, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}>
          {/* Title block */}
          <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
              {companyName}{engagementName ? ` · ${engagementName}` : ''}
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#1e2d4e', margin: '0 0 16px' }}>
              {sow.title}
            </h1>

            {/* Key details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px 24px' }}>
              {[
                ['Total Value', fmtMoney(sow.total_value)],
                ['Revenue Type', sow.revenue_type ? sow.revenue_type.charAt(0).toUpperCase() + sow.revenue_type.slice(1) : '—'],
                ['Payment Terms', sow.payment_terms || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 14, color: '#1f2937', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Content sections */}
          <div style={{ padding: '24px 32px' }}>
            {sow.objectives?.trim() && (
              <div style={sectionStyle}>
                <div style={sectionHeadStyle}>Objectives</div>
                <div style={sectionBodyStyle}>{sow.objectives}</div>
              </div>
            )}
            {sow.scope_of_work?.trim() && (
              <div style={sectionStyle}>
                <div style={sectionHeadStyle}>Scope of Work</div>
                <div style={sectionBodyStyle}>{sow.scope_of_work}</div>
              </div>
            )}

            {phases.length > 0 && (
              <div style={sectionStyle}>
                <div style={sectionHeadStyle}>Phases</div>
                {phases.map((phase: { title: string; description: string }, i: number) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e2d4e', marginBottom: 4 }}>{phase.title}</div>
                    {phase.description && (
                      <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{phase.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sow.client_signatory && (
              <div style={{ ...sectionStyle, background: '#f9fafb', borderRadius: 7, padding: '12px 16px' }}>
                <div style={sectionHeadStyle}>Signing for Client</div>
                <div style={{ fontSize: 14, color: '#1f2937' }}>{sow.client_signatory}</div>
              </div>
            )}
          </div>
        </div>

        <ClientSigningForm token={token} />
      </div>
    </div>
  )
}
