'use client'

import { useState } from 'react'
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
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

export default function IntegrationsClient({ integration, recentEvents }: Props) {
  const supabase = createClient()

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

  return (
    <div>
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
