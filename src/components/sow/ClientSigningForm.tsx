'use client'

import { useRef, useEffect, useState } from 'react'
import SignaturePad from 'signature_pad'

interface Props {
  token: string
}

export default function ClientSigningForm({ token }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [clientName, setClientName] = useState('')
  const [isEmpty, setIsEmpty] = useState(true)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(ratio, ratio)

    const pad = new SignaturePad(canvas, { penColor: '#1a1a2e' })
    padRef.current = pad
    pad.addEventListener('endStroke', () => setIsEmpty(pad.isEmpty()))
    return () => { pad.off() }
  }, [])

  async function handleSign() {
    if (!clientName.trim() || !padRef.current || padRef.current.isEmpty()) return
    setLoading(true)
    setError(null)

    const dataUrl = padRef.current.toDataURL('image/png')
    try {
      const res = await fetch('/api/sow/client-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signatureDataUrl: dataUrl, clientName: clientName.trim() }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Signing failed')
        setLoading(false)
        return
      }
      setDone(true)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{
        background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10,
        padding: 32, textAlign: 'center', marginTop: 32,
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#166534', margin: '0 0 8px' }}>
          Document Signed Successfully
        </h3>
        <p style={{ color: '#15803d', fontSize: 14, margin: 0 }}>
          Thank you, {clientName}. A copy will be sent to you once processed.
        </p>
      </div>
    )
  }

  const disabled = !clientName.trim() || isEmpty || loading

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
        padding: 28, boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#1e2d4e', margin: '0 0 20px' }}>
          Sign this Document
        </h3>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>
            Your Full Name *
          </label>
          <input
            type="text"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Jane Smith"
            style={{
              border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 14px',
              fontSize: 15, width: '100%', outline: 'none', boxSizing: 'border-box',
              fontFamily: 'system-ui, sans-serif',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>
            Signature *
          </label>
          <div style={{
            border: '1.5px solid #d1d5db', borderRadius: 8, overflow: 'hidden',
            background: '#fafafa', position: 'relative',
          }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: 140, display: 'block', cursor: 'crosshair' }}
            />
            {isEmpty && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9ca3af', fontSize: 13, pointerEvents: 'none',
              }}>
                Draw your signature here
              </div>
            )}
          </div>
          <button
            onClick={() => { padRef.current?.clear(); setIsEmpty(true) }}
            style={{
              marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#6b7280', padding: 0,
            }}
          >
            Clear signature
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSign}
          disabled={disabled}
          style={{
            width: '100%', background: '#7c1425', color: '#fff',
            border: 'none', borderRadius: 7, padding: '12px 0',
            fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1, fontFamily: 'system-ui, sans-serif',
          }}
        >
          {loading ? 'Submitting…' : 'Sign Document'}
        </button>

        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12, textAlign: 'center' }}>
          By signing, you agree this constitutes a legally binding electronic signature.
        </p>
      </div>
    </div>
  )
}
