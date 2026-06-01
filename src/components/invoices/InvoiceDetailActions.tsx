'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Download } from 'lucide-react'

interface Props {
  invoiceId: string
  status: 'paid' | 'overdue' | 'open'
  isPaid: boolean
}

export default function InvoiceDetailActions({ invoiceId, status, isPaid }: Props) {
  const router = useRouter()
  const [marking, setMarking] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function markAsPaid() {
    setMarking(true)
    setError(null)
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)
    const { error: err } = await supabase
      .from('invoices')
      .update({ paid_date: today, status: 'paid' })
      .eq('id', invoiceId)
    setMarking(false)
    if (err) {
      setError(err.message)
    } else {
      setDone(true)
      router.refresh()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <a
        href={`/invoices/${invoiceId}/pdf`}
        target="_blank"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: 'var(--navy)',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 7,
          padding: '10px 18px',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--sans)',
        }}
      >
        <Download size={15} />
        Download PDF
      </a>

      {!isPaid && !done && (
        <button
          onClick={markAsPaid}
          disabled={marking}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--success)',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'var(--sans)',
            cursor: marking ? 'not-allowed' : 'pointer',
            opacity: marking ? 0.7 : 1,
          }}
        >
          <CheckCircle size={15} />
          {marking ? 'Saving…' : 'Mark as Paid'}
        </button>
      )}

      {done && (
        <div
          style={{
            background: 'var(--success-soft)',
            color: 'var(--success)',
            borderRadius: 7,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'var(--sans)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={15} />
          Marked as Paid
        </div>
      )}

      {error && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--danger)',
            fontFamily: 'var(--sans)',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
