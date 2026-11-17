import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Phone, MessageCircle, Pencil, CheckCircle2, Wallet, Ban, RotateCcw, Trash2, Plus, Users, Sparkles, PawPrint, Brush, Clock, CalendarDays, Gift, AlertTriangle, ChevronRight } from 'lucide-react'
import { useStudio } from './store'
import { useUI } from './ui'
import { useClient, revenueOf, fines as finesOf, levelTone } from './derive'
import { hallById, EQUIP, FINES, PAY_METHODS, penalty as penaltyOf } from '../lib/catalog'
import { Drawer, StatusPill, cx, toast } from '../ui/kit'
import { money, dLabel, timeRange, hoursLabel, fmtPhone, waLink, relTime, pad, num } from '../lib/format'
import { fail } from './msg'
import type { Booking } from '../lib/types'

export function BookingDrawer() {
  const { bookingId, openBooking } = useUI()
  const b = useStudio(s => s.bookings.find(x => x.id === bookingId))
  return (
    <Drawer open={!!b} onClose={() => openBooking(null)} width={500}>
      {b && <Body key={b.id} b={b} />}
    </Drawer>
  )
}

function Body({ b }: { b: Booking }) {
  const { me, updateBooking, deleteBooking, tx, staff } = useStudio()
  const { openBooking, editBooking, openClient, newBooking } = useUI()
  const client = useClient(b.status === 'block' ? null : b.phone)
  const owner = me?.role === 'owner'
  const hall = hallById(b.hall)
  const [mode, setMode] = useState<null | 'pay' | 'cancel' | 'fine' | 'delete'>(null)
  const [busy, setBusy] = useState(false)
  const toPay = b.total - (b.bonusUsed || 0)
  const fineSum = finesOf(b)
  const bonusTx = tx.filter(t => t.bookingId === b.id)
  const who = (id?: string | null) => staff.find(s => s.userId === id)?.name

  const run = async (patch: Partial<Booking>, ok: string) => {
    setBusy(true)
    try { await updateBooking(b.id, patch); toast(ok); setMode(null) } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const remind = waLink(b.phone, `Здравствуйте, ${b.name.split(' ')[0]}! Напоминаем о съёмке в Moloko Art Studios: ${dLabel(b.date)}, ${timeRange(b.start, b.hours)}, зал ${hall.name}.${b.status === 'new' ? ` К оплате ${money(toPay)} — бронь подтверждается после оплаты.` : ''} Адрес: Торайгырова 21/1, ЖК Sholpan City. До встречи!`)

  return (
    <div className="min-h-full flex flex-col">
      {/* hero */}
      <div className="relative h-[190px] shrink-0 overflow-hidden">
        <img src={hall.img} alt="" className="absolute inset-0 w-full h-full object-cover kenburns" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.72))' }} />
        <button className="absolute right-4 top-4 safe-t size-10 grid place-items-center rounded-full text-white" style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(10px)' }} onClick={() => openBooking(null)} aria-label="Закрыть"><X className="size-4" /></button>
        <div className="absolute left-5 right-5 bottom-4 text-white">
          <div className="flex items-center gap-2 mb-2"><StatusPill s={b.status} />{b.demo && <span className="pill pill-block">демо</span>}</div>
          <div className="font-display text-[24px] leading-tight">{b.status === 'block' ? 'Зал закрыт' : b.name}</div>
          <div className="text-[13.5px] opacity-85 mt-1">Зал {hall.name} · {dLabel(b.date)} · {timeRange(b.start, b.hours)}</div>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* client */}
        {b.status !== 'block' && (
          <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--card-2)' }}>
            <button className="flex-1 min-w-0 flex items-center gap-3 text-left" onClick={() => { openBooking(null); openClient(b.phone) }}>
              <span className="size-11 grid place-items-center rounded-full font-semibold shrink-0" style={{ background: client ? levelTone(client.level.id) : 'var(--card-3)', color: '#1a1714' }}>{(b.name || '?')[0]}</span>
              <span className="min-w-0">
                <span className="block font-semibold truncate">{fmtPhone(b.phone)}</span>
                <span className="block text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{client ? `${client.level.name} · ${client.visits} ${client.visits === 1 ? 'визит' : 'визитов'} · бонусов ${num(client.balance)}` : 'Новый клиент'}{client?.blocked && ' · в чёрном списке'}</span>
              </span>
              <ChevronRight className="size-4 ml-auto shrink-0" style={{ color: 'var(--faint)' }} />
            </button>
            <a className="icon-btn" href={`tel:+${b.phoneNorm || b.phone}`} aria-label="Позвонить"><Phone className="size-4" /></a>
            <a className="icon-btn" href={remind} target="_blank" rel="noopener" aria-label="WhatsApp"><MessageCircle className="size-4" /></a>
          </div>
        )}
        {client?.blocked && <Note tone="bad" icon={<AlertTriangle className="size-4" />}>Клиент в чёрном списке{client.note ? `: ${client.note}` : ''}</Note>}

        {/* facts */}
        <div className="grid grid-cols-2 gap-2">
          <Fact icon={<CalendarDays className="size-4" />} label="Дата" value={dLabel(b.date)} />
          <Fact icon={<Clock className="size-4" />} label="Время" value={`${timeRange(b.start, b.hours)} · ${hoursLabel(b.hours)}`} />
          {b.status !== 'block' && <>
            <Fact icon={<Sparkles className="size-4" />} label="Съёмка" value={b.kind || '—'} />
            <Fact icon={<Users className="size-4" />} label="Гостей" value={String(b.guests ?? '—')} />
          </>}
        </div>
        {b.status !== 'block' && (b.makeup || b.confetti || b.pet || (b.equip?.length ?? 0) > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {b.makeup && <span className="chip !h-8"><Brush className="size-3.5" />Гримёрка</span>}
            {b.confetti && <span className="chip !h-8"><Sparkles className="size-3.5" />Конфетти</span>}
            {b.pet && <span className="chip !h-8"><PawPrint className="size-3.5" />С питомцем</span>}
            {b.equip?.map(id => <span key={id} className="chip !h-8">{EQUIP.find(e => e.id === id)?.n ?? id}</span>)}
          </div>
        )}
        {(b.comment || b.reason) && <div className="text-[14px] rounded-2xl p-3.5 whitespace-pre-wrap" style={{ background: 'var(--card-2)', color: 'var(--ink-2)' }}>{b.comment || b.reason}</div>}

        {/* money */}
        {b.status !== 'block' && (
          <div className="rounded-2xl border hairline overflow-hidden">
            <Row k="Стоимость" v={money(b.total)} />
            {b.bonusUsed > 0 && <Row k="Списано бонусов" v={'−' + money(b.bonusUsed)} tone="var(--gold)" />}
            {(b.fines ?? []).map((f, i) => <Row key={i} k={`Штраф: ${f.name}`} v={'+' + money(f.amount)} tone="var(--bad)" onRemove={owner && b.status !== 'cancelled' ? () => run({ fines: (b.fines ?? []).filter((_, j) => j !== i) }, 'Штраф снят') : undefined} />)}
            {b.status === 'cancelled' && <Row k="Удержано при отмене" v={money(b.penalty || 0)} />}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--card-2)' }}>
              <span className="font-semibold">{b.status === 'new' ? 'К оплате' : b.status === 'cancelled' ? 'Доход' : 'Получено'}</span>
              <span className="font-display text-[20px] num">{money(b.status === 'new' ? toPay + fineSum : revenueOf(b))}</span>
            </div>
          </div>
        )}
        {bonusTx.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{bonusTx.map(t => <span key={t.id} className="chip !h-8" style={{ color: t.amount > 0 ? 'var(--gold)' : 'var(--muted)' }}><Gift className="size-3.5" />{t.amount > 0 ? '+' : ''}{num(t.amount)} {t.kind === 'accrual' ? 'начислено' : t.kind === 'redeem' ? 'списано' : ''}</span>)}</div>
        )}

        {/* inline flows */}
        <AnimatePresence mode="wait">
          {mode === 'pay' && <PayFlow key="pay" b={b} busy={busy} onCancel={() => setMode(null)} onDone={(m) => run({ status: 'paid', payMethod: m, paidAt: new Date().toISOString(), paidBy: me?.userId }, 'Оплата отмечена')} />}
          {mode === 'cancel' && <CancelFlow key="cancel" b={b} busy={busy} onCancel={() => setMode(null)} onDone={(pen, reason) => run({ status: 'cancelled', penalty: pen, reason, cancelledAt: new Date().toISOString(), cancelledBy: me?.userId }, 'Бронь отменена')} />}
          {mode === 'fine' && <FineFlow key="fine" busy={busy} onCancel={() => setMode(null)} onDone={(name, amount) => run({ fines: [...(b.fines ?? []), { name, amount, at: new Date().toISOString(), by: me?.userId }] }, 'Штраф добавлен')} />}
          {mode === 'delete' && (
            <Flow key="del" title={b.status === 'block' ? 'Снять блокировку?' : 'Удалить бронь навсегда?'} text={b.status === 'block' ? 'Время снова станет доступным для записи.' : 'Бронь исчезнет из отчётов. Обычно лучше отменить — тогда история сохранится.'}>
              <button className="btn btn-line flex-1" onClick={() => setMode(null)}>Назад</button>
              <button className="btn btn-danger flex-1" disabled={busy} onClick={async () => { setBusy(true); try { await deleteBooking(b.id); toast(b.status === 'block' ? 'Блокировка снята' : 'Бронь удалена'); openBooking(null) } catch (e) { fail(e) } finally { setBusy(false) } }}>{b.status === 'block' ? 'Снять' : 'Удалить'}</button>
            </Flow>
          )}
        </AnimatePresence>

        <div className="flex-1" />
        <div className="text-[12px] flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--faint)' }}>
          <span>{b.source || 'CRM'} · создана {relTime(b.createdAt)}{who(b.createdBy) ? ` · ${who(b.createdBy)}` : ''}</span>
          {b.paidAt && <span>оплата {relTime(b.paidAt)}{b.payMethod ? ` · ${PAY_METHODS.find(p => p[0] === b.payMethod)?.[1] ?? b.payMethod}` : ''}{who(b.paidBy) ? ` · ${who(b.paidBy)}` : ''}</span>}
        </div>
      </div>

      {/* actions */}
      {!mode && (
        <div className="sticky bottom-0 p-4 pt-3 border-t hairline safe-b flex flex-col gap-2" style={{ background: 'var(--panel, var(--bg))' }}>
          {b.status === 'new' && <button className="btn btn-primary h-12 w-full" onClick={() => setMode('pay')}><Wallet className="size-4" />Отметить оплату · {money(toPay + fineSum)}</button>}
          {b.status === 'paid' && <button className="btn btn-primary h-12 w-full" disabled={busy} onClick={() => run({ status: 'done', doneAt: new Date().toISOString() }, 'Съёмка завершена, бонусы начислены')}><CheckCircle2 className="size-4" />Съёмка состоялась</button>}
          {b.status === 'cancelled' && <button className="btn btn-primary h-12 w-full" disabled={busy} onClick={() => run({ status: 'new', penalty: 0, reason: '' }, 'Бронь восстановлена')}><RotateCcw className="size-4" />Восстановить бронь</button>}
          <div className="flex gap-2">
            {b.status !== 'cancelled' && <button className="btn btn-line flex-1 h-11" onClick={() => editBooking(b.id)}><Pencil className="size-4" />Изменить</button>}
            {(b.status === 'paid' || b.status === 'done') && <button className="btn btn-line flex-1 h-11" onClick={() => setMode('fine')}><Plus className="size-4" />Штраф</button>}
            {(b.status === 'new' || b.status === 'paid') && <button className="btn btn-line flex-1 h-11" style={{ color: 'var(--bad)' }} onClick={() => setMode('cancel')}><Ban className="size-4" />Отменить</button>}
            {b.status === 'done' && <button className="btn btn-line flex-1 h-11" onClick={() => { openBooking(null); newBooking({ hall: b.hall, name: b.name, phone: b.phone, kind: b.kind, guests: b.guests, hours: b.hours, start: b.start }) }}><RotateCcw className="size-4" />Повторить</button>}
            {(b.status === 'block' || owner) && <button className="icon-btn !size-11 shrink-0" style={{ color: 'var(--bad)' }} onClick={() => setMode('delete')} aria-label="Удалить"><Trash2 className="size-4" /></button>}
          </div>
        </div>
      )}
    </div>
  )
}

