import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { sb, fromRow, toRow, clientFromRow, txFromRow, staffFromRow, auditFromRow, selectAll, staffFn, loginEmail, ApiError, errCode } from '../lib/supabase'
import { mergeSettings, DEFAULT_SETTINGS, hallById } from '../lib/catalog'
import type { Booking, BonusTx, ClientRow, Settings, Staff, AuditRow } from '../lib/types'
import { dShort, pad, normPhone } from '../lib/format'
import { toast } from '../ui/kit'

type Phase = 'boot' | 'setup' | 'login' | 'app'

interface State {
  phase: Phase
  me: Staff | null
  live: 'connecting' | 'live' | 'offline'
  loaded: boolean
  bookings: Booking[]
  clients: ClientRow[]
  tx: BonusTx[]
  staff: Staff[]
  audit: AuditRow[]
  S: Settings
  init(): Promise<void>
  setup(name: string, login: string, pw: string): Promise<void>
  login(login: string, pw: string): Promise<void>
  logout(): Promise<void>
  loadAll(): Promise<void>
  createBooking(b: Partial<Booking>): Promise<string>
  updateBooking(id: string, patch: Partial<Booking>): Promise<void>
  deleteBooking(id: string): Promise<void>
  upsertClient(phone: string, patch: Partial<ClientRow>): Promise<void>
  addBonus(phone: string, amount: number, note: string): Promise<void>
  saveSettings(S: Settings): Promise<void>
  loadAudit(): Promise<void>
  staffCreate(p: { login: string; name: string; password: string; role: 'owner' | 'admin' }): Promise<void>
  staffDisable(userId: string, disabled: boolean): Promise<void>
  staffPassword(userId: string, password: string): Promise<void>
  seedDemo(): Promise<number>
  clearDemo(): Promise<number>
}

let channel: RealtimeChannel | null = null
const sortB = (a: Booking[]) => a.sort((x, y) => x.date === y.date ? x.start - y.start : x.date < y.date ? -1 : 1)

