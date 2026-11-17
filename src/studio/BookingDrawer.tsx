import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Phone, MessageCircle, Pencil, CheckCircle2, Wallet, Ban, RotateCcw, Trash2, Plus, Users, Sparkles, PawPrint, Brush, Clock, CalendarDays, Gift, AlertTriangle, ChevronRight, Send, Ticket, Heart, BellRing, ShieldQuestion, Layers, Copy, Share2 } from 'lucide-react'
import { can, isOld } from './perm'
import { messageFor, waMessage, waShare, inviteUrl, type TemplateKey } from '../lib/messages'
import { useStudio } from './store'
import { useUI } from './ui'
import { useClient, revenueOf, fines as finesOf, levelTone } from './derive'
import { hallById, EQUIP, FINES, PAY_METHODS, penalty as penaltyOf } from '../lib/catalog'
import { Drawer, Sheet, StatusPill, cx, toast } from '../ui/kit'
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
  const { me, updateBooking, deleteBooking, tx, staff, bookings, clients, request, requests } = useStudio()
  const { openBooking, editBooking, openClient, newBooking } = useUI()
  const client = useClient(b.status === 'block' ? null : b.phone)
  const owner = me?.role === 'owner'
  const hall = hallById(b.hall)
  const [mode, setMode] = useState<null | 'pay' | 'cancel' | 'fine' | 'delete' | 'ask'>(null)
  const [msg, setMsg] = useState<TemplateKey | null>(null)
  const role = me?.role
  const isBlock = b.status === 'block'
  const writable = isBlock ? can(role, 'block') : can(role, 'book')
  const locked = writable && !isBlock && isOld(b.date) && !can(role, 'editOld')
  const canAct = writable && !locked
  const canDelete = isBlock ? can(role, 'block') : can(role, 'deleteAny')
  const group = b.groupId ? bookings.filter(x => x.groupId === b.groupId).sort((x, y) => x.date === y.date ? x.start - y.start : x.date < y.date ? -1 : 1) : [b]
  const myReq = requests.find(r => r.bookingId === b.id && r.status === 'pending')
  const refCode = clients.find(c => c.phone === b.phoneNorm)?.refCode
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

        {group.length > 1 && (
          <div className="rounded-2xl p-3" style={{ background: 'var(--accent-soft)' }}>
            <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}><Layers className="size-4" />Комбо-бронь · {group.length} части</div>
            <div className="mt-2 flex flex-col gap-1">
              {group.map(x => (
                <button key={x.id} onClick={() => openBooking(x.id)} className={cx('flex items-center gap-2 text-[13px] text-left rounded-lg px-2 py-1', x.id === b.id ? 'bg-[var(--card-2)] font-medium' : 'hover:bg-[var(--card-2)]')}>
                  <span className="size-2 rounded-full" style={{ background: hallById(x.hall).tone }} />{hallById(x.hall).name} · {dLabel(x.date, false)} · {timeRange(x.start, x.hours)}<StatusPill s={x.status} />
                </button>
              ))}
            </div>
          </div>
        )}
        {myReq && <Note tone="warn" icon={<ShieldQuestion className="size-4" />}>Ждёт решения владельца: {REQ_LABEL[myReq.kind]}{myReq.note ? ` — ${myReq.note}` : ''}</Note>}
        {locked && !myReq && <Note tone="warn" icon={<ShieldQuestion className="size-4" />}>Бронь старше двух дней: изменить или отменить её можно только через запрос владельцу.</Note>}

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
            {(b.discount ?? 0) > 0 && <Row k={`Скидка по приглашению ${String(b.refPct ?? 5)}%`} v={'−' + money(Number(b.discount))} tone="var(--good)" />}
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

        {/* talk to the client */}
        {!isBlock && b.status !== 'cancelled' && can(role, 'book') && (
          <div className="grid grid-cols-2 gap-2">
            {b.status === 'new' && <CommBtn icon={<Send className="size-4" />} label="Связаться" sub="детали и счёт" onClick={() => setMsg('contact')} />}
            {b.status === 'paid' && <CommBtn icon={<BellRing className="size-4" />} label="Напомнить" sub="о съёмке" onClick={() => setMsg('remind')} />}
            {b.status === 'done' && <CommBtn icon={<Heart className="size-4" />} label="Благодарность" sub="и просьба об отзыве" onClick={() => setMsg('thanks')} />}
            {(b.status === 'new' || b.status === 'paid') && <CommBtn icon={<Ticket className="size-4" />} label="Пригласительные" sub="для фотографа" onClick={() => setMsg('invite')} />}
            {b.status === 'done' && <CommBtn icon={<Ticket className="size-4" />} label="Пригласительное" sub="ссылка на карточку" onClick={() => setMsg('invite')} />}
          </div>
        )}

        {/* inline flows */}
        <AnimatePresence mode="wait">
          {mode === 'pay' && <PayFlow key="pay" b={b} busy={busy} onCancel={() => setMode(null)} onDone={(m) => run({ status: 'paid', payMethod: m, paidAt: new Date().toISOString(), paidBy: me?.userId }, 'Оплата отмечена')} />}
          {mode === 'cancel' && <CancelFlow key="cancel" b={b} busy={busy} onCancel={() => setMode(null)} onDone={(pen, reason) => run({ status: 'cancelled', penalty: pen, reason, cancelledAt: new Date().toISOString(), cancelledBy: me?.userId }, 'Бронь отменена')} />}
          {mode === 'fine' && <FineFlow key="fine" busy={busy} onCancel={() => setMode(null)} onDone={(name, amount) => run({ fines: [...(b.fines ?? []), { name, amount, at: new Date().toISOString(), by: me?.userId }] }, 'Штраф добавлен')} />}
          {mode === 'ask' && <AskFlow key="ask" busy={busy} onCancel={() => setMode(null)} onDone={async (kind, note) => { setBusy(true); try { await request({ bookingId: b.id, kind, note }); toast('Запрос отправлен владельцу'); setMode(null) } catch (e) { fail(e) } finally { setBusy(false) } }} />}
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
      {!mode && writable && (
        <div className="sticky bottom-0 p-4 pt-3 border-t hairline safe-b flex flex-col gap-2" style={{ background: 'var(--panel, var(--bg))' }}>
          {locked ? (
            <button className="btn btn-primary h-12 w-full" disabled={!!myReq} onClick={() => setMode('ask')}><ShieldQuestion className="size-4" />{myReq ? 'Запрос уже у владельца' : 'Попросить владельца изменить'}</button>
          ) : <>
            {b.status === 'new' && <button className="btn btn-primary h-12 w-full" onClick={() => setMode('pay')}><Wallet className="size-4" />Отметить оплату · {money(toPay + fineSum)}</button>}
            {b.status === 'paid' && <button className="btn btn-primary h-12 w-full" disabled={busy} onClick={() => run({ status: 'done', doneAt: new Date().toISOString() }, 'Съёмка завершена, бонусы начислены')}><CheckCircle2 className="size-4" />Съёмка состоялась</button>}
            {b.status === 'cancelled' && <button className="btn btn-primary h-12 w-full" disabled={busy} onClick={() => run({ status: 'new', penalty: 0, reason: '' }, 'Бронь восстановлена')}><RotateCcw className="size-4" />Восстановить бронь</button>}
          </>}
          <div className="flex gap-2">
            {canAct && b.status !== 'cancelled' && <button className="btn btn-line flex-1 h-11" onClick={() => editBooking(b.id)}><Pencil className="size-4" />Изменить</button>}
            {canAct && (b.status === 'paid' || b.status === 'done') && <button className="btn btn-line flex-1 h-11" onClick={() => setMode('fine')}><Plus className="size-4" />Штраф</button>}
            {canAct && (b.status === 'new' || b.status === 'paid') && <button className="btn btn-line flex-1 h-11" style={{ color: 'var(--bad)' }} onClick={() => setMode('cancel')}><Ban className="size-4" />Отменить</button>}
            {can(role, 'book') && b.status === 'done' && <button className="btn btn-line flex-1 h-11" onClick={() => { openBooking(null); newBooking({ hall: b.hall, name: b.name, phone: b.phone, kind: b.kind, guests: b.guests, hours: b.hours, start: b.start }) }}><RotateCcw className="size-4" />Повторить</button>}
            {canDelete
              ? <button className="icon-btn !size-11 shrink-0" style={{ color: 'var(--bad)' }} onClick={() => setMode('delete')} aria-label="Удалить"><Trash2 className="size-4" /></button>
              : !isBlock && !locked && !myReq && <button className="icon-btn !size-11 shrink-0" title="Попросить владельца удалить" style={{ color: 'var(--muted)' }} onClick={() => setMode('ask')} aria-label="Запрос на удаление"><ShieldQuestion className="size-4" /></button>}
          </div>
        </div>
      )}
      <MessageSheet k={msg} onClose={() => setMsg(null)} group={group} refCode={refCode} />
    </div>
  )
}

