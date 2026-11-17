import { sb, ApiError, errCode } from '../lib/supabase'
import { mergeSettings } from '../lib/catalog'
import type { Settings } from '../lib/types'
import { ymd, addDays } from '../lib/format'

export interface Busy { hall: string; date: string; start: number; hours: number }

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await sb.from('moloko_settings').select('data').eq('id', 1).maybeSingle()
  if (error) throw error
  return mergeSettings(data?.data)
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

export interface BookPayload { hall: string; date: string; start: number; hours: number; guests: number; equip: string[]; makeup: boolean; confetti: boolean; pet: boolean; name: string; phone: string; kind: string; comment: string; bonus: number }
export async function book(p: BookPayload): Promise<{ id: string; total: number; bonus: number; pay: number }> {
  const { data, error } = await sb.rpc('moloko_book', { p })
  if (error) throw new ApiError(errCode(error), error.message)
  return data
}
