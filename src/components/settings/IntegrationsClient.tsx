'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface WebhookEvent {
  id: string
  created_at: string
  event_type: string
  contact_email: string | null
  contact_name: string | null
  result: string | null
}

interface Integration {
  id: string
  provider: string
  api_key: string | null
  webhook_secret: string | null
  last_sync_at: string | null
  is_connected: boolean
}

interface Props {
  integration: Integration | null
  recentEvents: WebhookEvent[]
  activeTab?: string
  stripeConfigured?: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

export default function IntegrationsClient({ integration, recentEvents, activeTab = 'apollo', stripeConfigured = false }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [apiKey, setApiKey] = useState('')
  const [revealKey, setRevealKey] = useState(false)
  const [webhookSecret, setWebhookSecret] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [savingSecret, setSavingSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveSecretMsg, setSaveSecretMsg] = useState<string | null>(null)
  const [copyMsg, setCopyMsg] = useState(false)

  const webhookUrl = 'https://verite-platform.vercel.app/api/webhooks/apollo'
  const isConnected = integration?.is_connected ?? false

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return
    setSavingKey(true)
    setSaveMsg(null)
    if (integration?.id) {
      await supabase.from('integrations').update({ api_key: apiKey.trim(), is_connected: true }).eq('id', integration.id)
    } else {
      await supabase.from('integrations').insert({ provider: 'apollo', api_key: apiKey.trim(), is_connected: true })
    }
    setSavingKey(false)
    setApiKey('')
    setSaveMsg('API key saved.')
    setTimeout(() => setSaveMsg(null), 3000)
  }

  const handleSaveSecret = async () => {
    if (!webhookSecret.trim()) return
    setSavingSecret(true)
    setSaveSecretMsg(null)
    if (integration?.id) {
      await supabase.from('integrations').update({ webhook_secret: webhookSecret.trim() }).eq('id', integration.id)
    } else {
      await supabase.from('integrations').insert({ provider: 'apollo', webhook_secret: webhookSecret.trim() })
    }
    setSavingSecret(false)
    setWebhookSecret('')
    setSaveSecretMsg('Webhook secret saved.')
    setTimeout(() => setSaveSecretMsg(null), 3000)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/apollo/test')
      const json = await res.json()
      if (json.ok && json.healthy) {
        setTestResult({ ok: true, message: 'Connection successful — Apollo API is healthy.' })
      } else {
        setTestResult({ ok: false, message: json.error ?? 'Connection failed.' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Network error — could not reach API.' })
    }
    setTesting(false)
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopyMsg(true)
      setTimeout(() => setCopyMsg(false), 2000)
    })
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
    background: 'var(--bg)', border: '1px solid var(--line)',
    borderRadius: 4, padding: '8px 10px', width: '100%',
    boxSizing: 'border-box', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.14em',
    marginBottom: 6, display: 'block',
  }

  const btnStyle: React.CSSProperties = {
    background: 'var(--wine)', color: '#fff',
    border: 'none', borderRadius: 4,
    padding: '8px 16px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 8, padding: '24px 28px', marginBottom: 20,
  }

