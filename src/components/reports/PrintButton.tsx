'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print"
      style={{
        background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)',
        padding: '9px 16px', borderRadius: 4, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      <Printer size={14} /> Print / Save as PDF
    </button>
  )
}
