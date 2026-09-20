import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  // Check platform_admins
  const adminDb = createAdminClient()
  const { data: pa } = await adminDb.from('platform_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle()
  if (!pa) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, slug, primary, accent } = await req.json()
  if (!name || !slug) return NextResponse.json({ error: 'name and slug required' }, { status: 400 })

  const { data, error } = await adminDb.from('orgs').insert({
    name,
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    brand: { primary: primary || '#2f2e4b', accent: accent || '#5f3e3f' },
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, org: data })
}

export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const adminDb = createAdminClient()
  const { data: pa } = await adminDb.from('platform_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle()
  if (!pa) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { orgId } = await req.json()
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

  // Safety: check no members
  const { count } = await adminDb.from('org_members').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
  if (count && count > 0) return NextResponse.json({ error: 'Remove all members first' }, { status: 400 })

  await adminDb.from('orgs').delete().eq('id', orgId)
  return NextResponse.json({ ok: true })
}
