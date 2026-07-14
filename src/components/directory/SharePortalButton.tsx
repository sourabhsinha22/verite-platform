'use client'

import { useState } from 'react'

export default function SharePortalButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const url = `${window.location.origin}/portal/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontSize: 12, border: '1px solid var(--line)', borderRadius: 5,
        padding: '6px 12px', background: copied ? 'var(--success-soft)' : 'none',
        cursor: 'pointer', color: copied ? 'var(--success)' : 'var(--ink-soft)',
        fontFamily: 'var(--sans)', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Link Copied' : '🔗 Share Portal'}
    </button>
  )
}
