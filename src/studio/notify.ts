import { create } from 'zustand'
import type { Booking, ClientRow, MoneyRow, RequestRow, Role } from '../lib/types'
import { hallById } from '../lib/catalog'
import { dShort, pad, num, store, parseYmd } from '../lib/format'
import { systemNotify } from '../lib/native'
import { toast } from '../ui/kit'
import { can } from './perm'
import { useUI, type Page } from './ui'

/* ------------------------------------------------------------ kinds */
export type NType = 'site' | 'booking' | 'paid' | 'cancel' | 'moved' | 'remind' | 'request' | 'client' | 'money'
export interface NKind { id: NType; label: string; hint: string; def: boolean; show?: (r: Role) => boolean }
export const NKINDS: NKind[] = [
  { id: 'site', label: 'Новые заявки с сайта', hint: 'Клиент забронировал через виджет', def: true },
  { id: 'remind', label: 'Напоминание перед съёмкой', hint: 'За выбранное время до начала брони', def: true },
  { id: 'paid', label: 'Оплаты', hint: 'Бронь отмечена оплаченной', def: true },
  { id: 'cancel', label: 'Отмены', hint: 'Бронь отменена клиентом или коллегой', def: true },
  { id: 'moved', label: 'Переносы', hint: 'Изменились дата, время или зал', def: true },
  { id: 'request', label: 'Запросы и ответы', hint: 'Запросы на подтверждение и решения по вашим запросам', def: true },
  { id: 'booking', label: 'Брони от коллег', hint: 'Коллега создал бронь в CRM', def: false },
  { id: 'client', label: 'Новые клиенты', hint: 'Появился новый клиент в базе', def: false },
  { id: 'money', label: 'Движения денег', hint: 'Коллега добавил поступление или расход', def: false, show: r => can(r, 'seeMoney') },
]
export const kindsFor = (r?: Role | null) => NKINDS.filter(k => !k.show || (r && k.show(r)))

export interface NItem { id: string; type: NType; title: string; body: string; at: string; read: boolean; open?: string }
export interface NPrefs { types: Record<NType, boolean>; system: boolean; sound: boolean; remindMin: number; quiet: boolean; quietFrom: number; quietTo: number }

const DEF_PREFS: NPrefs = {
  types: Object.fromEntries(NKINDS.map(k => [k.id, k.def])) as Record<NType, boolean>,
  system: true, sound: true, remindMin: 60, quiet: false, quietFrom: 23, quietTo: 8,
}
const PKEY = 'moloko.notify.prefs'
const loadPrefs = (): NPrefs => { const p = store.get<Partial<NPrefs>>(PKEY) ?? {}; return { ...DEF_PREFS, ...p, types: { ...DEF_PREFS.types, ...(p.types ?? {}) } } }
const feedKey = (uid: string) => `moloko.notify.feed.${uid}`
const MAX = 150

interface NState {
  uid: string | null
  items: NItem[]
  prefs: NPrefs
  bind(uid: string | null): void
  setPrefs(p: Partial<NPrefs>): void
  setType(t: NType, on: boolean): void
  push(i: NItem): void
  read(id: string): void
  readAll(): void
  clear(): void
}

export const useNotify = create<NState>((set, get) => {
  const save = (items: NItem[]) => { const u = get().uid; if (u) store.set(feedKey(u), items) }
  return {
    uid: null, items: [], prefs: loadPrefs(),
    bind: uid => set({ uid, items: uid ? store.get<NItem[]>(feedKey(uid)) ?? [] : [] }),
    setPrefs: p => { const prefs = { ...get().prefs, ...p }; store.set(PKEY, prefs); set({ prefs }) },
    setType: (t, on) => get().setPrefs({ types: { ...get().prefs.types, [t]: on } }),
    push: i => { const items = [i, ...get().items.filter(x => x.id !== i.id)].slice(0, MAX); save(items); set({ items }) },
    read: id => { const items = get().items.map(x => x.id === id ? { ...x, read: true } : x); save(items); set({ items }) },
    readAll: () => { const items = get().items.map(x => ({ ...x, read: true })); save(items); set({ items }) },
    clear: () => { save([]); set({ items: [] }) },
  }
})