export const useStudio = create<State>((set, get) => ({
  phase: 'boot', me: null, live: 'connecting', loaded: false,
  bookings: [], clients: [], tx: [], staff: [], audit: [], S: DEFAULT_SETTINGS,

  async init() {
    const { data: { session } } = await sb.auth.getSession()
    if (session) {
      const me = await fetchMe(session.user.id)
      if (me) { set({ me, phase: 'app' }); await get().loadAll(); return }
      await sb.auth.signOut()
    }
    const { data } = await sb.rpc('moloko_needs_setup')
    set({ phase: data === true ? 'setup' : 'login' })
  },

  async setup(name, login, pw) {
    await staffFn({ action: 'bootstrap', name, login, password: pw })
    await get().login(login, pw)
  },

  async login(login, pw) {
    const { data, error } = await sb.auth.signInWithPassword({ email: loginEmail(login), password: pw })
    if (error || !data.user) throw new ApiError(/banned/i.test(error?.message ?? '') ? 'disabled' : 'bad_credentials')
    const me = await fetchMe(data.user.id)
    if (!me) { await sb.auth.signOut(); throw new ApiError('disabled') }
    set({ me, phase: 'app' })
    await get().loadAll()
  },

  async logout() {
    channel?.unsubscribe(); channel = null
    await sb.auth.signOut()
    set({ me: null, phase: 'login', bookings: [], clients: [], tx: [], staff: [], audit: [], loaded: false })
  },

  async loadAll() {
    try {
      const [bookings, clients, tx, staff, st] = await Promise.all([
        selectAll('moloko_bookings', fromRow),
        selectAll('moloko_clients', clientFromRow),
        selectAll('moloko_bonus_tx', txFromRow),
        selectAll('moloko_staff', staffFromRow),
        sb.from('moloko_settings').select('data').eq('id', 1).maybeSingle(),
      ])
      set({ bookings: sortB(bookings), clients, tx, staff, S: mergeSettings(st.data?.data), loaded: true })
    } catch (e) {
      set({ loaded: true, live: 'offline' })
      toast('Не удалось загрузить данные. Проверьте интернет.', 'err')
      return
    }
    subscribe(set, get)
  },

  async createBooking(b) {
    const row = toRow({ ...b, createdBy: get().me?.userId })
    const { data, error } = await sb.from('moloko_bookings').insert(row).select().single()
    if (error) throw new ApiError(errCode(error), error.message)
    const nb = fromRow(data)
    set({ bookings: sortB([...get().bookings.filter(x => x.id !== nb.id), nb]) })
    return nb.id
  },

  async updateBooking(id, patch) {
    const base = get().bookings.find(b => b.id === id)
    const row = toRow(patch, base)
    const prev = get().bookings
    if (base) set({ bookings: sortB(prev.map(b => b.id === id ? { ...b, ...patch } : b)) })
    const { data, error } = await sb.from('moloko_bookings').update(row).eq('id', id).select().single()
    if (error) { set({ bookings: prev }); throw new ApiError(errCode(error), error.message) }
    set({ bookings: sortB(get().bookings.map(b => b.id === id ? fromRow(data) : b)) })
    if (patch.status) refreshTx(set)
  },

  async deleteBooking(id) {
    const prev = get().bookings
    set({ bookings: prev.filter(b => b.id !== id) })
    const { error } = await sb.from('moloko_bookings').delete().eq('id', id)
    if (error) { set({ bookings: prev }); throw new ApiError(errCode(error)) }
  },

  async upsertClient(phone, patch) {
    const p = normPhone(phone)
    const row: Record<string, unknown> = { phone: p }
    if (patch.name !== undefined) row.name = patch.name
    if (patch.note !== undefined) row.note = patch.note
    if (patch.tags !== undefined) row.tags = patch.tags
    if (patch.birthday !== undefined) row.birthday = patch.birthday || null
    if (patch.blocked !== undefined) row.blocked = patch.blocked
    const { data, error } = await sb.from('moloko_clients').upsert(row).select().single()
    if (error) throw new ApiError(errCode(error))
    const c = clientFromRow(data)
    set({ clients: [...get().clients.filter(x => x.phone !== c.phone), c] })
  },

  async addBonus(phone, amount, note) {
    const p = normPhone(phone)
    if (!get().clients.some(c => c.phone === p)) await get().upsertClient(p, {})
    const { data, error } = await sb.from('moloko_bonus_tx').insert({ phone: p, amount, kind: 'manual', note, created_by: get().me?.userId }).select().single()
    if (error) throw new ApiError(errCode(error))
    set({ tx: [...get().tx.filter(t => t.id !== data.id), txFromRow(data)] })
  },

  async saveSettings(S) {
    const { error } = await sb.from('moloko_settings').upsert({ id: 1, data: S, updated_by: get().me?.userId, updated_at: new Date().toISOString() })
    if (error) throw new ApiError(errCode(error))
    set({ S })
  },

  async loadAudit() {
    const { data } = await sb.from('moloko_audit').select('*').order('at', { ascending: false }).limit(300)
    set({ audit: (data ?? []).map(auditFromRow) })
  },

  async staffCreate(p) { await staffFn({ action: 'create', ...p }); await reloadStaff(set) },
  async staffDisable(userId, disabled) { await staffFn({ action: 'set_disabled', user_id: userId, disabled }); await reloadStaff(set) },
  async staffPassword(userId, password) { await staffFn({ action: 'set_password', user_id: userId, password }) },

  async seedDemo() {
    const names: [string, string][] = [['Айгерим Сейткали', '+7 701 214 55 10'], ['Никита Ш. · фотограф', '+7 705 330 19 42'], ['Карина Р. · фотограф', '+7 707 500 77 13'], ['Дана Есенова', '+7 777 880 12 64'], ['Бренд Saule', '+7 701 912 33 08'], ['Арман и Жания', '+7 702 640 80 21'], ['Мадияр К.', '+7 776 105 22 90']]
    const srcs = ['Виджет', 'Виджет', 'WhatsApp', 'Instagram', 'Реферал', '2ГИС']
    const halls = ['white', 'beige', 'grey', 'black']; const S = get().S
    const rows: Record<string, unknown>[] = []
    const t0 = new Date()
    for (let d = -24; d <= 7; d++) {
      const day = new Date(t0); day.setDate(day.getDate() + d)
      const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
      const used: Record<string, [number, number][]> = {}
      for (let i = 0; i < 2 + ((d * 7 + 40) % 4); i++) {
        const hall = halls[(i + d + 40) % 4]; const start = [10, 12, 14, 16, 18, 20][(i * 3 + d + 60) % 6]; const hours = 1 + ((i + d + 30) % 3)
        used[hall] ??= []; if (used[hall].some(([s, h]) => start < s + h && s < start + hours)) continue; used[hall].push([start, hours])
        const [name, phone] = names[(i * 5 + d + 70) % names.length]
        const status = d < 0 ? ((i + d) % 9 === 0 ? 'cancelled' : 'done') : (d === 0 && i === 0 ? 'new' : (i + d) % 4 === 0 ? 'new' : 'paid')
        const total = (S.halls[hall] ?? 20000) * hours
        rows.push(toRow({ hall, date, start, hours, status: status as Booking['status'], name, phone, total, source: srcs[(i + d + 60) % srcs.length], demo: true, guests: 2 + ((i + d + 20) % 6), kind: ['Портрет', 'Семейная', 'Love story', 'Контент для бренда'][(i + d + 40) % 4], equip: [], fines: [], payMethod: status === 'new' ? undefined : 'kaspi', createdBy: get().me?.userId }))
      }
    }
    let ok = 0
    for (let i = 0; i < rows.length; i += 20) {
      const chunk = rows.slice(i, i + 20)
      const { error } = await sb.from('moloko_bookings').insert(chunk)
      if (!error) ok += chunk.length
      else for (const r of chunk) { const { error: e2 } = await sb.from('moloko_bookings').insert(r); if (!e2) ok++ }
    }
    await get().loadAll()
    return ok
  },

  async clearDemo() {
    const n = get().bookings.filter(b => b.demo).length
    const { error } = await sb.from('moloko_bookings').delete().eq('demo', true)
    if (error) throw new ApiError(errCode(error))
    await get().loadAll()
    return n
  },
}))

