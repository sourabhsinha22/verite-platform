import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Apollo webhook payload types
interface ApolloContact {
  id?: string
  first_name?: string
  last_name?: string
  email?: string
  title?: string
  organization_name?: string
}

interface ApolloPayload {
  event_type: string
  data?: {
    contact?: ApolloContact
    emailer_campaign?: { id?: string; name?: string }
    emailer_message?: { id?: string; subject?: string }
    meeting?: { id?: string }
  }
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const rawBody = await req.text()
  let payload: ApolloPayload | null = null
  let parseError: string | null = null

  try {
    const raw = JSON.parse(rawBody)

    // Detect Zapier format — Zapier sends flat fields, not nested Apollo structure
    // We accept either native Apollo format OR the Zapier-mapped format below
    if (raw.zapier_source === 'true' || raw.contact_email) {
      // Zapier flat format: { contact_email, contact_name, contact_title,
      //   company_name, sequence_name, sequence_id, event_type }
      payload = {
        event_type: raw.event_type ?? 'emailer_campaign.contact_replied',
        data: {
          contact: {
            id: raw.contact_id ?? '',
            first_name: (raw.contact_name ?? '').split(' ')[0] ?? '',
            last_name: (raw.contact_name ?? '').split(' ').slice(1).join(' ') ?? '',
            email: raw.contact_email ?? '',
            title: raw.contact_title ?? '',
            organization_name: raw.company_name ?? '',
          },
          emailer_campaign: {
            id: raw.sequence_id ?? '',
            name: raw.sequence_name ?? 'Zapier',
          },
        },
      }
    } else {
      payload = raw as ApolloPayload
    }
  } catch (e) {
    parseError = e instanceof Error ? e.message : 'JSON parse error'
  }

  // Fetch integration record (secret + update last_sync_at)
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, webhook_secret')
    .eq('provider', 'apollo')
    .single()

