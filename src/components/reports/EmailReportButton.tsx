'use client'

interface Props {
  reportName: string
}

export default function EmailReportButton({ reportName }: Props) {
  function handleEmail() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const now = new Date()
    const dateStr = `${MO[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
    const subject = encodeURIComponent(`Vérité Health Collective — ${reportName}`)
    const body = encodeURIComponent(
      `Please find the ${reportName} at the following link:\n\n${url}\n\nGenerated on ${dateStr}.\n\nVérité Health Collective`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <button
      onClick={handleEmail}
      style={{
        background: 'none',
        border: '1px solid var(--line)',
        borderRadius: 5,
        padding: '7px 14px',
        fontSize: 13,
        cursor: 'pointer',
        color: 'var(--ink-soft)',
        fontFamily: 'var(--sans)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      ✉ Email Link
    </button>
  )
}
