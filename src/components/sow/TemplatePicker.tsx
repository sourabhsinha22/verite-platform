'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface SowTemplate {
  id: string
  name: string
  description: string
  engagement_type: string
  phases: { title: string; description: string; duration_weeks: number }[]
}

interface Props {
  templates: SowTemplate[]
  engagementId: string
}

const ENGAGEMENT_TYPE_LABELS: Record<string, string> = {
  'project-based': 'Project-Based',
  'sales-growth': 'Sales & Growth',
  'care-model': 'Care Model',
  'opportunity': 'Opportunity',
  'retainer': 'Retainer',
}

export default function TemplatePicker({ templates, engagementId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function startFromTemplate(templateId: string | null) {
    const key = templateId ?? 'blank'
    setLoading(key)
    const body: Record<string, string> = { engagement_id: engagementId }
    if (templateId) body.template_id = templateId

    const res = await fetch('/api/sow/from-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.refresh()
    } else {
      setLoading(null)
      alert('Failed to create SOW. Please try again.')
    }
  }

  const chipStyle = (type: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    fontFamily: 'var(--sans)',
    background: type === 'care-model' ? '#e8dff0' : type === 'sales-growth' ? '#d8e8f0' : '#ece3dd',
    color: type === 'care-model' ? '#5a3a6e' : type === 'sales-growth' ? '#2a5a6e' : '#6b5b50',
  })

  return (
    <>
      <style>{`
        .tmpl-card {
          border: 1px solid #e6ddd4;
          border-radius: 8px;
          padding: 20px;
          background: #fff;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
        }
        .tmpl-card:hover {
          box-shadow: 0 4px 16px rgba(37,49,74,0.10);
          transform: translateY(-2px);
          border-color: var(--wine);
        }
        .tmpl-card.loading {
          opacity: 0.6;
          pointer-events: none;
        }
        .tmpl-blank {
          border: 1px dashed #c4b8ac;
          border-radius: 8px;
          padding: 20px;
          background: #faf9f7;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 100px;
        }
        .tmpl-blank:hover {
          box-shadow: 0 4px 16px rgba(37,49,74,0.08);
          transform: translateY(-2px);
          border-color: var(--navy);
        }
        .tmpl-blank.loading {
          opacity: 0.6;
          pointer-events: none;
        }
      `}</style>

      <div style={{ maxWidth: 760 }}>
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--navy)',
            margin: '0 0 6px',
          }}
        >
          Start from a Template
        </h2>
        <p
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 14,
            color: 'var(--ink-soft)',
            margin: '0 0 28px',
          }}
        >
          Choose a pre-built template to get started quickly, or start from a blank SOW.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          {templates.map(t => (
            <div
              key={t.id}
              className={`tmpl-card${loading === t.id ? ' loading' : ''}`}
              onClick={() => startFromTemplate(t.id)}
            >
              <div
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--navy)',
                  marginBottom: 6,
                  lineHeight: 1.3,
                }}
              >
                {loading === t.id ? 'Creating…' : t.name}
              </div>
              <p
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 13,
                  color: 'var(--ink-soft)',
                  margin: '0 0 12px',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                }}
              >
                {t.description}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={chipStyle(t.engagement_type)}>
                  {ENGAGEMENT_TYPE_LABELS[t.engagement_type] ?? t.engagement_type}
                </span>
                {Array.isArray(t.phases) && t.phases.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-faint)',
                      fontFamily: 'var(--sans)',
                    }}
                  >
                    {t.phases.length} phase{t.phases.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Blank option */}
          <div
            className={`tmpl-blank${loading === 'blank' ? ' loading' : ''}`}
            onClick={() => startFromTemplate(null)}
          >
            <span style={{ fontSize: 22, color: 'var(--ink-faint)' }}>+</span>
            <div>
              <div
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              >
                {loading === 'blank' ? 'Creating…' : 'Start from blank'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  color: 'var(--ink-faint)',
                  marginTop: 2,
                }}
              >
                Empty SOW — fill in everything yourself
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
