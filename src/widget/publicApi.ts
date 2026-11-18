import { sb, ApiError, errCode, clientFn, clientEmail } from '../lib/supabase'
import { mergeSettings, applyCatalog } from '../lib/catalog'
import type { Settings } from '../lib/types'
import { ymd, addDays } from '../lib/format'

export interface Busy { hall: string; date: string; start: number; hours: number }

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await sb.from('moloko_settings').select('data').eq('id', 1).maybeSingle()
  if (error) throw error
  const S = mergeSettings(data?.data)
  applyCatalog(S)
  return S
}

export async function fetchBusy(days = 60): Promise<Busy[]> {
  const from = ymd(new Date()), to = ymd(addDays(new Date(), days))
  const { data, error } = await sb.rpc('moloko_busy', { p_from: from, p_to: to })
  if (error) throw error
  return (data ?? []).map((r: any) => ({ hall: r.hall, date: r.date, start: r.start_hour, hours: r.hours }))
}

export interface BonusInfo { balance: number; level: string; pct: number; hours: number }
export async function fetchBonus(phone: string): Promise<BonusInfo | null> {
  const { data, error } = await sb.rpc('moloko_bonus', { p_phone: phone })
  if (error) return null
  return data as BonusInfo | null
}

export interface Item { hall: string; date: string; start: number; hours: number }
export interface BookPayload { items: Item[]; guests: number; equip: string[]; makeup: boolean; confetti: boolean; pet: boolean; name: string; phone: string; kind: string; comment: string; bonus: number; ref?: string }
export async function book(p: BookPayload): Promise<{ id: string; ids: string[]; group: string | null; total: number; bonus: number; pay: number; discount: number }> {
  const { data, error } = await sb.rpc('moloko_book', { p })
  if (error) throw new ApiError(errCode(error), error.message)
  return data
}

export async function refInfo(code: string): Promise<{ name: string; pct: number } | null> {
  const { data, error } = await sb.rpc('moloko_ref_info', { p_code: code })
  if (error) return null
  return data
}

export interface Invite { items: Item[]; kind: string | null; guests: number | null; host: string }
export async function fetchInvite(id: string): Promise<Invite | null> {
  const { data, error } = await sb.rpc('moloko_invite', { p_id: id })
  if (error) throw error
  return data
}

/* ------------------------------------------------------------ client account */
export interface MeBooking { id: string; hall: string; date: string; start: number; hours: number; status: string; total: number; bonus: number; group: string | null }
export interface Me {
  phone: string; name: string; verified: boolean; refCode: string | null
  level: { name: string; pct: number; hours: number; spent: number; enabled?: boolean }; next: { name: string; pct: number; from: number } | null; basis: 'hours' | 'spent'
  balance: number | null; friendPct: number; referrerPct: number; friends: number
  tx: { amount: number; kind: string; note: string; at: string }[]; bookings: MeBooking[]
}
export async function fetchMe(): Promise<Me | null> {
  const { data: u } = await sb.auth.getSession()
  if (!u.session) return null
  const { data, error } = await sb.rpc('moloko_me')
  if (error) throw error
  return data
}
export async function clientLogin(phone: string, password: string) {
  const { error } = await sb.auth.signInWithPassword({ email: clientEmail(phone), password })
  if (error) throw new ApiError(/invalid/i.test(error.message) ? 'bad_login' : errCode(error), error.message)
}
export async function clientRegister(phone: string, password: string, name: string) {
  await clientFn({ action: 'register', phone, password, name })
  await clientLogin(phone, password)
}
export const clientLogout = () => sb.auth.signOut()
