import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth'

async function getPlatformAdmin() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null
  const adminDb = createAdminClient()
  const { data: pa } = await adminDb.from('platform_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle()
  return pa ? { currentUser, adminDb } : null
}

export async function GET() {
  const ctx = await getPlatformAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { adminDb } = ctx

  const { data: orgs, error } = await adminDb
    .from('orgs')
    .select('id, name, slug, brand, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach member counts
  const counts = await Promise.all(
    (orgs ?? []).map(async org => {
      const { count } = await adminDb
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id)
      return { ...org, member_count: count ?? 0 }
    })
  )

  return NextResponse.json({ orgs: counts })
}

export async function POST(req: NextRequest) {
  const ctx = await getPlatformAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { currentUser, adminDb } = ctx

  const { name, slug, primary, accent } = await req.json()
  if (!name || !slug) return NextResponse.json({ error: 'name and slug required' }, { status: 400 })

  const { data: org, error } = await adminDb.from('orgs').insert({
    name,
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    brand: { primary: primary || '#2f2e4b', accent: accent || '#5f3e3f' },
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add creator to both org_members and team_members
  await Promise.all([
    adminDb.from('org_members').insert({ org_id: org.id, user_id: currentUser.id, role: 'Admin' }),
    adminDb.from('team_members').insert(
      { auth_user_id: currentUser.id, name: currentUser.name, email: currentUser.email, role: 'Admin', org_id: org.id }
    ),
  ])

  return NextResponse.json({ ok: true, org })
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
