'use client'

import { useState } from 'react'

export default function PreparedFor() {
  const [value, setValue] = useState('')

  return (
    <div className="no-print" style={{ minWidth: 280 }}>
      <label style={{
        fontSize: 11,
        color: 'var(--ink-faint)',
        display: 'block',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        fontWeight: 600,
      }}>
        Prepared for
      </label>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="e.g. Partner Meeting, PHA Quarterly Review"
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid var(--line)',
          borderRadius: 6,
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {value && (
        <div className="print-only" style={{ display: 'none', fontSize: 14, color: 'var(--ink-soft)', marginTop: 4 }}>
          Prepared for: {value}
        </div>
      )}
    </div>
  )
}
