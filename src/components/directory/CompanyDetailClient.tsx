'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Company, Contact, CompanyTag, COMPANY_TAG_LABELS } from '@/lib/types'
import Badge from '@/components/ui/Badge'

interface Props {
  company: Company
  contacts: Contact[]
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)',
  fontSize: 13,
  color: 'var(--ink)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '7px 10px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--ink-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  marginBottom: 4,
  display: 'block',
}

export default function CompanyDetailClient({ company: initialCompany, contacts: initialContacts }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [company, setCompany] = useState(initialCompany)
  const [contacts, setContacts] = useState(initialContacts)
  const [saving, setSaving] = useState(false)
  const [editingContact, setEditingContact] = useState<string | null>(null)
  const [newContact, setNewContact] = useState<Partial<Contact> | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  const saveCompany = async (field: keyof Company, value: string) => {
    setSaving(true)
    await supabase.from('companies').update({ [field]: value }).eq('id', company.id)
    setSaving(false)
    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(''), 2000)
    startTransition(() => router.refresh())
  }

  const saveContact = async (contact: Contact) => {
    await supabase.from('contacts').upsert(contact)
    setContacts(prev => prev.map(c => c.id === contact.id ? contact : c))
    setEditingContact(null)
    startTransition(() => router.refresh())
  }

  const addContact = async (contactData: Partial<Contact>) => {
    if (!contactData?.name?.trim()) return
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...contactData, name: contactData.name.trim(), company_id: company.id })
      .select()
      .single()
    if (data) {
      setContacts(prev => [...prev, data])
      setNewContact(null)
      startTransition(() => router.refresh())
    }
  }

  const deleteContact = async (id: string) => {
    if (!confirm('Delete this contact?')) return
    await supabase.from('contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div>
      {/* Company name editable */}
      <div style={{ marginBottom: 24 }}>
        <input
          defaultValue={company.name}
          onBlur={e => saveCompany('name', e.target.value)}
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 38,
            fontWeight: 600,
            color: 'var(--navy)',
            letterSpacing: '-0.5px',
            border: 'none',
            borderBottom: '2px solid transparent',
            background: 'transparent',
            width: '100%',
            padding: '2px 0',
            outline: 'none',
          }}
          onFocus={e => (e.target.style.borderBottomColor = 'var(--wine)')}
          onBlurCapture={e => (e.target.style.borderBottomColor = 'transparent')}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <select
            value={company.tag}
            onChange={async e => {
              const v = e.target.value as CompanyTag
              setCompany(c => ({ ...c, tag: v }))
              await saveCompany('tag', v)
            }}
            style={{ ...inputStyle, width: 'auto', fontSize: 11 }}
          >
            {Object.entries(COMPANY_TAG_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Badge tag={company.tag} />
          {saving && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Saving…</span>}
          {saveMsg && <span style={{ fontSize: 11, color: 'var(--success)' }}>{saveMsg}</span>}
        </div>
      </div>

      {/* Detail grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 24, marginBottom: 32,
      }}>
        {[
          { label: 'Account Owner', field: 'account_owner' as keyof Company },
          { label: 'Industry', field: 'industry' as keyof Company },
          { label: 'Size', field: 'size' as keyof Company },
          { label: 'Address', field: 'address' as keyof Company },
          { label: 'Website', field: 'website' as keyof Company },
        ].map(({ label, field }) => (
          <div key={field}>
            <label style={labelStyle}>{label}</label>
            <input
              defaultValue={(company[field] as string) ?? ''}
              onBlur={e => saveCompany(field, e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', marginBottom: 12 }}>Notes</h2>
        <textarea
          defaultValue={company.notes ?? ''}
          onBlur={e => saveCompany('notes', e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--sans)' }}
          placeholder="Add notes about this company…"
        />
      </div>

      {/* Contacts section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Contacts</h2>
          <button
            onClick={() => setNewContact({})}
            style={{
              background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)',
              padding: '7px 14px', borderRadius: 4, fontSize: 13, cursor: 'pointer',
            }}
          >
            + Add Contact
          </button>
        </div>

        {contacts.length === 0 && !newContact && (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No contacts yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {contacts.map(contact => (
            <div
              key={contact.id}
              style={{
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              {editingContact === contact.id ? (
                <ContactEditForm
                  contact={contact}
                  onSave={saveContact}
                  onCancel={() => setEditingContact(null)}
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>{contact.name}</span>
                      {contact.is_primary && (
                        <span style={{ fontSize: 10, background: 'var(--line-soft)', color: 'var(--ink-soft)', padding: '2px 6px', borderRadius: 3 }}>Primary</span>
                      )}
                    </div>
                    {contact.title && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{contact.title}</div>}
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                      {contact.email && <a href={`mailto:${contact.email}`} style={{ fontSize: 12, color: 'var(--wine)' }}>{contact.email}</a>}
                      {contact.phone && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{contact.phone}</span>}
                    </div>
                    {contact.notes && <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>{contact.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setEditingContact(contact.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', fontSize: 12 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteContact(contact.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {newContact !== null && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--wine)', borderRadius: 8, padding: '16px 20px' }}>
              <ContactEditForm
                contact={newContact as Contact}
                onSave={c => addContact(c)}
                onCancel={() => setNewContact(null)}
                onChange={setNewContact}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ContactEditForm({
  contact,
  onSave,
  onCancel,
  onChange,
}: {
  contact: Contact | Partial<Contact>
  onSave: (c: Contact) => void
  onCancel: () => void
  onChange?: (c: Partial<Contact>) => void
}) {
  const [form, setForm] = useState<Partial<Contact>>(contact)

  const update = (field: keyof Contact, value: string | boolean) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    onChange?.(updated)
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
    background: 'var(--bg)', border: '1px solid var(--line)',
    borderRadius: 4, padding: '6px 10px', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        {[
          { field: 'name', label: 'Name' },
          { field: 'title', label: 'Title' },
          { field: 'department', label: 'Department' },
          { field: 'email', label: 'Email' },
          { field: 'phone', label: 'Phone' },
          { field: 'linkedin', label: 'LinkedIn' },
        ].map(({ field, label }) => (
          <div key={field}>
            <label style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'block', marginBottom: 3 }}>{label}</label>
            <input
              value={(form as Record<string, unknown>)[field] as string ?? ''}
              onChange={e => update(field as keyof Contact, e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'block', marginBottom: 3 }}>Notes</label>
        <textarea
          value={form.notes ?? ''}
          onChange={e => update('notes', e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={form.is_primary ?? false}
          onChange={e => update('is_primary', e.target.checked)}
        />
        Primary contact
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSave(form as Contact)}
          style={{ background: 'var(--wine)', color: '#fff', padding: '7px 14px', borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer' }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--navy)', padding: '7px 14px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
