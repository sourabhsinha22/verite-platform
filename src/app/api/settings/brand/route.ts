import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'Admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (!currentUser.orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const { primary, accent } = await req.json()
  const adminDb = createAdminClient()
  const { error } = await adminDb.from('orgs').update({ brand: { primary, accent } }).eq('id', currentUser.orgId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