  const dividerStyle: React.CSSProperties = {
    borderTop: '1px solid var(--line-soft)', margin: '20px 0',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', fontSize: 13, fontWeight: active ? 600 : 500,
    textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none',
    color: active ? 'var(--wine)' : 'var(--ink-soft)',
    borderBottom: active ? '2px solid var(--wine)' : '2px solid transparent',
    marginBottom: -2, display: 'inline-block', fontFamily: 'var(--sans)',
  })

  if (activeTab === 'stripe') {
    return (
      <div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--line)', marginBottom: 32 }}>
          <button onClick={() => router.push('/settings/integrations?tab=apollo')} style={tabStyle(false)}>Apollo.io</button>
          <button onClick={() => router.push('/settings/integrations?tab=stripe')} style={tabStyle(true)}>Stripe</button>
          <button onClick={() => router.push('/settings/integrations?tab=calendly')} style={tabStyle(false)}>Calendly</button>
        </div>

        {/* Stripe status */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#635bff', fontFamily: 'var(--sans)' }}>Stripe</span>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: stripeConfigured ? 'rgba(34,197,94,0.12)' : 'var(--line-soft)',
                color: stripeConfigured ? 'var(--success)' : 'var(--ink-faint)',
                border: `1px solid ${stripeConfigured ? 'rgba(34,197,94,0.3)' : 'var(--line)'}`,
              }}>
                {stripeConfigured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '14px 0 0', lineHeight: 1.6 }}>
            Stripe enables online card payments directly from your invoice portal at <code style={{ background: 'var(--line-soft)', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>/pay/[invoiceId]</code>. When a client pays, the invoice is automatically marked as paid.
          </p>
        </div>

        {/* Setup instructions */}
        <div style={sectionStyle}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: '0 0 16px' }}>Setup Instructions</h3>
          <div style={{ background: 'var(--line-soft)', border: '1px solid var(--line)', borderRadius: 6, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>Add these environment variables in Vercel:</p>
            <ol style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0, paddingLeft: 18, lineHeight: 2 }}>
              <li>Go to <strong>vercel.com → verite-platform → Settings → Environment Variables</strong></li>
              <li>Add <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>STRIPE_SECRET_KEY</code> → your Stripe secret key (starts with <code>sk_live_</code> or <code>sk_test_</code>)</li>
              <li>Add <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> → your Stripe publishable key (starts with <code>pk_live_</code> or <code>pk_test_</code>)</li>
              <li>Add <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>STRIPE_WEBHOOK_SECRET</code> → from Stripe dashboard after creating the webhook</li>
              <li>Redeploy the platform for changes to take effect</li>
            </ol>
          </div>

          <div style={{ background: 'var(--line-soft)', border: '1px solid var(--line)', borderRadius: 6, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>Set up the Stripe Webhook:</p>
            <ol style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0, paddingLeft: 18, lineHeight: 2 }}>
              <li>Go to <strong>dashboard.stripe.com → Developers → Webhooks</strong></li>
              <li>Click <strong>"Add endpoint"</strong></li>
              <li>Endpoint URL: <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>https://verite-platform.vercel.app/api/webhooks/stripe</code></li>
              <li>Select event: <strong>checkout.session.completed</strong></li>
              <li>Copy the signing secret → add as <code>STRIPE_WEBHOOK_SECRET</code> in Vercel</li>
            </ol>
          </div>

          <div style={{ background: 'var(--success-soft)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '14px 18px' }}>
            <p style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, margin: 0 }}>
              ✓ Recommendation: Start with Stripe test keys (<code>sk_test_</code>) to verify everything works before switching to live keys.
            </p>
          </div>
        </div>

        {/* Keys reference */}
        <div style={sectionStyle}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: '0 0 16px' }}>Environment Variables</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Variable', 'Purpose', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'STRIPE_SECRET_KEY', purpose: 'Creates checkout sessions (server-side only)', required: true },
                { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', purpose: 'Shows Pay button on invoice portal', required: true },
                { key: 'STRIPE_WEBHOOK_SECRET', purpose: 'Verifies webhook events from Stripe', required: false },
              ].map((row, i) => (
                <tr key={row.key} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--ink)' }}>{row.key}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--ink-soft)', fontSize: 12 }}>{row.purpose}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: row.required ? 'var(--danger-soft)' : 'var(--line-soft)', color: row.required ? 'var(--danger)' : 'var(--ink-faint)' }}>
                      {row.required ? 'Required' : 'Recommended'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (activeTab === 'calendly') {
    return (
      <div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--line)', marginBottom: 32 }}>
          <button onClick={() => router.push('/settings/integrations?tab=apollo')} style={tabStyle(false)}>Apollo.io</button>
          <button onClick={() => router.push('/settings/integrations?tab=stripe')} style={tabStyle(false)}>Stripe</button>
          <button onClick={() => router.push('/settings/integrations?tab=calendly')} style={tabStyle(true)}>Calendly</button>
        </div>
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#006bff', fontFamily: 'var(--sans)' }}>Calendly</span>
            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>
              Webhook Active
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
            When a prospect books a call via Calendly, their engagement is automatically moved to <strong>Qualified</strong>, an activity log entry is created, and the lead partner receives an instant email alert.
          </p>
        </div>
        <div style={sectionStyle}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: '0 0 16px' }}>Webhook URL</h3>
          <div style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--line-soft)', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 14px', marginBottom: 12 }}>
            https://verite-platform.vercel.app/api/webhooks/calendly
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>
            Add this URL in <strong>Calendly → Integrations → Webhooks → Subscribe to event: invitee.created</strong>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--line)', marginBottom: 32 }}>
        <button onClick={() => router.push('/settings/integrations?tab=apollo')} style={tabStyle(true)}>Apollo.io</button>
        <button onClick={() => router.push('/settings/integrations?tab=stripe')} style={tabStyle(false)}>
          Stripe {stripeConfigured && <span style={{ marginLeft: 4, fontSize: 9, background: 'var(--success)', color: '#fff', borderRadius: 10, padding: '1px 5px' }}>✓</span>}
        </button>
        <button onClick={() => router.push('/settings/integrations?tab=calendly')} style={tabStyle(false)}>Calendly</button>
      </div>

      {/* Header row */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--wine)', fontFamily: 'var(--sans)' }}>Apollo.io</span>
            <span style={{
              display: 'inline-block',
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: isConnected ? 'rgba(34,197,94,0.12)' : 'var(--line-soft)',
              color: isConnected ? 'var(--success)' : 'var(--ink-faint)',
              border: `1px solid ${isConnected ? 'rgba(34,197,94,0.3)' : 'var(--line)'}`,
            }}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            style={{
              background: 'transparent', color: 'var(--navy)',
              border: '1px solid var(--line)', borderRadius: 4,
              padding: '7px 14px', fontSize: 12, fontWeight: 500,
              cursor: testing ? 'not-allowed' : 'pointer',
              opacity: testing ? 0.7 : 1,
            }}
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>

        {testResult && (
          <div style={{
            marginTop: 14, padding: '8px 12px', borderRadius: 4, fontSize: 13,
            background: testResult.ok ? 'rgba(34,197,94,0.08)' : 'var(--danger-soft)',
            color: testResult.ok ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)'}`,
          }}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* API Key */}
      <div style={sectionStyle}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: '0 0 16px' }}>API Key</h3>

        {integration?.api_key && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Current Key</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                fontFamily: 'monospace', fontSize: 13, color: 'var(--ink-soft)',
                background: 'var(--line-soft)', border: '1px solid var(--line)',
                borderRadius: 4, padding: '8px 12px', flex: 1, letterSpacing: '0.1em',
              }}>
                {revealKey ? integration.api_key : '••••••••••••••••••••'}
              </div>
              <button
                onClick={() => setRevealKey(r => !r)}
                style={{
                  background: 'transparent', border: '1px solid var(--line)', color: 'var(--navy)',
                  borderRadius: 4, padding: '7px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0,
                }}
              >
                {revealKey ? 'Hide' : 'Reveal'}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{integration?.api_key ? 'Update API Key' : 'API Key'}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              placeholder={integration?.api_key ? 'Enter new key to replace…' : 'Paste your Apollo API key…'}
            />
            <button
              onClick={handleSaveKey}
              disabled={savingKey || !apiKey.trim()}
              style={{ ...btnStyle, opacity: savingKey || !apiKey.trim() ? 0.6 : 1, cursor: savingKey || !apiKey.trim() ? 'not-allowed' : 'pointer' }}
            >
              {savingKey ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {saveMsg && (
          <div style={{ fontSize: 12, color: 'var(--success)', marginBottom: 8 }}>{saveMsg}</div>
        )}

        <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0, marginTop: 8 }}>
          Find your API key at <strong>app.apollo.io → Settings → Integrations → API</strong>
        </p>
      </div>

      {/* Webhook Configuration */}
      <div style={sectionStyle}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: '0 0 16px' }}>Webhook Configuration</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Webhook URL</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              fontFamily: 'monospace', fontSize: 12, color: 'var(--ink)',
              background: 'var(--line-soft)', border: '1px solid var(--line)',
              borderRadius: 4, padding: '9px 12px', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {webhookUrl}
            </div>
            <button
              onClick={handleCopyUrl}
              style={{
                background: 'transparent', border: '1px solid var(--line)', color: 'var(--navy)',
                borderRadius: 4, padding: '7px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0,
              }}
            >
              {copyMsg ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div style={{
          background: 'var(--line-soft)', border: '1px solid var(--line)',
          borderRadius: 6, padding: '14px 16px', marginBottom: 20,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>Configure this URL in Apollo.io:</p>
          <ol style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Go to <strong>Apollo.io → Settings → Integrations → Webhooks</strong></li>
            <li>Click <strong>"Add Subscription"</strong></li>
            <li>Paste the URL above</li>
            <li>Select events: <strong>Email Replied, Email Clicked, Meeting Booked</strong></li>
            <li>Copy the webhook secret and paste below</li>
          </ol>
        </div>

        <div style={dividerStyle} />

        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Webhook Secret</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              autoComplete="new-password"
              value={webhookSecret}
              onChange={e => setWebhookSecret(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              placeholder={integration?.webhook_secret ? '••••••••••••••• (set — paste to update)' : 'Paste webhook secret from Apollo.io…'}
            />
            <button
              onClick={handleSaveSecret}
              disabled={savingSecret || !webhookSecret.trim()}
              style={{ ...btnStyle, opacity: savingSecret || !webhookSecret.trim() ? 0.6 : 1, cursor: savingSecret || !webhookSecret.trim() ? 'not-allowed' : 'pointer' }}
            >
              {savingSecret ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {saveSecretMsg && (
          <div style={{ fontSize: 12, color: 'var(--success)', marginBottom: 8 }}>{saveSecretMsg}</div>
        )}

        <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0, marginTop: 8 }}>
          The webhook secret verifies that events are genuinely from Apollo.io
        </p>
      </div>

      {/* Event mapping table */}
      <div style={sectionStyle}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: '0 0 16px' }}>Sequence → Pipeline Mapping</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Apollo Event', 'Pipeline Stage', 'What Happens'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px', fontSize: 10,
                    color: 'var(--wine)', textTransform: 'uppercase',
                    letterSpacing: '0.18em', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { event: 'Email Replied', stage: 'Engaged', what: 'Lead created or updated to Engaged' },
                { event: 'Email Clicked', stage: 'Engaged', what: 'Lead created or updated to Engaged' },
                { event: 'Meeting Booked', stage: 'Qualified', what: 'Lead updated to Qualified, task created' },
                { event: 'Sequence Finished (no reply)', stage: '—', what: 'Lead marked as Cold (notes updated)' },
              ].map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <td style={{ padding: '11px 14px', color: 'var(--ink)', fontFamily: 'var(--sans)' }}>{row.event}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {row.stage !== '—' ? (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: 'var(--line-soft)', color: 'var(--navy)',
                        border: '1px solid var(--line)',
                      }}>{row.stage}</span>
                    ) : (
                      <span style={{ color: 'var(--ink-faint)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--ink-soft)' }}>{row.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Last sync + recent events */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Recent Webhook Events</h3>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            Last webhook received:{' '}
            <strong style={{ color: 'var(--ink-soft)' }}>
              {integration?.last_sync_at ? fmtDateTime(integration.last_sync_at) : 'Never'}
            </strong>
          </span>
        </div>

        {recentEvents.length === 0 ? (
          <div style={{
            padding: '24px 0', textAlign: 'center',
            color: 'var(--ink-faint)', fontSize: 13,
            border: '1px dashed var(--line)', borderRadius: 6,
          }}>
            No webhook events received yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)', borderBottom: '1px solid var(--line)' }}>
                {['Time', 'Event Type', 'Contact', 'Result'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '9px 14px', fontSize: 10,
                    color: 'var(--wine)', textTransform: 'uppercase',
                    letterSpacing: '0.18em', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((evt, i) => (
                <tr key={evt.id} style={{ borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
                  <td style={{ padding: '10px 14px', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                    {fmtDateTime(evt.created_at)}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-soft)' }}>
                    {evt.event_type}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--ink)' }}>
                    {evt.contact_name ?? evt.contact_email ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: evt.result === 'ok' ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 500 }}>
                    {evt.result ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