  // Verify HMAC signature if secret is configured
  if (integration?.webhook_secret) {
    const signature = req.headers.get('x-apollo-signature') ?? ''
    const expected = createHmac('sha256', integration.webhook_secret)
      .update(rawBody)
      .digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
    }
  }

  const eventType = payload?.event_type ?? 'unknown'
  const contact = payload?.data?.contact
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : null
  const contactEmail = contact?.email ?? null
  const companyName = contact?.organization_name ?? null
  const apolloContactId = contact?.id ?? null
  const sequenceName = payload?.data?.emailer_campaign?.name ?? null
  const sequenceId = payload?.data?.emailer_campaign?.id ?? null

  // Log the webhook event (always)
  const { data: webhookEvent } = await supabase
    .from('webhook_events')
    .insert({
      provider: 'apollo',
      event_type: eventType,
      payload: payload ?? { raw: rawBody, parse_error: parseError },
      processed: false,
      result: parseError ? 'parse_error' : '',
    })
    .select('id')
    .single()

  if (parseError) {
    return NextResponse.json({ ok: true, processed: false, error: 'Parse error logged' })
  }

  // Only handle known event types
  const HANDLED_EVENTS = [
    'emailer_message.replied',
    'emailer_campaign.contact_replied',
    'emailer_message.clicked',
    'meeting.created',
    'emailer_campaign.contact_booked_meeting',
  ]

  if (!HANDLED_EVENTS.includes(eventType)) {
    // Update last_sync_at and return
    if (integration?.id) {
      await supabase.from('integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration.id)
    }
    return NextResponse.json({ ok: true, processed: false })
  }

  try {
    // ── Find or create company ────────────────────────────────────────────────
    let companyId: string | null = null
    if (companyName) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', companyName)
        .single()

      if (existingCompany) {
        companyId = existingCompany.id
      } else {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({ name: companyName, tag: 'prospect' })
          .select('id')
          .single()
        companyId = newCompany?.id ?? null
      }
    }

    // ── Find or create engagement ─────────────────────────────────────────────
    let engagementId: string | null = null
    let existingStage: string | null = null

    if (apolloContactId) {
      const { data: existingEng } = await supabase
        .from('engagements')
        .select('id, stage')
        .eq('apollo_contact_id', apolloContactId)
        .single()

      if (existingEng) {
        engagementId = existingEng.id
        existingStage = existingEng.stage
      }
    }

    const isMeeting = eventType === 'meeting.created' || eventType === 'emailer_campaign.contact_booked_meeting'
    const isReplied = eventType === 'emailer_message.replied' || eventType === 'emailer_campaign.contact_replied'
    const isClicked = eventType === 'emailer_message.clicked'

    if (!engagementId) {
      // Create new engagement
      const engName = [contactName, companyName].filter(Boolean).join(' — ') || `Apollo Lead — ${eventType}`
      const newStage = isMeeting ? 'qualified' : 'engaged'
      const { data: newEng } = await supabase
        .from('engagements')
        .insert({
          name: engName,
          engagement_type: 'opportunity',
          stage: newStage,
          source: 'apollo_sequence',
          source_detail: sequenceName ?? sequenceId ?? null,
          apollo_contact_id: apolloContactId ?? '',
          apollo_sequence_id: sequenceId ?? '',
          apollo_sequence_name: sequenceName ?? '',
          company_id: companyId,
          health: 'green',
          probability: newStage === 'qualified' ? 35 : 15,
          prospect_email: contactEmail ?? '',
          prospect_title: contact?.title ?? '',
        })
        .select('id')
        .single()
      engagementId = newEng?.id ?? null
      existingStage = newStage
    } else {
      // Update stage if needed
      if (isMeeting) {
        await supabase.from('engagements').update({ stage: 'qualified', probability: 35 }).eq('id', engagementId)
        existingStage = 'qualified'
      } else if ((isReplied || isClicked) && existingStage === 'prospect') {
        await supabase.from('engagements').update({ stage: 'engaged', probability: 15 }).eq('id', engagementId)
        existingStage = 'engaged'
      }
    }

    // ── Activity log entry ────────────────────────────────────────────────────
    let activityContent = ''
    if (isReplied) {
      activityContent = `Apollo: ${contactName ?? contactEmail ?? 'Contact'} replied to sequence${sequenceName ? ` "${sequenceName}"` : ''}`
    } else if (isClicked) {
      activityContent = `Apollo: ${contactName ?? contactEmail ?? 'Contact'} clicked link in sequence${sequenceName ? ` "${sequenceName}"` : ''}`
    } else if (isMeeting) {
      activityContent = `Apollo: ${contactName ?? contactEmail ?? 'Contact'} booked a meeting`
    }

    if (engagementId && activityContent) {
      await supabase.from('activity_log').insert({
        engagement_id: engagementId,
        author: 'Apollo (automated)',
        entry_type: 'note',
        content: activityContent,
        metadata: { apollo_event_type: eventType, sequence_id: sequenceId, sequence_name: sequenceName },
      })
    }

    // ── Create task for meeting booked ────────────────────────────────────────
    if (isMeeting && engagementId) {
      await supabase.from('tasks').insert({
        engagement_id: engagementId,
        title: `Discovery call with ${contactName ?? contactEmail ?? 'prospect'}`,
        task_group: 'sales',
        status: 'not-started',
        sort_order: 0,
      })
    }

    // ── Update webhook_events result ──────────────────────────────────────────
    if (webhookEvent?.id) {
      await supabase.from('webhook_events').update({ result: 'ok' }).eq('id', webhookEvent.id)
    }

    // ── Update last_sync_at ───────────────────────────────────────────────────
    if (integration?.id) {
      await supabase.from('integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration.id)
    }

    return NextResponse.json({ ok: true, processed: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (webhookEvent?.id) {
      await supabase.from('webhook_events').update({ result: `error: ${message.slice(0, 200)}` }).eq('id', webhookEvent.id)
    }
    return NextResponse.json({ ok: true, processed: false, error: message }, { status: 200 })
  }
}
