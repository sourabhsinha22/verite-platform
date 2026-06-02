'use client'

import { useState } from 'react'

interface Props {
  onChange: (mode: 'forecast' | 'actual') => void
  value: 'forecast' | 'actual'
}

export default function PnLToggle({ onChange, value }: Props) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid var(--line)', overflow: 'hidden' }}>
      {(['forecast', 'actual'] as const).map(mode => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          style={{
            padding: '7px 18px',
            fontSize: 12,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            background: value === mode ? 'var(--navy)' : 'var(--surface)',
            color: value === mode ? '#fff' : 'var(--ink-soft)',
            transition: 'all 0.15s',
            textTransform: 'capitalize',
          }}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  )
}
