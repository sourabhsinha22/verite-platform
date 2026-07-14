import LeadForm from '@/components/apply/LeadForm'

export const metadata = { title: 'Work With Us — Vérité Health Collective' }

export default function ApplyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#faf7f3', fontFamily: 'Georgia, serif' }}>
      {/* Header */}
      <div style={{ background: '#2f2e4b', padding: '32px 40px 28px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#e3bca6', marginBottom: 8 }}>Healthcare Consulting</div>
          <h1 style={{ fontSize: 36, fontWeight: 600, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>Vérité Health Collective</h1>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 40px 72px' }}>
        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 40, fontWeight: 600, color: '#25314a', margin: '0 0 16px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            Let&apos;s work together.
          </h2>
          <p style={{ fontSize: 16, color: '#5f5f6e', lineHeight: 1.8, margin: 0 }}>
            Whether you&apos;re looking to transform your care model, optimize revenue cycle, or launch an AI-powered education platform for your clinical team — we&apos;d love to hear from you.
          </p>
        </div>

        {/* Services */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
          {[
            { title: 'NouvelleED', desc: 'AI-powered CE education for clinical teams' },
            { title: 'Revenue Cycle', desc: 'Operations consulting and optimization' },
            { title: 'Care Model', desc: 'Clinical transformation and redesign' },
            { title: 'Sales & Growth', desc: 'Go-to-market strategy for health orgs' },
          ].map(s => (
            <div key={s.title} style={{ background: '#fff', border: '1px solid #ead9cd', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#5f3e3f', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#9a9aa5' }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ background: '#fff', border: '1px solid #ead9cd', borderRadius: 12, padding: '36px 40px' }}>
          <h3 style={{ fontSize: 24, fontWeight: 600, color: '#25314a', margin: '0 0 8px' }}>Tell us about your organization</h3>
          <p style={{ fontSize: 14, color: '#9a9aa5', margin: '0 0 28px' }}>We&apos;ll respond within 1 business day.</p>
          <LeadForm />
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#9a9aa5' }}>
            Vérité Health Collective · <a href="mailto:tana@veritehealth.com" style={{ color: '#5f3e3f' }}>tana@veritehealth.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
