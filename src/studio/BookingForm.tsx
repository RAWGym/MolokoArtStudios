import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Lock, CalendarPlus, Gift, Pencil, Plus, X, Layers } from 'lucide-react'
import { useStudio } from './store'
import { useUI } from './ui'
import { useClients, clash, levelTone } from './derive'
import { HALLS, EQUIP, KINDS, SOURCES, PAY_METHODS, quote, hallById, noConfetti } from '../lib/catalog'
import { Sheet, Segmented, Stepper, Switch, Field, cx, toast } from '../ui/kit'
import { money, maskPhone, normPhone, fmtPhone, today, pad, num, timeRange, dShort } from '../lib/format'
import { fail } from './msg'
import { can } from './perm'
import type { Booking, Status } from '../lib/types'

type F = {
  mode: 'booking' | 'block'
  hall: string; date: string; start: number; hours: number
  name: string; phone: string; kind: string; guests: number; equip: string[]
  makeup: boolean; confetti: boolean; pet: boolean
  source: string; comment: string; status: Status; payMethod: string
  bonusUsed: number; manual: boolean; total: number
}

type Seg = { key: number; hall: string; date: string; start: number; hours: number }

const blank = (): F => {
  const h = new Date().getHours() + 1
  return { mode: 'booking', hall: 'white', date: today(), start: Math.min(22, Math.max(9, h)), hours: 2, name: '', phone: '', kind: KINDS[0], guests: 2, equip: [], makeup: false, confetti: false, pet: false, source: 'WhatsApp', comment: '', status: 'new', payMethod: 'kaspi', bonusUsed: 0, manual: false, total: 0 }
}

export function BookingForm() {
  const { form, closeForm } = useUI()
  const b = useStudio(s => form.editId ? s.bookings.find(x => x.id === form.editId) : undefined)
  const title = form.editId ? (b?.status === 'block' ? 'Блокировка зала' : 'Изменить бронь') : form.prefill.mode === 'block' ? 'Закрыть зал' : 'Новая бронь'
  return (
    <Sheet open={form.open} onClose={closeForm} title={title} wide>
      {form.open && <Body key={form.editId ?? 'new' + JSON.stringify(form.prefill)} edit={b} />}
    </Sheet>
  )
}

