import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, ArrowUpRight, ArrowDownRight, CalendarDays, Trash2, Search } from 'lucide-react'
import { useStudio } from '../store'
import { useUI } from '../ui'
import { revenueOf } from '../derive'
import { Card, PageHead } from '../common'
import { hallById, PAY_METHODS } from '../../lib/catalog'
import { Sheet, Field, Segmented, Empty, toast, cx } from '../../ui/kit'
import { money, num, today, dLabel, dShort, pad, ymd, addDays } from '../../lib/format'
import { fail } from '../msg'
import type { Booking, MoneyRow } from '../../lib/types'

export const INCOME_CATS = ['Аренда зала', 'Сертификат', 'Абонемент', 'Аренда реквизита', 'Мастер-класс', 'Штраф', 'Другое']
export const EXPENSE_CATS = ['Аренда помещения', 'Коммунальные', 'Зарплата', 'Реклама', 'Декор и реквизит', 'Оборудование', 'Уборка', 'Налоги', 'Возврат клиенту', 'Другое']
export const METHOD = (m: string) => PAY_METHODS.find(p => p[0] === m)?.[1] ?? m

/** One line of the money flow: booking revenue or a manual entry */
export interface Entry { id: string; date: string; kind: 'income' | 'expense'; category: string; amount: number; method: string; title: string; note: string; bookingId: string | null; manual: MoneyRow | null }

export function buildEntries(bookings: Booking[], money: MoneyRow[], from: string, to: string): Entry[] {
  const out: Entry[] = []
  for (const b of bookings) {
    if (b.date < from || b.date > to || b.status === 'block') continue
    const v = revenueOf(b); if (v <= 0) continue
    out.push({ id: 'b' + b.id, date: b.date, kind: 'income', category: b.status === 'cancelled' ? 'Удержание при отмене' : 'Аренда зала', amount: v, method: b.payMethod || 'kaspi', title: `${b.name} · ${hallById(b.hall).name} ${pad(b.start)}:00, ${b.hours} ч`, note: b.bonusUsed ? `бонусами ${num(b.bonusUsed)}` : '', bookingId: b.id, manual: null })
  }
  for (const m of money) {
    if (m.date < from || m.date > to) continue
    out.push({ id: m.id, date: m.date, kind: m.kind, category: m.category, amount: m.amount, method: m.method, title: m.note || m.category, note: m.note, bookingId: m.bookingId, manual: m })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || (a.kind === b.kind ? 0 : a.kind === 'income' ? -1 : 1))
}

