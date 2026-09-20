import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isPartner } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user || !isPartner(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { clientEmail?: string }
  const token = crypto.randomUUID()

  const admin = createAdminClient()
  const { error } = await admin
    .from('sows')
    .update({
      status: 'sent',
      signing_token: token,
      signature_requested_at: new Date().toISOString(),
      signature_requested_to: body.clientEmail ?? null,
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, signingUrl: '/sign/' + token })
}