function Body({ edit }: { edit?: Booking }) {
  const { S, bookings, createBooking, updateBooking, me } = useStudio()
  const canBook = can(me?.role, 'book')
  const { form, closeForm, openBooking } = useUI()
  const clients = useClients()
  const [f, setF] = useState<F>(() => {
    const base = blank()
    const src: Partial<Booking> & { mode?: 'booking' | 'block' } = edit ?? form.prefill
    const out: F = { ...base }
    for (const k of Object.keys(base) as (keyof F)[]) if (src[k as string] !== undefined && src[k as string] !== null) (out as any)[k] = src[k as string]
    if (edit?.status === 'block' || form.prefill.mode === 'block' || !canBook) out.mode = 'block'
    if (src.phone) out.phone = maskPhone(src.phone)
    if (edit) out.manual = edit.total !== quote(edit, S).total
    return out
  })
  const set = <K extends keyof F>(k: K, v: F[K]) => setF(x => ({ ...x, [k]: v }))
  const [busy, setBusy] = useState(false)
  const [suggest, setSuggest] = useState(false)
  const block = f.mode === 'block'
  const [more, setMore] = useState<Seg[]>([])
  const combo = !edit && !block && more.length > 0
  const segQ = more.map(s => quote({ hall: s.hall, start: s.start, hours: s.hours, guests: 1, equip: [], confetti: false, makeup: false }, S).total)
  const segClash = more.map((s, i) => {
    const hit = clash(bookings, s.hall, s.date, s.start, s.hours)
    if (hit) return hit.status === 'block' ? 'зал закрыт' : `занято: ${hit.name}`
    const all = [{ hall: f.hall, date: f.date, start: f.start, hours: f.hours }, ...more.slice(0, i)]
    const t0 = new Date(s.date + 'T00:00').getTime() + s.start * 36e5, t1 = t0 + s.hours * 36e5
    return all.some(o => { const o0 = new Date(o.date + 'T00:00').getTime() + o.start * 36e5; return o.hall === s.hall && o0 < t1 && o0 + o.hours * 36e5 > t0 }) ? 'пересекается с этой же бронью' : null
  })
  const comboTotal = f.total + segQ.reduce((a, b) => a + b, 0)
  const addSeg = () => setMore(m => { const last = m[m.length - 1] ?? f; const free = HALLS.find(h => h.id !== last.hall) ?? HALLS[0]; return [...m, { key: Date.now(), hall: free.id, date: last.date, start: Math.min(23, last.start + last.hours), hours: 1 }] })
  const setSeg = (key: number, p: Partial<Seg>) => setMore(m => m.map(x => x.key === key ? { ...x, ...p } : x))

  const q = useMemo(() => quote({ hall: f.hall, start: f.start, hours: f.hours, guests: f.guests, equip: f.equip, confetti: f.confetti, makeup: f.makeup }, S), [f.hall, f.start, f.hours, f.guests, f.equip, f.confetti, f.makeup, S])
  useEffect(() => { if (!f.manual) set('total', q.total) }, [q.total, f.manual]) // eslint-disable-line
  const conflict = clash(bookings, f.hall, f.date, f.start, f.hours, edit?.id)
  const pn = normPhone(f.phone)
  const client = pn.length === 11 ? clients.find(c => c.phone === pn) : undefined
  const balance = client?.balance ?? 0
  const maxBonus = Math.max(0, Math.min(balance + (edit && (edit.status === 'paid' || edit.status === 'done') ? edit.bonusUsed : 0), Math.floor(f.total * S.loyalty.maxRedeemPct / 100)))
  useEffect(() => { if (f.bonusUsed > maxBonus) set('bonusUsed', maxBonus) }, [maxBonus]) // eslint-disable-line

  const matches = useMemo(() => {
    const s = f.name.trim().toLowerCase(), d = f.phone.replace(/\D/g, '')
    if (!suggest || (s.length < 2 && d.length < 4)) return []
    return clients.filter(c => (s.length >= 2 && c.name.toLowerCase().includes(s)) || (d.length >= 4 && c.phone.includes(d.replace(/^8/, '7')))).slice(0, 5)
  }, [f.name, f.phone, suggest, clients])

  const valid = block ? true : f.name.trim().length >= 2 && pn.length === 11
  const submit = async () => {
    if (!valid) { toast(f.name.trim().length < 2 ? 'Укажите имя клиента' : 'Проверьте номер телефона', 'err'); return }
    if (conflict) { toast('Это время уже занято', 'err'); return }
    if (!block && noConfetti(f.hall) && f.confetti) { toast(`В зале ${hallById(f.hall).name} конфетти запрещено`, 'err'); return }
    if (combo && segClash.some(Boolean)) { toast('Один из залов комбо-брони занят', 'err'); return }
    setBusy(true)
    const payload: Partial<Booking> = block
      ? { hall: f.hall, date: f.date, start: f.start, hours: f.hours, status: 'block', name: 'Блокировка', phone: '', total: 0, comment: f.comment, source: 'CRM' }
      : { hall: f.hall, date: f.date, start: f.start, hours: f.hours, name: f.name.trim(), phone: fmtPhone(f.phone), kind: f.kind, guests: f.guests, equip: f.equip, makeup: f.makeup, confetti: f.confetti, pet: f.pet, source: f.source, comment: f.comment, total: f.total, bonusUsed: f.bonusUsed }
    if (!block && !edit) { payload.status = f.status; if (f.status === 'paid') { payload.payMethod = f.payMethod; payload.paidAt = new Date().toISOString() } }
    try {
      if (edit) { await updateBooking(edit.id, payload); toast('Изменения сохранены'); closeForm(); openBooking(edit.id) }
      else {
        if (combo) payload.groupId = crypto.randomUUID()
        const id = await createBooking(payload)
        if (combo) for (const [i, sg] of more.entries()) await createBooking({ ...payload, hall: sg.hall, date: sg.date, start: sg.start, hours: sg.hours, total: segQ[i], bonusUsed: 0, equip: [], makeup: false, confetti: false, comment: [payload.comment, 'Комбо-бронь'].filter(Boolean).join(' · ') })
        toast(block ? 'Зал закрыт на это время' : combo ? `Комбо-бронь создана · ${more.length + 1} зала` : 'Бронь создана', 'ok', block ? undefined : { label: 'Открыть', run: () => openBooking(id) }); closeForm()
      }
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const hours = Array.from({ length: 24 }, (_, h) => h)
  return (
    <div className="flex flex-col gap-5 pt-1">
      {!edit && canBook && <Segmented value={f.mode} onChange={v => set('mode', v)} items={[['booking', <span className="flex items-center gap-1.5"><CalendarPlus className="size-3.5" />Бронь</span>], ['block', <span className="flex items-center gap-1.5"><Lock className="size-3.5" />Закрыть зал</span>]]} className="self-start" />}

      {/* hall */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {HALLS.map(h => (
          <button key={h.id} type="button" onClick={() => set('hall', h.id)} className={cx('relative h-[72px] rounded-2xl overflow-hidden text-left transition-transform active:scale-[.97]', f.hall === h.id ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : 'opacity-75 hover:opacity-100')}>
            <img src={h.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,.7))' }} />
            <span className="absolute left-2.5 bottom-2 text-white text-[12px] font-semibold tracking-[.08em]">{h.name}</span>
            {!block && <span className="absolute right-2 top-1.5 text-white/85 text-[10.5px] num">{num(S.halls[h.id] ?? 0)}</span>}
          </button>
        ))}
      </div>

      {/* when */}
      <div className="grid grid-cols-2 sm:grid-cols-[1.3fr_1fr_auto] gap-3 items-end">
        <Field label="Дата" className="col-span-2 sm:col-span-1"><input type="date" className="field" value={f.date} onChange={e => e.target.value && set('date', e.target.value)} /></Field>
        <Field label="Начало"><select className="field" value={f.start} onChange={e => set('start', +e.target.value)}>{hours.map(h => <option key={h} value={h}>{pad(h)}:00</option>)}</select></Field>
        <Field label="Часов"><Stepper value={f.hours} onChange={v => set('hours', v)} min={1} max={block ? 24 : 12} /></Field>
      </div>
      <AnimatePresence initial={false}>
        {conflict ? (
          <motion.button key="c" type="button" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onClick={() => { closeForm(); openBooking(conflict.id) }} className="flex items-center gap-2 rounded-2xl p-3 text-[13.5px] text-left" style={{ background: 'color-mix(in oklab, var(--bad) 12%, transparent)', color: 'var(--bad)' }}>
            <AlertTriangle className="size-4 shrink-0" />Пересекается: {conflict.status === 'block' ? 'блокировка' : conflict.name}, {dShort(conflict.date)} {timeRange(conflict.start, conflict.hours)}
          </motion.button>
        ) : (
          <motion.div key="ok" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--good)' }}>
            <Check className="size-4" />Зал {hallById(f.hall).name} свободен · {timeRange(f.start, f.hours)}
          </motion.div>
        )}
      </AnimatePresence>

      {!edit && !block && (
        <div className="flex flex-col gap-2 -mt-1">
          <AnimatePresence initial={false}>
            {more.map((sg, i) => (
              <motion.div key={sg.key} layout initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, height: 0, marginTop: -8 }} className="rounded-2xl p-3 border hairline" style={{ background: 'var(--card-2)' }}>
                <div className="flex items-center gap-2 mb-2 text-[12.5px]" style={{ color: 'var(--muted)' }}><Layers className="size-3.5" />Зал {i + 2}<span className="ml-auto num">{money(segQ[i])}</span><button type="button" className="icon-btn !size-7" aria-label="Убрать" onClick={() => setMore(m => m.filter(x => x.key !== sg.key))}><X className="size-3.5" /></button></div>
                <div className="grid grid-cols-2 sm:grid-cols-[1fr_1.2fr_.9fr_auto] gap-2 items-center">
                  <select className="field !h-11" value={sg.hall} onChange={e => setSeg(sg.key, { hall: e.target.value })}>{HALLS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
                  <input type="date" className="field !h-11" value={sg.date} onChange={e => e.target.value && setSeg(sg.key, { date: e.target.value })} />
                  <select className="field !h-11" value={sg.start} onChange={e => setSeg(sg.key, { start: +e.target.value })}>{hours.map(h => <option key={h} value={h}>{pad(h)}:00</option>)}</select>
                  <Stepper value={sg.hours} onChange={v => setSeg(sg.key, { hours: v })} min={1} max={12} />
                </div>
                <div className="text-[12.5px] mt-2 flex items-center gap-1.5" style={{ color: segClash[i] ? 'var(--bad)' : 'var(--good)' }}>{segClash[i] ? <><AlertTriangle className="size-3.5" />{segClash[i]}</> : <><Check className="size-3.5" />{timeRange(sg.start, sg.hours)} свободно</>}</div>
              </motion.div>
            ))}
          </AnimatePresence>
          {more.length < 5 && <button type="button" className="self-start text-[13px] flex items-center gap-1.5 font-medium" style={{ color: 'var(--accent)' }} onClick={addSeg}><Plus className="size-4" />{more.length ? 'Ещё зал' : 'Комбо: добавить другой зал или время'}</button>}
        </div>
      )}

      {block ? (
        <Field label="Причина"><textarea className="field" rows={2} value={f.comment} onChange={e => set('comment', e.target.value)} placeholder="Уборка, ремонт, своя съёмка…" /></Field>
      ) : <>
        {/* client */}
        <div className="relative grid sm:grid-cols-2 gap-3">
          <Field label="Имя клиента"><input className="field" value={f.name} onFocus={() => setSuggest(true)} onChange={e => { set('name', e.target.value); setSuggest(true) }} placeholder="Айгерим" autoComplete="off" /></Field>
          <Field label="Телефон"><input className="field num" inputMode="tel" value={f.phone} onFocus={() => setSuggest(true)} onChange={e => { set('phone', maskPhone(e.target.value)); setSuggest(true) }} placeholder="+7 (7__) ___-__-__" autoComplete="off" /></Field>
          <AnimatePresence>
            {matches.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 top-[84px] z-20 panel rounded-2xl p-1.5 border hairline" style={{ boxShadow: 'var(--shadow)' }}>
                {matches.map(c => (
                  <button key={c.phone} type="button" className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-[var(--card-2)]" onClick={() => { setF(x => ({ ...x, name: c.name, phone: maskPhone(c.phone) })); setSuggest(false) }}>
                    <span className="size-8 rounded-full grid place-items-center text-[12px] font-semibold" style={{ background: levelTone(c.level.id), color: '#1a1714' }}>{c.name[0] ?? '?'}</span>
                    <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{c.name}</span><span className="block text-[12px]" style={{ color: 'var(--muted)' }}>{fmtPhone(c.phone)} · {c.visits} виз. · {c.level.name}</span></span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {client && (
          <div className="flex items-center gap-2.5 text-[13px] -mt-2" style={{ color: client.blocked ? 'var(--bad)' : 'var(--muted)' }}>
            <span className="size-2.5 rounded-full" style={{ background: levelTone(client.level.id) }} />
            {client.blocked ? `В чёрном списке${client.note ? ': ' + client.note : ''}` : `Постоянный клиент · ${client.level.name} · ${client.visits} визитов · бонусов ${num(client.balance)}`}
          </div>
        )}

        <div>
          <span className="label">Тип съёмки</span>
          <div className="flex flex-wrap gap-1.5">{KINDS.map(k => <button key={k} type="button" className="chip" aria-pressed={f.kind === k} onClick={() => set('kind', k)}>{k}</button>)}</div>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          <div className="flex items-center justify-between gap-3"><span className="text-[14px]">Гостей <span style={{ color: 'var(--muted)' }}>· до {S.freeGuests} бесплатно</span></span><Stepper value={f.guests} onChange={v => set('guests', v)} min={1} max={40} /></div>
          <Toggle label="Гримёрка за час" on={f.makeup} set={v => set('makeup', v)} />
          <Toggle label={noConfetti(f.hall) ? `Конфетти (нельзя в ${hallById(f.hall).name})` : 'Конфетти'} on={f.confetti} set={v => set('confetti', v)} disabled={noConfetti(f.hall)} />
          <Toggle label="С питомцем" on={f.pet} set={v => set('pet', v)} />
        </div>

        <div>
          <span className="label">Оборудование</span>
          <div className="flex flex-wrap gap-1.5">{EQUIP.map(e => { const on = f.equip.includes(e.id); return <button key={e.id} type="button" className="chip" aria-pressed={on} onClick={() => set('equip', on ? f.equip.filter(x => x !== e.id) : [...f.equip, e.id])}>{e.n}<span className="opacity-60 num">{num(S.equip[e.id] ?? 0)}/ч</span></button> })}</div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Источник"><select className="field" value={f.source} onChange={e => set('source', e.target.value)}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></Field>
          {!edit && <Field label="Статус">
            <div className="flex gap-1.5 h-12 items-center">
              <button type="button" className="chip flex-1 justify-center !h-11" aria-pressed={f.status === 'new'} onClick={() => set('status', 'new')}>Ждёт оплаты</button>
              <button type="button" className="chip flex-1 justify-center !h-11" aria-pressed={f.status === 'paid'} onClick={() => set('status', 'paid')}>Оплачено</button>
            </div>
          </Field>}
        </div>
        {!edit && f.status === 'paid' && <div className="flex flex-wrap gap-1.5 -mt-2">{PAY_METHODS.map(([id, n]) => <button key={id} type="button" className="chip" aria-pressed={f.payMethod === id} onClick={() => set('payMethod', id)}>{n}</button>)}</div>}
        <Field label="Комментарий"><textarea className="field" rows={2} value={f.comment} onChange={e => set('comment', e.target.value)} placeholder="Пожелания, референсы, кто фотограф…" /></Field>

        {/* money */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--card-2)' }}>
          {q.lines.map(([k, v]) => <div key={k} className="flex justify-between gap-3 text-[13.5px]" style={{ color: 'var(--ink-2)' }}><span className="truncate">{k}</span><span className="num shrink-0">{money(v)}</span></div>)}
          <div className="flex items-center justify-between gap-3 pt-2 border-t hairline">
            <span className="font-semibold">Итого</span>
            {f.manual
              ? <input className="field !h-10 !w-36 text-right num" inputMode="numeric" value={num(f.total)} onChange={e => set('total', +e.target.value.replace(/\D/g, '') || 0)} />
              : <span className="font-display text-[20px] num">{money(f.total)}</span>}
          </div>
          <button type="button" className="self-end text-[12.5px] flex items-center gap-1.5" style={{ color: 'var(--accent)' }} onClick={() => set('manual', !f.manual)}><Pencil className="size-3" />{f.manual ? 'Считать по прайсу' : 'Своя цена'}</button>
          {S.loyalty.enabled && maxBonus > 0 && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t hairline">
              <span className="flex items-center gap-2 text-[14px]"><Gift className="size-4" style={{ color: 'var(--gold)' }} />Списать бонусы <span style={{ color: 'var(--muted)' }}>до {num(maxBonus)}</span></span>
              <Switch on={f.bonusUsed > 0} onChange={v => set('bonusUsed', v ? maxBonus : 0)} />
            </div>
          )}
          {combo && <div className="flex justify-between gap-3 text-[13.5px]" style={{ color: 'var(--ink-2)' }}><span>Ещё {more.length} {more.length === 1 ? 'зал' : 'зала'} по прайсу</span><span className="num">{money(comboTotal - f.total)}</span></div>}
          {(f.bonusUsed > 0 || combo) && <div className="flex justify-between font-semibold"><span>К оплате{combo ? ' за всё' : ''}</span><span className="num">{money(comboTotal - f.bonusUsed)}</span></div>}
        </div>
      </>}

      <div className="sticky bottom-0 -mx-5 md:-mx-7 px-5 md:px-7 pt-3 pb-1 flex gap-2" style={{ background: 'linear-gradient(transparent, var(--panel, var(--bg)) 30%)' }}>
        <button type="button" className="btn btn-line h-12 flex-1" onClick={closeForm}>Отмена</button>
        <button type="button" className="btn btn-primary h-12 flex-[2]" disabled={busy || !!conflict || !valid || (combo && segClash.some(Boolean))} onClick={submit}>{busy ? 'Сохраняем…' : edit ? 'Сохранить' : block ? 'Закрыть зал' : `Создать · ${money(comboTotal - f.bonusUsed)}`}</button>
      </div>
    </div>
  )
}

function Toggle({ label, on, set, disabled }: { label: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return <div className={cx('flex items-center justify-between gap-3 min-h-11', disabled && 'opacity-45 pointer-events-none')}><span className="text-[14px]">{label}</span><Switch on={on && !disabled} onChange={set} label={label} /></div>
}
