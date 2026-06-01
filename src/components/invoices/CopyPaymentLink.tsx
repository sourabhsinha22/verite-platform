'use client'

import { useState } from 'react'
import { Link } from 'lucide-react'

interface Props {
  invoiceId: string
}

export default function CopyPaymentLink({ invoiceId }: Props) {
  const [copied, setCopied] = useState(false)

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://verite-platform.vercel.app'}/pay/${invoiceId}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 4, fontSize: 13, fontWeight: 500,
        background: copied ? 'var(--success-soft)' : 'var(--surface)',
        color: copied ? 'var(--success)' : 'var(--ink-soft)',
        border: `1px solid ${copied ? 'rgba(45,106,62,0.3)' : 'var(--line)'}`,
        cursor: 'pointer', transition: 'all 0.15s',
        width: '100%', justifyContent: 'center',
        marginBottom: 8,
      }}
    >
      <Link size={13} />
      {copied ? 'Copied!' : 'Copy Payment Link'}
    </button>
  )
}