function PayFlow({ b, busy, onCancel, onDone }: { b: Booking; busy: boolean; onCancel: () => void; onDone: (m: string) => void }) {
  const [m, setM] = useState<string>(b.payMethod || 'kaspi')
  return (
    <Flow title="Как оплатили?" text={`Сумма к получению: ${money(b.total - (b.bonusUsed || 0) + finesOf(b))}`}>
      <div className="grid grid-cols-2 gap-2 w-full">
        {PAY_METHODS.map(([id, n]) => <button key={id} className="chip !h-11 justify-center" aria-pressed={m === id} onClick={() => setM(id)}>{n}</button>)}
      </div>
      <div className="flex gap-2 w-full mt-1">
        <button className="btn btn-line flex-1" onClick={onCancel}>Назад</button>
        <button className="btn btn-primary flex-[2]" disabled={busy} onClick={() => onDone(m)}><CheckCircle2 className="size-4" />Оплачено</button>
      </div>
    </Flow>
  )
}

function CancelFlow({ b, busy, onCancel, onDone }: { b: Booking; busy: boolean; onCancel: () => void; onDone: (pen: number, reason: string) => void }) {
  const p = penaltyOf(b)
  const paid = b.status === 'paid' ? b.total - (b.bonusUsed || 0) : 0
  const auto = Math.round(paid * p.pct / 100)
  const [pen, setPen] = useState(auto)
  const [reason, setReason] = useState('')
  const hrs = Math.round(p.h)
  return (
    <Flow title="Отмена брони" text={p.h < 0 ? 'Время съёмки уже прошло.' : `До съёмки ${hrs} ч. ${p.pct ? `По правилам удерживается ${p.pct}% от оплаты.` : 'Отмена без удержания — больше 72 часов.'}`}>
      {paid > 0 && (
        <label className="w-full"><span className="label">Удержать (остальное вернуть клиенту)</span>
          <input className="field num" inputMode="numeric" value={pen ? num(pen) : ''} placeholder="0" onChange={e => setPen(Math.min(paid, +e.target.value.replace(/\D/g, '') || 0))} />
          <span className="block text-[12px] mt-1.5" style={{ color: 'var(--muted)' }}>Вернуть: {money(paid - pen)}{b.bonusUsed ? ` и ${num(b.bonusUsed)} бонусов` : ''}</span>
        </label>
      )}
      <label className="w-full"><span className="label">Причина</span><input className="field" value={reason} onChange={e => setReason(e.target.value)} placeholder="Например, заболел ребёнок" /></label>
      <div className="flex gap-2 w-full mt-1">
        <button className="btn btn-line flex-1" onClick={onCancel}>Назад</button>
        <button className="btn btn-danger flex-[2]" disabled={busy} onClick={() => onDone(pen, reason)}>Отменить бронь</button>
      </div>
    </Flow>
  )
}

