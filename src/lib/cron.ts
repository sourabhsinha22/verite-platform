// Shared utilities for cron job routes

export function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

export function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function inNDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Check if an email was already sent for this type+refId in the last N hours
export async function alreadyNotified(
  supabase: ReturnType<typeof import('./supabase/admin').createAdminClient>,
  recipient: string,
  type: string,
  refId: string,
  withinHours = 20
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 3600000).toISOString()
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('recipient', recipient)
    .eq('type', type)
    .eq('ref_id', refId)
    .gte('sent_at', since)
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function logNotification(
  supabase: ReturnType<typeof import('./supabase/admin').createAdminClient>,
  recipient: string,
  type: string,
  refId: string
) {
  await supabase.from('notification_log').insert({ recipient, type, ref_id: refId })
}
