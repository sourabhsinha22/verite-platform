import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ url: null, error: 'Stripe not configured' })
  }

  const { invoice_id } = await req.json()
  if (!invoice_id) {
    return NextResponse.json({ url: null, error: 'invoice_id required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, amount, invoice_number, engagement:engagements(id, company:companies(id, name))')
    .eq('id', invoice_id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ url: null, error: 'Invoice not found' }, { status: 404 })
  }

  const engRaw = invoice.engagement as unknown as { id: string; company?: { id: string; name: string }[] | { id: string; name: string } } | null
  const engCo = Array.isArray(engRaw?.company) ? (engRaw!.company as {name:string}[])[0] : engRaw?.company as {name:string}|null
  const companyName = engCo?.name ?? 'Valued Client'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`

  try {
    // Dynamically import stripe to avoid module-level instantiation errors when key is missing
    const Stripe = (await import('stripe')).default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' as any })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Invoice ${invoice.invoice_number} — ${companyName}` },
          unit_amount: Math.round(invoice.amount * 100),
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/pay/${invoice_id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pay/${invoice_id}`,
      metadata: { invoice_id },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ url: null, error: String(err) }, { status: 500 })
  }
}