function FineFlow({ busy, onCancel, onDone }: { busy: boolean; onCancel: () => void; onDone: (n: string, a: number) => void }) {
  const [sel, setSel] = useState<number | null>(null)
  const [name, setName] = useState(''), [amount, setAmount] = useState(0)
  return (
    <Flow title="Штраф по правилам студии" text="Сумма добавится к доходу по этой брони.">
      <div className="flex flex-wrap gap-1.5 w-full">
        {FINES.map(([n, a], i) => <button key={n} className="chip" aria-pressed={sel === i} onClick={() => { setSel(i); setName(n); setAmount(a) }}>{n} · {num(a)}</button>)}
      </div>
      <div className="grid grid-cols-[1fr_130px] gap-2 w-full">
        <input className="field" value={name} onChange={e => { setName(e.target.value); setSel(null) }} placeholder="Своё описание" />
        <input className="field num" inputMode="numeric" value={amount ? num(amount) : ''} onChange={e => setAmount(+e.target.value.replace(/\D/g, '') || 0)} placeholder="Сумма" />
      </div>
      <div className="flex gap-2 w-full mt-1">
        <button className="btn btn-line flex-1" onClick={onCancel}>Назад</button>
        <button className="btn btn-primary flex-[2]" disabled={busy || !name || !amount} onClick={() => onDone(name, amount)}>Добавить штраф</button>
      </div>
    </Flow>
  )
}

