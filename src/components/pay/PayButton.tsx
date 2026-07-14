'use client'

import { useState } from 'react'

interface Props {
  invoiceId: string
  hasStripe: boolean
  invoiceNumber: string
}

export default function PayButton({ invoiceId, hasStripe, invoiceNumber }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Could not start checkout. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  if (!hasStripe) {
    return (
      <a
        href={`mailto:tana@veritehealth.com?subject=Payment for Invoice ${invoiceNumber}`}
        style={{
          display: 'inline-block', background: '#5f3e3f', color: '#fff',
          padding: '13px 32px', borderRadius: 5, textDecoration: 'none',
          fontSize: 15, fontWeight: 600, letterSpacing: '0.02em',
        }}
      >
        Contact Us to Pay
      </a>
    )
  }

  return (
    <div>
      {error && (
        <div style={{ background: '#ffeaea', border: '1px solid #f5c6c6', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#a13030' }}>
          {error}
        </div>
      )}
      <button
        onClick={handlePay}
        disabled={loading}
        style={{
          display: 'inline-block', background: loading ? '#9a7a7b' : '#5f3e3f', color: '#fff',
          padding: '13px 32px', borderRadius: 5, border: 'none',
          fontSize: 15, fontWeight: 600, letterSpacing: '0.02em',
          cursor: loading ? 'not-allowed' : 'pointer', width: '100%',
        }}
      >
        {loading ? 'Redirecting to checkout…' : 'Pay with Card →'}
      </button>
      <p style={{ fontSize: 11, color: '#9a9aa5', textAlign: 'center', marginTop: 10 }}>
        Secured by Stripe · All major cards accepted
      </p>
    </div>
  )
}