/* ------------------------------------------------------------ opening */
/** 'b:<booking id>' opens a booking, 'p:<page>' opens a page */
export function openPath(path?: string) {
  if (!path) return
  const ui = useUI.getState()
  if (path.startsWith('b:')) ui.openBooking(path.slice(2))
  else if (path.startsWith('p:')) ui.go(path.slice(2) as Page)
}
if (typeof window !== 'undefined') {
  (window as unknown as { __molokoOpen: typeof openPath }).__molokoOpen = openPath
  navigator.serviceWorker?.addEventListener?.('message', e => { if (e.data?.type === 'moloko-open') openPath(e.data.path) })
  const m = location.hash.match(/^#open=(.+)$/)
  if (m) { history.replaceState(null, '', location.pathname); setTimeout(() => openPath(decodeURIComponent(m[1])), 1500) }
}

/* ------------------------------------------------------------ sound */
let actx: AudioContext | null = null
function chime() {
  try {
    actx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const t = actx.currentTime
    for (const [f, d] of [[880, 0], [1318.5, .12]] as const) {
      const o = actx.createOscillator(), g = actx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.18, t + d + .02); g.gain.exponentialRampToValueAtTime(.001, t + d + .5)
      o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + .55)
    }
  } catch { /* audio blocked until the first tap */ }
}
if (typeof window !== 'undefined') addEventListener('pointerdown', () => { if (actx?.state === 'suspended') actx.resume() }, { once: true })

/* ------------------------------------------------------------ emit */
const quietNow = (p: NPrefs) => {
  if (!p.quiet) return false
  const h = new Date().getHours()
  return p.quietFrom > p.quietTo ? h >= p.quietFrom || h < p.quietTo : h >= p.quietFrom && h < p.quietTo
}

export function emit(type: NType, title: string, body: string, open?: string, key?: string) {
  const st = useNotify.getState()
  if (!st.prefs.types[type]) return
  const id = key ?? `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`
  if (st.items.some(x => x.id === id)) return
  st.push({ id, type, title, body, at: new Date().toISOString(), read: false, open })
  if (quietNow(st.prefs)) return
  if (st.prefs.sound) chime()
  try { navigator.vibrate?.([40, 60, 40]) } catch { /* noop */ }
  const visible = document.visibilityState === 'visible' && document.hasFocus()
  if (visible) toast(`${title}: ${body}`, 'info', open ? { label: 'Открыть', run: () => openPath(open) } : undefined)
  else if (st.prefs.system) systemNotify(title, body, open ?? '', id)
}

/* ------------------------------------------------------------ own changes are not news */
const own = new Map<string, number>()
export const markOwn = (id: string | null | undefined) => { if (id) own.set(id, Date.now()) }
const isOwn = (id: string) => { const t = own.get(id); return !!t && Date.now() - t < 10000 }

const when = (b: Booking) => `${hallById(b.hall).name} · ${dShort(b.date)} ${pad(b.start)}:00`

