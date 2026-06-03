'use client'

import { useState, useRef, useEffect } from 'react'

interface ApolloSequence {
  id: string
  name: string
  status: string
}

interface Props {
  sequences: ApolloSequence[]
  teamMembers: { id: string; name: string }[]
}

interface ApolloOrganization {
  name?: string
}

interface ApolloContact {
  id: string
  name: string
  first_name?: string
  last_name?: string
  title?: string
  email?: string
  organization_name?: string
  organization?: ApolloOrganization
  city?: string
  state?: string
  country?: string
  linkedin_url?: string
}

interface FormState {
  titles: string
  keywords: string
  locations: string
  companySize: string
}

interface Pagination {
  page: number
  total_entries: number
  per_page: number
}

const TEMPLATES = [
  {
    label: 'PMHNP Program Directors',
    person_titles: ['PMHNP Program Director', 'Graduate Medical Education Director', 'GME Director', 'Program Coordinator', 'Director of Medical Education'],
    q_keywords: 'PMHNP psychiatric nursing residency behavioral health',
    person_locations: ['Washington', 'California', 'New York', 'Texas'],
  },
  {
    label: 'Nursing Education Directors',
    person_titles: ['Director of Nursing Education', 'Chief Nursing Education Officer', 'CNE', 'Director of Clinical Education', 'Nursing Education Manager'],
    q_keywords: 'nursing education ANCC competency clinical training',
    person_locations: ['Washington', 'California', 'New York', 'Texas'],
  },
  {
    label: 'BH Compliance & Quality',
    person_titles: ['Behavioral Health Education Manager', 'Quality Manager', 'Compliance Director', 'Clinical Education Specialist', 'Competency Coordinator'],
    q_keywords: 'behavioral health compliance TJC competency documentation',
    person_locations: ['Washington', 'California', 'New York', 'Texas'],
  },
  {
    label: 'CNO / CMO Targets',
    person_titles: ['Chief Nursing Officer', 'Chief Medical Officer', 'VP Clinical Operations', 'VP Medical Education', 'Chief Learning Officer'],
    q_keywords: 'healthcare clinical education workforce development',
    person_locations: ['Washington', 'California', 'New York', 'Texas'],
  },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getOrgName(person: ApolloContact): string {
  return person.organization_name ?? person.organization?.name ?? ''
}

function getLocation(person: ApolloContact): string {
  return [person.city, person.state].filter(Boolean).join(', ')
}

export default function ProspectSearch({ sequences, teamMembers: _teamMembers }: Props) {
  const [formState, setFormState] = useState<FormState>({
    titles: '',
    keywords: '',
    locations: '',
    companySize: '',
  })
  const [results, setResults] = useState<ApolloContact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [selectedSequence, setSelectedSequence] = useState('')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total_entries: 0, per_page: 25 })
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [sequenceLoading, setSequenceLoading] = useState<string | null>(null)
  const [sequenceAdded, setSequenceAdded] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = async (overrideParams?: Partial<FormState>, overridePage?: number) => {
    setLoading(true)
    setError('')
    setHasSearched(true)
    const params = { ...formState, ...overrideParams }
    const page = overridePage ?? 1
    const body: Record<string, unknown> = {
      page,
      per_page: 25,
      person_titles: params.titles.split(',').map(t => t.trim()).filter(Boolean),
      q_keywords: params.keywords || undefined,
      person_locations: params.locations.split(',').map(l => l.trim()).filter(Boolean),
    }
    try {
      const resp = await fetch('/api/apollo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await resp.json()
      if (!resp.ok) {
        const errMsg = data.error ?? 'Search failed'
        if (errMsg.toLowerCase().includes('not connected') || errMsg.toLowerCase().includes('api key')) {
          setError('not_connected')
        } else {
          setError(errMsg)
        }
        setLoading(false)
        return
      }
      if (page === 1) {
        setResults(data.people ?? [])
      } else {
        setResults(prev => [...prev, ...(data.people ?? [])])
      }
      setPagination({ page, total_entries: data.pagination?.total_entries ?? 0, per_page: 25 })
    } catch {
      setError('Apollo search unavailable. Check your API key in Settings → Integrations.')
    }
    setLoading(false)
  }

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    const newForm: FormState = {
      titles: tpl.person_titles.join(', '),
      keywords: tpl.q_keywords,
      locations: tpl.person_locations.join(', '),
      companySize: '',
    }
    setFormState(newForm)
    setActiveTemplate(tpl.label)
    search(newForm, 1)
  }

  const addToPipeline = async (person: ApolloContact) => {
    await fetch('/api/webhooks/apollo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_email: person.email ?? '',
        contact_name: person.name,
        contact_title: person.title ?? '',
        company_name: getOrgName(person),
        sequence_name: activeTemplate ?? 'Manual Search',
        sequence_id: 'manual_search',
        event_type: 'emailer_campaign.contact_replied',
        zapier_source: 'true',
      }),
    })
    setAddedIds(prev => new Set([...prev, person.id]))
  }

  const addToSequence = async (person: ApolloContact, seqId: string) => {
    const key = `${person.id}::${seqId}`
    setSequenceLoading(key)
    setOpenDropdownId(null)
    try {
      await fetch('/api/apollo/add-to-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: person.id, sequence_id: seqId, email: person.email ?? '' }),
      })
      setSequenceAdded(prev => new Set([...prev, person.id]))
    } finally {
      setSequenceLoading(null)
    }
  }

  const loadMore = () => {
    search(undefined, pagination.page + 1)
  }

  const totalPages = Math.ceil(pagination.total_entries / pagination.per_page)
  const hasMore = pagination.page < totalPages

  // Styles
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--line)',
    borderRadius: 6,
    fontSize: 13,
    color: 'var(--ink)',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ink-soft)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: 5,
    display: 'block',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '9px 20px',
    background: 'var(--indigo)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    whiteSpace: 'nowrap',
  }

  const btnOutline: React.CSSProperties = {
    padding: '6px 12px',
    background: '#fff',
    color: 'var(--indigo)',
    border: '1px solid var(--line)',
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  const btnGhost: React.CSSProperties = {
    padding: '6px 10px',
    background: 'transparent',
    color: 'var(--ink-soft)',
    border: '1px solid var(--line)',
    borderRadius: 5,
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Search Templates */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>
          Search Templates
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.label}
              onClick={() => applyTemplate(tpl)}
              style={{
                padding: '7px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: '1.5px solid',
                borderColor: activeTemplate === tpl.label ? 'var(--indigo)' : 'var(--line)',
                background: activeTemplate === tpl.label ? 'var(--indigo)' : '#fff',
                color: activeTemplate === tpl.label ? '#fff' : 'var(--ink)',
                transition: 'all 0.15s',
              }}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Form */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: '20px 24px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Job Titles</label>
            <input
              style={inputStyle}
              placeholder="Director of Nursing Education, CNO..."
              value={formState.titles}
              onChange={e => setFormState(p => ({ ...p, titles: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Keywords</label>
            <input
              style={inputStyle}
              placeholder="behavioral health, PMHNP, clinical training..."
              value={formState.keywords}
              onChange={e => setFormState(p => ({ ...p, keywords: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input
              style={inputStyle}
              placeholder="Washington, California, New York..."
              value={formState.locations}
              onChange={e => setFormState(p => ({ ...p, locations: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Company Size</label>
            <input
              style={inputStyle}
              placeholder="50-500 employees"
              value={formState.companySize}
              onChange={e => setFormState(p => ({ ...p, companySize: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            style={btnPrimary}
            onClick={() => { setActiveTemplate(null); search(undefined, 1) }}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search Apollo →'}
          </button>
        </div>
      </div>

      {/* Results */}
      {!hasSearched && !loading && (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--ink-soft)',
          fontSize: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          Select a template or search above to find prospects
        </div>
      )}

      {error === 'not_connected' && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: '14px 18px',
          fontSize: 13,
          color: '#92400e',
        }}>
          Connect Apollo in <strong>Settings → Integrations</strong> to search contacts.
        </div>
      )}

      {error && error !== 'not_connected' && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: '14px 18px',
          fontSize: 13,
          color: '#991b1b',
        }}>
          {error}
        </div>
      )}

      {hasSearched && !loading && !error && results.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 24px',
          color: 'var(--ink-soft)',
          fontSize: 14,
        }}>
          No contacts found for these criteria. Try broader titles or different locations.
        </div>
      )}

      {(results.length > 0 || loading) && (
        <div>
          {/* Results header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {loading && results.length === 0
                ? 'Searching...'
                : `Found ${pagination.total_entries.toLocaleString()} contacts`}
            </div>
            {pagination.total_entries > 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                Showing {results.length} of {pagination.total_entries.toLocaleString()}
              </div>
            )}
          </div>

          {/* Sequence selector */}
          {sequences.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Default sequence:</label>
              <select
                value={selectedSequence}
                onChange={e => setSelectedSequence(e.target.value)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--line)',
                  borderRadius: 5,
                  fontSize: 12,
                  color: 'var(--ink)',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <option value="">— pick a sequence —</option>
                {sequences.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Contact cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} ref={dropdownRef}>
            {results.map(person => {
              const inPipeline = addedIds.has(person.id)
              const inSequence = sequenceAdded.has(person.id)
              const org = getOrgName(person)
              const loc = getLocation(person)
              const initials = getInitials(person.name)

              return (
                <div
                  key={person.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--blush)',
                    color: 'var(--wine)',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.3 }}>
                      {person.name}
                    </div>
                    {person.title && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 1 }}>
                        {person.title}
                      </div>
                    )}
                    {(org || loc) && (
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                        {[org, loc].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                      {person.linkedin_url && (
                        <a
                          href={person.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none' }}
                        >
                          LinkedIn
                        </a>
                      )}
                      {person.email && (
                        <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                          {person.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {inPipeline ? (
                      <span style={{
                        padding: '5px 12px',
                        background: '#dcfce7',
                        color: '#166534',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        In Pipeline
                      </span>
                    ) : (
                      <button
                        onClick={() => addToPipeline(person)}
                        style={btnOutline}
                      >
                        + Add to Pipeline
                      </button>
                    )}

                    {/* Add to Sequence dropdown */}
                    <div style={{ position: 'relative' }}>
                      {inSequence ? (
                        <span style={{
                          padding: '5px 12px',
                          background: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          In Sequence
                        </span>
                      ) : sequenceLoading === `${person.id}::${selectedSequence}` ? (
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)', padding: '5px 8px' }}>Adding...</span>
                      ) : (
                        <button
                          onClick={() => {
                            if (sequences.length === 0) return
                            if (selectedSequence) {
                              addToSequence(person, selectedSequence)
                            } else {
                              setOpenDropdownId(openDropdownId === person.id ? null : person.id)
                            }
                          }}
                          style={btnGhost}
                        >
                          + Add to Sequence
                          {sequences.length > 0 && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      )}

                      {openDropdownId === person.id && (
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: 4,
                          background: '#fff',
                          border: '1px solid var(--line)',
                          borderRadius: 6,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                          minWidth: 220,
                          zIndex: 100,
                          overflow: 'hidden',
                        }}>
                          {sequences.length === 0 ? (
                            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-soft)' }}>
                              No sequences — configure in Apollo
                            </div>
                          ) : (
                            sequences.map(seq => (
                              <button
                                key={seq.id}
                                onClick={() => addToSequence(person, seq.id)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '9px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  fontSize: 13,
                                  color: 'var(--ink)',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--line)',
                                }}
                              >
                                {seq.name}
                                {seq.status && (
                                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 6 }}>
                                    ({seq.status})
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Load more */}
          {hasMore && !loading && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={loadMore}
                style={{
                  padding: '10px 28px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  fontSize: 13,
                  color: 'var(--ink)',
                  cursor: 'pointer',
                }}
              >
                Load more results
              </button>
            </div>
          )}

          {loading && results.length > 0 && (
            <div style={{ textAlign: 'center', padding: '16px', fontSize: 13, color: 'var(--ink-soft)' }}>
              Loading...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
