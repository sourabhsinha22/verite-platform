'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [magicSent, setMagicSent] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      window.location.href = '/'
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } })
      if (error) { setError(error.message); setLoading(false); return }
      setMagicSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '42px', fontWeight: 600, color: 'var(--navy)', lineHeight: 1.1, marginBottom: '6px' }}>
            V<em>é</em>rit<em>é</em>
          </h1>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--wine)' }}>
            Health Collective
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '32px' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 600, color: 'var(--navy)', marginBottom: '6px' }}>
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: '13px', marginBottom: '24px' }}>
            {mode === 'sign-in' ? 'Access your Vérité workspace.' : 'Set up your Vérité account.'}
          </p>

          {magicSent ? (
            <div style={{ padding: '16px', background: 'var(--success-soft)', borderRadius: '6px', color: 'var(--success)', fontSize: '13px' }}>
              Check your email to confirm your account, then sign in.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--ink-soft)', marginBottom: '6px' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@veritehealth.com"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '6px', background: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--ink-soft)', marginBottom: '6px' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '6px', background: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: '14px', color: 'var(--ink)', outline: 'none' }}
                />
              </div>
              {error && (
                <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'var(--danger-soft)', borderRadius: '6px', color: 'var(--danger)', fontSize: '13px' }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '11px', background: 'var(--wine)', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'var(--sans)', fontSize: '14px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Loading…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          )}

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--ink-soft)' }}>
            {mode === 'sign-in' ? (
              <>Don&apos;t have an account?{' '}
                <button onClick={() => setMode('sign-up')} style={{ color: 'var(--wine)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => setMode('sign-in')} style={{ color: 'var(--wine)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>Sign in</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