async function fetchMe(uid: string): Promise<Staff | null> {
  const { data } = await sb.from('moloko_staff').select('*').eq('user_id', uid).maybeSingle()
  if (!data || data.disabled) return null
  return staffFromRow(data)
}
async function reloadStaff(set: (p: Partial<State>) => void) {
  const { data } = await sb.from('moloko_staff').select('*').order('created_at')
  set({ staff: (data ?? []).map(staffFromRow) })
}
let txTimer: ReturnType<typeof setTimeout> | undefined
function refreshTx(set: (p: Partial<State>) => void) {
  clearTimeout(txTimer)
  txTimer = setTimeout(async () => { try { set({ tx: await selectAll('moloko_bonus_tx', txFromRow) }) } catch { /* realtime will catch up */ } }, 400)
}

function subscribe(set: (p: Partial<State>) => void, get: () => State) {
  channel?.unsubscribe()
  set({ live: 'connecting' })
  channel = sb.channel('moloko-crm')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'moloko_bookings' }, (p: any) => {
      const cur = get().bookings
      if (p.eventType === 'DELETE') { set({ bookings: cur.filter(b => b.id !== p.old.id) }); return }
      const nb = fromRow(p.new)
      const isNew = !cur.some(b => b.id === nb.id)
      set({ bookings: sortB([...cur.filter(b => b.id !== nb.id), nb]) })
      if (isNew && nb.source === 'Виджет' && nb.status === 'new') {
        toast(`Новая заявка: ${nb.name}, ${hallById(nb.hall).name} ${dShort(nb.date)} ${pad(nb.start)}:00`, 'info')
        try { navigator.vibrate?.(60) } catch { /* noop */ }
        notifyNew(nb)
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'moloko_clients' }, (p: any) => {
      const cur = get().clients
      if (p.eventType === 'DELETE') { set({ clients: cur.filter(c => c.phone !== p.old.phone) }); return }
      const c = clientFromRow(p.new); set({ clients: [...cur.filter(x => x.phone !== c.phone), c] })
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moloko_bonus_tx' }, (p: any) => {
      const t = txFromRow(p.new); set({ tx: [...get().tx.filter(x => x.id !== t.id), t] })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'moloko_settings' }, (p: any) => { if (p.new?.data) set({ S: mergeSettings(p.new.data) }) })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'moloko_staff' }, () => reloadStaff(set))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') set({ live: 'live' })
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') set({ live: 'offline' })
    })
}

function notifyNew(b: Booking) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
    new Notification('Новая заявка · Moloko', { body: `${b.name} · ${hallById(b.hall).name} · ${dShort(b.date)} ${pad(b.start)}:00`, icon: '/icons/icon-192.png', tag: b.id })
  } catch { /* unsupported */ }
}

// keep the session fresh across tabs
sb.auth.onAuthStateChange((ev) => {
  if (ev === 'SIGNED_OUT' && useStudio.getState().phase === 'app') useStudio.setState({ phase: 'login', me: null })
})
