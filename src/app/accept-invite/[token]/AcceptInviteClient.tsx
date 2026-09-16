'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  token: string
  inviteEmail: string
  role: string
  orgName: string
  productName: string
  primary: string
  accent: string
  isLoggedIn: boolean
  loggedInEmail: string | null
}

export default function AcceptInviteClient({
  token, inviteEmail, role, orgName, productName, primary, accent, isLoggedIn, loggedInEmail,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<'confirm' | 'signup' | 'done'>('confirm')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: 14,
    border: '1px solid #d4d0c8', borderRadius: 6, fontFamily: 'system-ui',
    background: '#fff', color: '#1a1a2e', outline: 'none',
  }

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '12px', background: accent, color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
    fontFamily: 'system-ui',
  }

  const acceptViaApi = async () => {
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name }),
    })
    return res.ok
  }

  // Case 1: already logged in as the invited email
  const handleLoggedInAccept = async () => {
    setLoading(true)
    setError('')
    const ok = await acceptViaApi()
    setLoading(false)
    if (ok) { setStep('done'); setTimeout(() => router.push('/dashboard'), 1500) }
    else setError('Failed to accept invite. Please try again.')
  }

  // Case 2: not logged in — create account + accept
  const handleSignup = async () => {
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!name.trim()) { setError('Please enter your name.'); return }
    setLoading(true)
    setError('')
    const { error: signUpError } = await supabase.auth.signUp({ email: inviteEmail, password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    const ok = await acceptViaApi()
    setLoading(false)
    if (ok) { setStep('done'); setTimeout(() => router.push('/dashboard'), 1500) }
    else setError('Account created but invite acceptance failed. Contact your admin.')
  }

  if (step === 'done') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7' }}>
        <div style={{ textAlign: 'center', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: primary }}>Welcome to {orgName}!</h2>
          <p style={{ color: '#5f5f6e' }}>Redirecting you to the dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', fontFamily: 'system-ui' }}>
      <div style={{ width: '100%', maxWidth: 440, padding: '48px 40px', background: '#fff', border: '1px solid #e8e4de', borderRadius: 12 }}>
        {/* Header */}
        <div style={{ borderBottom: `2px solid ${accent}`, paddingBottom: 16, marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 600, color: primary, margin: 0 }}>{productName}</h1>
          <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, margin: '4px 0 0' }}>Team Invitation</p>
        </div>

        <p style={{ fontSize: 15, color: '#25314a', marginBottom: 4 }}>
          You've been invited to join <strong>{orgName}</strong> as a <strong>{role}</strong>.
        </p>
        <p style={{ fontSize: 13, color: '#5f5f6e', marginBottom: 28 }}>
          Invite sent to: <strong>{inviteEmail}</strong>
        </p>

        {isLoggedIn && loggedInEmail === inviteEmail ? (
          // Already logged in as correct user — one-click accept
          <>
            <p style={{ fontSize: 14, color: '#5f5f6e', marginBottom: 20 }}>
              You're signed in as <strong>{loggedInEmail}</strong>. Click below to accept.
            </p>
            {error && <div style={{ marginBottom: 14, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: '#b91c1c' }}>{error}</div>}
            <button onClick={handleLoggedInAccept} disabled={loading} style={btnStyle}>
              {loading ? 'Accepting…' : 'Accept Invitation'}
            </button>
          </>
        ) : step === 'confirm' ? (
          // Not logged in — offer sign up
          <>
            <p style={{ fontSize: 14, color: '#5f5f6e', marginBottom: 20 }}>
              Create your account to get started.
            </p>
            <button onClick={() => setStep('signup')} style={btnStyle}>
              Set Up Account
            </button>
          </>
        ) : (
          // Sign up form
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5f5f6e', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Your Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5f5f6e', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Email</label>
              <input value={inviteEmail} disabled style={{ ...inputStyle, background: '#f5f5f5', color: '#888' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5f5f6e', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" style={inputStyle} />
            </div>
            {error && <div style={{ marginBottom: 14, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: '#b91c1c' }}>{error}</div>}
            <button onClick={handleSignup} disabled={loading} style={btnStyle}>
              {loading ? 'Creating account…' : 'Create Account & Join'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
