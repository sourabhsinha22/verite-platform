'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Document } from '@/lib/types'
import { FileText, Image, Table, File, Download, Trash2 } from 'lucide-react'

interface Props {
  engagementId?: string
  companyId?: string
  currentUserName: string
  initialDocuments: Document[]
}

const fmtSize = (b: number) =>
  b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB'

function FileIcon({ type }: { type: string | null }) {
  const t = (type || '').toLowerCase()
  if (t.includes('pdf')) return <FileText size={18} color="#c0392b" />
  if (t.includes('image') || t.includes('png') || t.includes('jpg') || t.includes('jpeg') || t.includes('gif') || t.includes('webp')) return <Image size={18} color="var(--ink-soft)" />
  if (t.includes('excel') || t.includes('spreadsheet') || t.includes('csv') || t.includes('xls')) return <Table size={18} color="#27ae60" />
  if (t.includes('word') || t.includes('document') || t.includes('doc')) return <FileText size={18} color="#2980b9" />
  return <File size={18} color="var(--ink-soft)" />
}

function fmtDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DocumentsSection({ engagementId, companyId, currentUserName, initialDocuments }: Props) {
  const [docs, setDocs] = useState<Document[]>(initialDocuments)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      setError('File must be under 50MB.')
      return
    }
    setError('')
    setUploading(true)

    const prefix = engagementId || companyId || 'general'
    const path = `${prefix}/${Date.now()}-${file.name}`

    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file)
    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }

    const { data: inserted, error: dbErr } = await supabase
      .from('documents')
      .insert({
        engagement_id: engagementId ?? null,
        company_id: companyId ?? null,
        name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: currentUserName,
      })
      .select()
      .single()

    setUploading(false)
    if (dbErr) { setError(dbErr.message); return }
    if (inserted) setDocs(prev => [inserted as Document, ...prev])

    // Reset file input
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDownload = async (doc: Document) => {
    const { data, error: signErr } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600)
    if (signErr || !data?.signedUrl) return
    window.open(data.signedUrl, '_blank')
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.name}"?`)) return
    setDeletingId(doc.id)
    await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    setDeletingId(null)
  }

  return (
    <div style={{ marginTop: 32 }}>
      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          Documents
          {docs.length > 0 && (
            <span style={{
              background: 'var(--line-soft)', color: 'var(--ink-faint)',
              fontSize: 12, fontWeight: 600, borderRadius: 12,
              padding: '2px 8px', fontFamily: 'var(--sans)',
            }}>
              {docs.length}
            </span>
          )}
        </h2>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            background: uploading ? 'var(--line-soft)' : 'var(--wine)',
            color: uploading ? 'var(--ink-faint)' : '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 4, color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Doc list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        {docs.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
            No documents yet. Upload contracts, SOWs, or notes.
          </div>
        ) : (
          docs.map((doc, i) => (
            <div
              key={doc.id}
              onMouseEnter={() => setHoveredId(doc.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderTop: i > 0 ? '1px solid var(--line-soft)' : undefined,
                background: hoveredId === doc.id ? 'var(--line-soft)' : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              {/* Left: icon + name + meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{ flexShrink: 0 }}>
                  <FileIcon type={doc.file_type} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                    {doc.file_size ? fmtSize(doc.file_size) : ''}{doc.file_type ? ' · ' + doc.file_type.split('/')[1] : ''}
                  </div>
                </div>
              </div>

              {/* Right: uploader + date + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{doc.uploaded_by || 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{fmtDate(doc.created_at)}</div>
                </div>
                <button
                  onClick={() => handleDownload(doc)}
                  title="Download"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--wine)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  title="Delete"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: hoveredId === doc.id ? 'var(--danger)' : 'transparent',
                    display: 'flex', alignItems: 'center', padding: '4px 0',
                    transition: 'color 0.15s',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