const REQ_LABEL: Record<string, string> = { delete: 'удалить бронь', edit: 'изменить бронь', cancel: 'отменить бронь', refund: 'вернуть деньги', other: 'другое' }

function CommBtn({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 rounded-2xl p-3 text-left transition-colors hover:bg-[var(--card-3)] active:scale-[.98]" style={{ background: 'var(--card-2)' }}>
      <span className="size-9 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{icon}</span>
      <span className="min-w-0"><span className="block text-[13.5px] font-semibold truncate">{label}</span><span className="block text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>{sub}</span></span>
    </button>
  )
}

const MSG_TITLE: Record<TemplateKey, string> = { contact: 'Сообщение клиенту', remind: 'Напоминание о съёмке', thanks: 'Благодарность и отзыв', invite: 'Пригласительные' }

function MessageSheet({ k, onClose, group, refCode }: { k: TemplateKey | null; onClose: () => void; group: Booking[]; refCode?: string | null }) {
  const S = useStudio(s => s.S)
  const [text, setText] = useState('')
  const b = group[0]
  const key = k ?? 'contact'
  const initial = b ? messageFor(key, S, group, refCode) : ''
  const value = text || initial
  const copy = async (t: string, what = 'Текст скопирован') => { try { await navigator.clipboard.writeText(t); toast(what) } catch { toast('Не удалось скопировать', 'err') } }
  const share = async () => { try { await navigator.share({ title: 'Moloko Art Studios', text: value }) } catch { /* cancelled */ } }
  return (
    <Sheet open={!!k} onClose={() => { onClose(); setText('') }} title={k ? MSG_TITLE[k] : ''}>
      {b && k && (
        <div className="flex flex-col gap-3 pt-1">
          {k === 'invite' && (
            <a href={inviteUrl(b.id)} target="_blank" rel="noopener" className="relative h-36 rounded-2xl overflow-hidden block group">
              <img src={hallById(b.hall).img} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.75))' }} />
              <span className="absolute left-4 bottom-3 right-4 text-white"><span className="block text-[11px] tracking-[.18em] uppercase opacity-80">Пригласительное · открыть</span><span className="block font-display text-[18px]">{group.map(x => hallById(x.hall).name).join(' + ')} · {dLabel(b.date, false)}</span></span>
            </a>
          )}
          <textarea className="field !text-[14.5px] leading-relaxed" rows={k === 'contact' ? 12 : 8} value={value} onChange={e => setText(e.target.value)} />
          <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Можно поправить текст перед отправкой. Шаблон меняется в разделе «Сообщения».</div>
          <div className="grid grid-cols-2 gap-2">
            {k === 'invite'
              ? <a className="btn btn-primary h-12 col-span-2" href={waShare(value)} target="_blank" rel="noopener"><MessageCircle className="size-4" />Отправить в WhatsApp</a>
              : <a className="btn btn-primary h-12 col-span-2" href={waMessage(b.phone, value)} target="_blank" rel="noopener"><MessageCircle className="size-4" />Открыть WhatsApp клиента</a>}
            <button className="btn btn-line h-11" onClick={() => copy(value)}><Copy className="size-4" />Копировать</button>
            {k === 'invite'
              ? <button className="btn btn-line h-11" onClick={() => copy(inviteUrl(b.id), 'Ссылка скопирована')}><Copy className="size-4" />Только ссылка</button>
              : typeof navigator.share === 'function' ? <button className="btn btn-line h-11" onClick={share}><Share2 className="size-4" />Поделиться</button> : <a className="btn btn-line h-11" href={`tel:+${b.phoneNorm}`}><Phone className="size-4" />Позвонить</a>}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function AskFlow({ busy, onCancel, onDone }: { busy: boolean; onCancel: () => void; onDone: (k: 'edit' | 'cancel' | 'delete' | 'refund', note: string) => void }) {
  const [k, setK] = useState<'edit' | 'cancel' | 'delete' | 'refund'>('edit')
  const [note, setNote] = useState('')
  return (
    <Flow title="Запрос владельцу" text="Опишите, что нужно сделать. Владелец получит уведомление и подтвердит или отклонит запрос.">
      <div className="flex flex-wrap gap-1.5">{([['edit', 'Изменить'], ['cancel', 'Отменить'], ['refund', 'Вернуть деньги'], ['delete', 'Удалить']] as const).map(([id, n]) => <button key={id} className="chip" aria-pressed={k === id} onClick={() => setK(id)}>{n}</button>)}</div>
      <textarea className="field w-full" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Например: клиент перенёс съёмку на 25 ноября, 14:00, тот же зал" />
      <div className="flex gap-2 w-full mt-1">
        <button className="btn btn-line flex-1" onClick={onCancel}>Назад</button>
        <button className="btn btn-primary flex-[2]" disabled={busy || note.trim().length < 3} onClick={() => onDone(k, note.trim())}>Отправить запрос</button>
      </div>
    </Flow>
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
