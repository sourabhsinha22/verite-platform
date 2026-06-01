'use client'

export default function PdfPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: '#5f3e3f',
        color: '#fff',
        border: 'none',
        borderRadius: 5,
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif',
        cursor: 'pointer',
      }}
    >
      Print / Save as PDF
    </button>
  )
}
