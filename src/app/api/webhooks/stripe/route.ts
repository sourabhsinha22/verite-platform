import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any

  if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = (await import('stripe')).default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' as any })
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch {
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }
  } else {
    event = JSON.parse(body)
  }

  if (event?.type === 'checkout.session.completed') {
    const invoice_id = event.data?.object?.metadata?.invoice_id
    if (invoice_id) {
      const supabase = createAdminClient()
      await supabase.from('invoices').update({ paid_date: new Date().toISOString().slice(0, 10), status: 'paid' }).eq('id', invoice_id)
      const { data: invoice } = await supabase.from('invoices').select('engagement_id, invoice_number').eq('id', invoice_id).single()
      if (invoice?.engagement_id) {
        await supabase.from('activity_log').insert({
          engagement_id: invoice.engagement_id,
          entry_type: 'note',
          content: `Invoice ${invoice.invoice_number ?? invoice_id} paid via Stripe.`,
          author: 'Stripe (automated)',
          metadata: {},
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
