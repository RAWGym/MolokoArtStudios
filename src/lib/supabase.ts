import { createClient } from '@supabase/supabase-js'
import type { Booking, BonusTx, ClientRow, Staff, AuditRow } from './types'

// Public values: the publishable key is designed to live in the browser; access is enforced by RLS.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://erztkmhaehqpgqgfwjsh.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__OqYSDfMSkRRGh2JtF9HFw_fynikyCn'
export const STAFF_DOMAIN = 'staff.moloko.invalid'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'moloko.auth' },
  realtime: { params: { eventsPerSecond: 5 } },
})

/* ------------------------------------------------------------ row mapping */
const CORE = new Set(['id', 'hall', 'date', 'start', 'hours', 'status', 'name', 'phone', 'phoneNorm', 'total', 'bonusUsed', 'source', 'demo', 'createdAt', 'updatedAt', 'createdBy'])

export function fromRow(r: any): Booking {
  return {
    ...(r.extra || {}),
    id: r.id, hall: r.hall, date: r.date, start: r.start_hour, hours: r.hours, status: r.status,
    name: r.name ?? '', phone: r.phone ?? '', phoneNorm: r.phone_norm ?? '', total: r.total ?? 0, bonusUsed: r.bonus_used ?? 0,
    source: r.source ?? '', demo: !!r.demo, createdAt: r.created_at, updatedAt: r.updated_at, createdBy: r.created_by,
  }
}
export function toRow(b: Partial<Booking>, base?: Booking) {
  const row: Record<string, unknown> = {}
  const extra: Record<string, unknown> = {}
  if (base) for (const [k, v] of Object.entries(base)) if (!CORE.has(k)) extra[k] = v
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue
    switch (k) {
      case 'id': case 'phoneNorm': case 'updatedAt': break
      case 'start': row.start_hour = v; break
      case 'bonusUsed': row.bonus_used = v; break
      case 'createdAt': row.created_at = v; break
      case 'createdBy': row.created_by = v; break
      case 'hall': case 'date': case 'hours': case 'status': case 'name': case 'phone': case 'total': case 'source': case 'demo': row[k] = v; break
      default: extra[k] = v
    }
  }
  row.extra = extra
  return row
}
export const clientFromRow = (r: any): ClientRow => ({ phone: r.phone, name: r.name, note: r.note, tags: r.tags ?? [], birthday: r.birthday, blocked: r.blocked, createdAt: r.created_at })
export const txFromRow = (r: any): BonusTx => ({ id: r.id, phone: r.phone, amount: r.amount, kind: r.kind, bookingId: r.booking_id, note: r.note, createdAt: r.created_at, createdBy: r.created_by })
export const staffFromRow = (r: any): Staff => ({ userId: r.user_id, login: r.login, name: r.name, role: r.role, disabled: r.disabled, createdAt: r.created_at })
export const auditFromRow = (r: any): AuditRow => ({ id: r.id, at: r.at, actor: r.actor, action: r.action, bookingId: r.booking_id, summary: r.summary })

/* ------------------------------------------------------------ errors */
export class ApiError extends Error { constructor(public code: string, msg?: string) { super(msg || code) } }
export function errCode(e: any): string {
  if (!e) return 'unknown'
  if (e instanceof ApiError) return e.code
  if (e.code === '23P01') return 'slot_taken'
  const m = String(e.message || e.error || e)
  const known = ['slot_taken', 'past', 'bad_phone', 'bad_name', 'too_many', 'no_confetti_in_grey', 'blocked', 'bad_time', 'too_far', 'login_taken', 'weak_password', 'bad_login', 'forbidden', 'already_set_up', 'self']
  return known.find(k => m.includes(k)) || (/fetch|network/i.test(m) ? 'network' : m)
}

/* ------------------------------------------------------------ paged select (bypasses the 1000-row cap) */
export async function selectAll<T>(table: string, map: (r: any) => T, order = 'created_at'): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').order(order, { ascending: true }).range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []).map(map))
    if (!data || data.length < 1000) break
  }
  return out
}

/* ------------------------------------------------------------ staff edge function */
export async function staffFn<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await sb.auth.getSession()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/moloko-staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body),
  }).catch(() => { throw new ApiError('network') })
  const j = await r.json().catch(() => ({ error: 'network' }))
  if (!r.ok) throw new ApiError(j.error || 'unknown', j.detail)
  return j as T
}

export const loginEmail = (login: string) => `${login.trim().toLowerCase()}@${STAFF_DOMAIN}`