export function onBooking(prev: Booking | undefined, b: Booking, me: { userId: string } | null) {
  if (b.demo || b.status === 'block') return
  if (!prev) {
    if (b.source === 'Виджет') emit('site', 'Новая заявка с сайта', `${b.name} · ${when(b)}`, `b:${b.id}`, `site:${b.id}`)
    else if (b.createdBy && b.createdBy !== me?.userId) emit('booking', 'Новая бронь', `${b.name} · ${when(b)}`, `b:${b.id}`, `booking:${b.id}`)
    return
  }
  if (isOwn(b.id)) return
  if (b.status === 'paid' && prev.status !== 'paid' && prev.status !== 'done') emit('paid', 'Бронь оплачена', `${b.name} · ${num(b.total)} ₸ · ${when(b)}`, `b:${b.id}`, `paid:${b.id}`)
  else if (b.status === 'cancelled' && prev.status !== 'cancelled') emit('cancel', 'Бронь отменена', `${b.name} · ${when(b)}${b.reason ? ` · ${b.reason}` : ''}`, `b:${b.id}`, `cancel:${b.id}:${b.updatedAt ?? ''}`)
  else if (b.status !== 'cancelled' && (prev.date !== b.date || prev.start !== b.start || prev.hall !== b.hall || prev.hours !== b.hours)) emit('moved', 'Бронь перенесена', `${b.name} · было ${hallById(prev.hall).name} ${dShort(prev.date)} ${pad(prev.start)}:00 → ${when(b)}`, `b:${b.id}`, `moved:${b.id}:${b.date}:${b.start}:${b.hall}:${b.hours}`)
}

export function onRequest(prev: RequestRow | undefined, r: RequestRow, me: { userId: string; role: Role } | null) {
  if (!me) return
  if (!prev && r.status === 'pending' && can(me.role, 'decide') && r.createdBy !== me.userId) emit('request', 'Новый запрос на подтверждение', r.note || 'Откройте раздел «Запросы»', 'p:requests', `req:${r.id}`)
  else if (prev?.status === 'pending' && r.status !== 'pending' && r.createdBy === me.userId) emit('request', r.status === 'approved' ? 'Ваш запрос одобрен' : 'Ваш запрос отклонён', r.answer || r.note || 'Подробности в разделе «Запросы»', r.bookingId ? `b:${r.bookingId}` : 'p:requests', `req-done:${r.id}`)
}

export function onClient(prev: ClientRow | undefined, c: ClientRow) {
  if (prev || isOwn(c.phone)) return
  emit('client', 'Новый клиент', `${c.name || 'Без имени'} · ${c.phone}`, 'p:clients', `client:${c.phone}`)
}

export function onMoney(prev: MoneyRow | undefined, m: MoneyRow, me: { userId: string } | null) {
  if (prev || m.demo || m.createdBy === me?.userId) return
  emit('money', m.kind === 'income' ? 'Поступление' : 'Расход', `${m.kind === 'income' ? '+' : '−'}${num(m.amount)} ₸ · ${m.category}${m.note ? ` · ${m.note}` : ''}`, 'p:finance', `money:${m.id}`)
}

/* ------------------------------------------------------------ reminders */
const RKEY = 'moloko.notify.reminded'
let rTimer: ReturnType<typeof setInterval> | undefined
export function startReminders(getBookings: () => Booking[]) {
  clearInterval(rTimer)
  const tick = () => {
    const { prefs } = useNotify.getState()
    if (!prefs.types.remind) return
    const done = new Set(store.get<string[]>(RKEY) ?? [])
    const now = Date.now(), lead = prefs.remindMin * 60e3
    let changed = false
    for (const b of getBookings()) {
      if (b.demo || (b.status !== 'new' && b.status !== 'paid')) continue
      const st = parseYmd(b.date); st.setHours(b.start, 0, 0, 0)
      const left = st.getTime() - now
      const k = `${b.id}:${b.date}:${b.start}`
      if (left <= 0 || left > lead || done.has(k)) continue
      done.add(k); changed = true
      const mins = Math.max(1, Math.round(left / 60e3))
      emit('remind', mins >= 60 && mins % 60 === 0 ? `Через ${mins / 60} ч съёмка` : `Через ${mins} мин съёмка`, `${b.name} · ${hallById(b.hall).name} · ${pad(b.start)}:00${b.status === 'new' ? ' · не оплачена' : ''}`, `b:${b.id}`, `remind:${k}`)
    }
    if (changed) store.set(RKEY, [...done].slice(-300))
  }
  tick()
  rTimer = setInterval(tick, 30000)
}
export const stopReminders = () => clearInterval(rTimer)
