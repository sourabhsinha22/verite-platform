'use client'

import { useRef, useEffect, useState } from 'react'
import SignaturePad from 'signature_pad'

interface Props {
  sowId: string
  onSigned: (pdfUrl: string) => void
  onClose: () => void
}

export default function SignatureModal({ sowId, onSigned, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    // High-DPI
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(ratio, ratio)

    const pad = new SignaturePad(canvas, { penColor: '#1a1a2e' })
    padRef.current = pad

    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty())
    })

    return () => { pad.off() }
  }, [])

  function handleClear() {
    padRef.current?.clear()
    setIsEmpty(true)
  }

  async function handleSign() {
    if (!padRef.current || padRef.current.isEmpty()) return
    setLoading(true)
    setError(null)
    const dataUrl = padRef.current.toDataURL('image/png')
    try {
      const res = await fetch(`/api/sow/${sowId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl: dataUrl }),
      })
      const json = await res.json() as { ok?: boolean; pdfUrl?: string; error?: string }
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Signing failed')
        setLoading(false)
        return
      }
      onSigned(json.pdfUrl ?? '')
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(20,30,60,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 32,
        width: 520,
        maxWidth: '94vw',
        boxShadow: '0 12px 60px rgba(0,0,0,0.22)',
        fontFamily: 'var(--sans)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
            Sign Statement of Work
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-faint)', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
          Draw your signature below. This will be embedded in the signed PDF.
        </p>

        <div style={{
          border: '1.5px solid var(--line)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 14,
          background: '#fdfcfb',
          position: 'relative',
        }}>
          <canvas
            ref={canvasRef}
            suppressHydrationWarning
            style={{ width: '100%', height: 160, display: 'block', cursor: 'crosshair' }}
          />
          {isEmpty && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink-faint)', fontSize: 13, pointerEvents: 'none',
            }}>
              Sign here
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleClear}
            style={{
              background: 'none', border: '1px solid var(--line)', borderRadius: 5,
              padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)',
            }}
          >
            Clear
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: '1px solid var(--line)', borderRadius: 5,
                padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSign}
              disabled={isEmpty || loading}
              style={{
                background: 'var(--wine)', color: '#fff', border: 'none',
                borderRadius: 5, padding: '7px 20px', fontSize: 13, fontWeight: 600,
                cursor: isEmpty || loading ? 'not-allowed' : 'pointer',
                opacity: isEmpty || loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Signing…' : 'Sign Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