function Flow({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="rounded-2xl p-4 flex flex-col items-start gap-3" style={{ background: 'var(--card-2)', border: '1px solid var(--line-2)' }}>
      <div><div className="font-display text-[16px]">{title}</div>{text && <div className="text-[13.5px] mt-1" style={{ color: 'var(--muted)' }}>{text}</div>}</div>
      {children}
    </motion.div>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3 min-w-0" style={{ background: 'var(--card-2)' }}>
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>{icon}{label}</div>
      <div className="mt-1 text-[14px] font-medium truncate">{value}</div>
    </div>
  )
}

function Row({ k, v, tone, onRemove }: { k: string; v: string; tone?: string; onRemove?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px] border-b hairline">
      <span className="truncate" style={{ color: 'var(--ink-2)' }}>{k}</span>
      <span className="flex items-center gap-2 num shrink-0" style={{ color: tone }}>{v}{onRemove && <button onClick={onRemove} className="opacity-60 hover:opacity-100" aria-label="Убрать"><X className="size-3.5" /></button>}</span>
    </div>
  )
}

function Note({ tone, icon, children }: { tone: 'bad' | 'warn'; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className={cx('flex items-start gap-2 rounded-2xl p-3 text-[13.5px]')} style={{ background: `color-mix(in oklab, var(--${tone}) 12%, transparent)`, color: `var(--${tone})` }}>{icon}<span>{children}</span></div>
}

export const hourLabel = (h: number) => `${pad(h % 24)}:00`
