import { useMemo } from 'react'
import type { Booking, BonusTx, ClientRow, Settings, LoyaltyLevel } from '../lib/types'
import { levelFor, nextLevel } from '../lib/catalog'
import { addDays, parseYmd, ymd, normPhone } from '../lib/format'
import { useStudio } from './store'

export const active = (b: Booking) => b.status !== 'cancelled'
export const fines = (b: Booking) => (b.fines ?? []).reduce((s, f) => s + (f.amount || 0), 0)
/** Money actually collected for a booking */
export const revenueOf = (b: Booking) =>
  b.status === 'paid' || b.status === 'done' ? b.total - (b.bonusUsed || 0) + fines(b)
    : b.status === 'cancelled' ? (b.penalty || 0) : 0
export const toCollect = (b: Booking) => b.status === 'new' ? b.total - (b.bonusUsed || 0) : 0

export function startOf(b: Pick<Booking, 'date' | 'start'>) { const d = parseYmd(b.date); d.setHours(b.start, 0, 0, 0); return d }
export function endOf(b: Pick<Booking, 'date' | 'start' | 'hours'>) { return new Date(startOf(b).getTime() + b.hours * 36e5) }

/** Hours of `hall` busy on `date` (0..23 of that date), counting bookings that spill over midnight */
export function busyHours(bookings: Booking[], hall: string, date: string, exceptId?: string) {
  const set = new Set<number>()
  const prev = ymd(addDays(parseYmd(date), -1))
  for (const b of bookings) {
    if (!active(b) || b.hall !== hall || b.id === exceptId) continue
    if (b.date === date) for (let k = 0; k < b.hours; k++) { const H = b.start + k; if (H < 24) set.add(H) }
    else if (b.date === prev) for (let k = 0; k < b.hours; k++) { const H = b.start + k; if (H >= 24) set.add(H - 24) }
  }
  return set
}
export function clash(bookings: Booking[], hall: string, date: string, start: number, hours: number, exceptId?: string) {
  const s = startOf({ date, start }).getTime(), e = s + hours * 36e5
  return bookings.find(b => active(b) && b.hall === hall && b.id !== exceptId && startOf(b).getTime() < e && endOf(b).getTime() > s) ?? null
}

export interface Client {
  phone: string; name: string; note: string; tags: string[]; birthday: string | null; blocked: boolean
  bookings: Booking[]; visits: number; hours: number; spent: number; balance: number; accrued: number; redeemed: number
  last: string | null; next: Booking | null; level: LoyaltyLevel; nextLevel: LoyaltyLevel | null; progress: number; firstAt: string | null
}

export function buildClients(bookings: Booking[], rows: ClientRow[], tx: BonusTx[], S: Settings): Client[] {
  const map = new Map<string, Client>()
  const get = (phone: string, name = '') => {
    let c = map.get(phone)
    if (!c) { c = { phone, name, note: '', tags: [], birthday: null, blocked: false, bookings: [], visits: 0, hours: 0, spent: 0, balance: 0, accrued: 0, redeemed: 0, last: null, next: null, level: S.loyalty.levels[0], nextLevel: null, progress: 0, firstAt: null }; map.set(phone, c) }
    return c
  }
  for (const r of rows) { const c = get(r.phone, r.name); Object.assign(c, { name: r.name || c.name, note: r.note, tags: r.tags, birthday: r.birthday, blocked: r.blocked }) }
  const nowT = Date.now()
  for (const b of bookings) {
    if (b.status === 'block') continue
    const p = b.phoneNorm || normPhone(b.phone); if (p.length < 10) continue
    const c = get(p, b.name)
    if (!c.name) c.name = b.name
    c.bookings.push(b)
    if (b.status === 'done') { c.visits++; c.hours += b.hours; c.spent += revenueOf(b); if (!c.last || b.date > c.last) c.last = b.date }
    if ((b.status === 'paid' || b.status === 'new') && startOf(b).getTime() > nowT && (!c.next || startOf(b) < startOf(c.next))) c.next = b
    if (!c.firstAt || b.date < c.firstAt) c.firstAt = b.date
  }
  for (const t of tx) {
    const c = map.get(t.phone); if (!c) continue
    c.balance += t.amount
    if (t.amount > 0) c.accrued += t.amount; else c.redeemed -= t.amount
  }
  for (const c of map.values()) {
    const v = S.loyalty.basis === 'spent' ? c.spent : c.hours
    c.level = levelFor(v, S); c.nextLevel = nextLevel(v, S)
    c.progress = c.nextLevel ? Math.min(1, (v - c.level.from) / Math.max(1, c.nextLevel.from - c.level.from)) : 1
    c.bookings.sort((a, b) => startOf(b).getTime() - startOf(a).getTime())
  }
  return [...map.values()]
}

export function useClients() {
  const { bookings, clients, tx, S } = useStudio()
  return useMemo(() => buildClients(bookings, clients, tx, S), [bookings, clients, tx, S])
}
export function useClient(phone: string | null) {
  const all = useClients()
  return phone ? all.find(c => c.phone === normPhone(phone)) ?? null : null
}

export const LEVEL_TONE: Record<string, string> = { milk: '#E9E2D6', cream: '#D9C3A0', gold: '#D7B57A' }
export const levelTone = (id: string) => LEVEL_TONE[id] ?? '#93C9C3'
