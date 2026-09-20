import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { orgId } = await req.json()
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  const cookieStore = await cookies()
  cookieStore.set('verite-active-org', orgId, { httpOnly: false, path: '/', maxAge: 60 * 60 * 24 * 365 })
  return NextResponse.json({ ok: true })
}