export default function Ledger() {
  const { bookings, money: rows, deleteMoney } = useStudio()
  const { openBooking } = useUI()
  const [range, setRange] = useState<'7' | '30' | 'month' | 'all'>('month')
  const [kind, setKind] = useState<'all' | 'income' | 'expense'>('all')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<MoneyRow> | null>(null)
  const now = new Date()
  const from = range === 'all' ? '2000-01-01' : range === 'month' ? ymd(new Date(now.getFullYear(), now.getMonth(), 1)) : ymd(addDays(now, -(+range) + 1))
  const to = range === 'month' ? ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)) : '2999-12-31'
  const all = useMemo(() => buildEntries(bookings, rows, from, to), [bookings, rows, from, to])
  const list = all.filter(e => (kind === 'all' || e.kind === kind) && (!q || (e.title + e.category + e.note).toLowerCase().includes(q.toLowerCase())))
  const inc = all.filter(e => e.kind === 'income').reduce((s, e) => s + e.amount, 0)
  const exp = all.filter(e => e.kind === 'expense').reduce((s, e) => s + e.amount, 0)
  const groups = useMemo(() => { const m = new Map<string, Entry[]>(); for (const e of list) m.set(e.date, [...(m.get(e.date) ?? []), e]); return [...m.entries()] }, [list])

  return (
    <>
      <PageHead title="Движения денег" sub="Брони попадают сюда автоматически. Аренду, зарплаты, рекламу, продажу сертификатов и другие деньги добавляйте вручную."
        actions={<>
          <button className="btn btn-line h-10" onClick={() => setEdit({ kind: 'expense', category: EXPENSE_CATS[0], date: today(), method: 'kaspi' })}><ArrowDownRight className="size-4" />Расход</button>
          <button className="btn btn-primary h-10" onClick={() => setEdit({ kind: 'income', category: INCOME_CATS[3], date: today(), method: 'kaspi' })}><Plus className="size-4" />Доход</button>
        </>} />

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4">
        {[['Пришло', inc, 'var(--good)'], ['Ушло', exp, 'var(--bad)'], ['Итого', inc - exp, inc - exp >= 0 ? 'var(--gold)' : 'var(--bad)']].map(([k, v, c], i) => (
          <motion.div key={k as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }} className="glass p-4">
            <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{k as string}</div>
            <div className="font-display text-[clamp(16px,4.6vw,26px)] mt-1 num whitespace-nowrap" style={{ color: c as string }}>{money(v as number)}</div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented value={range} onChange={setRange} items={[['month', 'Этот месяц'], ['7', '7 дней'], ['30', '30 дней'], ['all', 'Всё']]} />
        <Segmented value={kind} onChange={setKind} items={[['all', 'Все'], ['income', 'Приход'], ['expense', 'Расход']]} />
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="size-4 absolute z-10 left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} /><input className="field !h-10 !pl-10 glass !rounded-full !text-[14px]" placeholder="Поиск" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>

      {groups.length ? groups.map(([d, es]) => (
        <section key={d} className="mb-4">
          <div className="flex items-center justify-between px-1 mb-2"><span className="eyebrow">{dLabel(d)}</span><span className="text-[12px] num" style={{ color: 'var(--muted)' }}>{money(es.reduce((s, e) => s + (e.kind === 'income' ? e.amount : -e.amount), 0))}</span></div>
          <div className="glass overflow-hidden">
            <AnimatePresence initial={false}>
              {es.map(e => (
                <motion.div key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-4 py-3 border-b hairline last:border-0 hover:bg-[var(--card-2)] transition-colors cursor-pointer"
                  onClick={() => e.manual ? setEdit(e.manual) : e.bookingId && openBooking(e.bookingId)}>
                  <span className="size-9 rounded-full grid place-items-center shrink-0" style={{ background: e.kind === 'income' ? 'color-mix(in oklab, var(--good) 14%, transparent)' : 'color-mix(in oklab, var(--bad) 13%, transparent)', color: e.kind === 'income' ? 'var(--good)' : 'var(--bad)' }}>{e.kind === 'income' ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}</span>
                  <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{e.title}</span><span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{e.category} · {METHOD(e.method)}{e.manual ? '' : ' · бронь'}{e.note && e.manual === null ? ` · ${e.note}` : ''}</span></span>
                  <span className="num text-[14.5px] font-semibold whitespace-nowrap" style={{ color: e.kind === 'income' ? 'var(--good)' : 'var(--ink)' }}>{e.kind === 'income' ? '+' : '−'}{num(e.amount)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )) : <Card><Empty icon={<CalendarDays className="size-6" />} title="Движений нет" text="За выбранный период нет оплат и записей." /></Card>}

      <MoneySheet row={edit} onClose={() => setEdit(null)} onDelete={async id => { try { await deleteMoney(id); toast('Запись удалена'); setEdit(null) } catch (e) { fail(e) } }} />
    </>
  )
}

export function MoneySheet({ row, onClose, onDelete }: { row: Partial<MoneyRow> | null; onClose: () => void; onDelete?: (id: string) => void }) {
  return <Sheet open={!!row} onClose={onClose} title={row?.id ? 'Запись' : row?.kind === 'expense' ? 'Новый расход' : 'Новый доход'}>{row && <MoneyForm key={row.id ?? 'new' + row.kind} row={row} onDone={onClose} onDelete={onDelete} />}</Sheet>
}

function MoneyForm({ row, onDone, onDelete }: { row: Partial<MoneyRow>; onDone: () => void; onDelete?: (id: string) => void }) {
  const { addMoney, updateMoney } = useStudio()
  const [f, setF] = useState<Partial<MoneyRow>>(row)
  const [busy, setBusy] = useState(false)
  const cats = f.kind === 'expense' ? EXPENSE_CATS : INCOME_CATS
  const save = async () => {
    if (!f.amount) { toast('Укажите сумму', 'err'); return }
    setBusy(true)
    try { if (f.id) await updateMoney(f.id, { date: f.date, kind: f.kind, category: f.category, amount: f.amount, method: f.method, note: f.note }); else await addMoney(f); toast('Сохранено'); onDone() }
    catch (e) { fail(e) } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-4 pt-1">
      <Segmented value={f.kind as 'income' | 'expense'} onChange={v => setF({ ...f, kind: v, category: (v === 'expense' ? EXPENSE_CATS : INCOME_CATS)[0] })} items={[['income', 'Доход'], ['expense', 'Расход']]} className="self-start" />
      <div className="relative">
        <input autoFocus className={cx('field !h-16 !text-[30px] font-display num text-center', f.kind === 'expense' ? 'text-[var(--bad)]' : 'text-[var(--good)]')} inputMode="numeric" placeholder="0" value={f.amount ? num(f.amount) : ''} onChange={e => setF({ ...f, amount: +e.target.value.replace(/\D/g, '') || 0 })} />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[20px]" style={{ color: 'var(--muted)' }}>₸</span>
      </div>
      <div><span className="label">Статья</span><div className="flex flex-wrap gap-1.5">{cats.map(c => <button key={c} className="chip" aria-pressed={f.category === c} onClick={() => setF({ ...f, category: c })}>{c}</button>)}</div></div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Дата"><input type="date" className="field" value={f.date ?? today()} onChange={e => setF({ ...f, date: e.target.value || today() })} /></Field>
        <Field label="Способ"><select className="field" value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>{PAY_METHODS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></Field>
      </div>
      <Field label="Комментарий"><input className="field" value={f.note ?? ''} onChange={e => setF({ ...f, note: e.target.value })} placeholder={f.kind === 'expense' ? 'Например: аренда за ноябрь' : 'Например: сертификат для Дины'} /></Field>
      <div className="flex gap-2">
        {f.id && onDelete && <button className="btn btn-line h-12" style={{ color: 'var(--bad)' }} onClick={() => onDelete(f.id!)}><Trash2 className="size-4" /></button>}
        <button className="btn btn-primary h-12 flex-1" disabled={busy} onClick={save}>{f.id ? 'Сохранить' : f.kind === 'expense' ? 'Добавить расход' : 'Добавить доход'}</button>
      </div>
      {f.createdAt && <div className="text-[12px] text-center" style={{ color: 'var(--faint)' }}>Добавлено {dShort(f.createdAt.slice(0, 10))}</div>}
    </div>
  )
}
