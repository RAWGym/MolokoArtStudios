import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Wallet, CheckCircle2, Clock, Inbox, LayoutGrid, List } from 'lucide-react'
import { useStudio } from '../store'
import { can } from '../perm'
import { useUI } from '../ui'
import { startOf, toCollect, revenueOf } from '../derive'
import { PageHead } from '../common'
import { HALLS, hallById } from '../../lib/catalog'
import { Segmented, StatusPill, Empty, Avatar, cx, toast, STATUS_LABEL } from '../../ui/kit'
import { money, compact, dLabel, dShort, timeRange, pad, relTime, fmtPhone, addDays, ymd } from '../../lib/format'
import { fail } from '../msg'
import type { Booking, Status } from '../../lib/types'

const COLS: { s: Status; hint: string; tone: string }[] = [
  { s: 'new', hint: 'Нужно получить оплату', tone: 'var(--warn)' },
  { s: 'paid', hint: 'Подтверждены, ждём съёмку', tone: 'var(--accent)' },
  { s: 'done', hint: 'За последние 30 дней', tone: 'var(--good)' },
  { s: 'cancelled', hint: 'За последние 30 дней', tone: 'var(--muted)' },
]

export default function Pipeline() {
  const { bookings, me, updateBooking } = useStudio()
  const { openBooking } = useUI()
  const owner = can(me?.role, 'seeMoney')
  const [view, setView] = useState<'board' | 'list'>('board')
  const [q, setQ] = useState('')
  const [hall, setHall] = useState<string>('all')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<Status | null>(null)
  const [tab, setTab] = useState<Status>('new')

  const since = ymd(addDays(new Date(), -30))
  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), d = s.replace(/\D/g, '')
    return bookings.filter(b => b.status !== 'block'
      && (hall === 'all' || b.hall === hall)
      && (!s || b.name.toLowerCase().includes(s) || (d.length >= 3 && b.phoneNorm.includes(d))))
  }, [bookings, q, hall])
  const col = (s: Status) => list.filter(b => b.status === s && (s === 'new' || s === 'paid' || b.date >= since))
    .sort((a, b) => s === 'done' || s === 'cancelled' ? startOf(b).getTime() - startOf(a).getTime() : startOf(a).getTime() - startOf(b).getTime())

  const move = async (id: string, to: Status) => {
    const b = bookings.find(x => x.id === id); if (!b || b.status === to) return
    if (to === 'cancelled' || (to === 'paid' && b.status === 'new')) { openBooking(id); if (to === 'cancelled') toast('Подтвердите отмену в карточке', 'info'); return }
    try { await updateBooking(id, { status: to, ...(to === 'done' ? { doneAt: new Date().toISOString() } : {}) }); toast(`Перенесено: ${STATUS_LABEL[to]}`) } catch (e) { fail(e) }
  }

  return (
    <>
      <PageHead title="Заявки" sub="Все брони по статусам: от заявки до завершённой съёмки"
        actions={<Segmented value={view} onChange={setView} items={[['board', <LayoutGrid className="size-4" />], ['list', <List className="size-4" />]]} />} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 absolute z-10 left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input className="field !h-11 !pl-10 glass !rounded-full" value={q} onChange={e => setQ(e.target.value)} placeholder="Имя или телефон" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button className="chip" aria-pressed={hall === 'all'} onClick={() => setHall('all')}>Все залы</button>
          {HALLS.map(h => <button key={h.id} className="chip" aria-pressed={hall === h.id} onClick={() => setHall(h.id)}>{h.name}</button>)}
        </div>
      </div>

      {view === 'board' ? <>
        {/* phone: tabs instead of 4 columns */}
        <div className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar mb-3 -mx-4 px-4">
          {COLS.map(c => <button key={c.s} className="chip shrink-0" aria-pressed={tab === c.s} onClick={() => setTab(c.s)}>{STATUS_LABEL[c.s]}<span className="opacity-70 num">{col(c.s).length}</span></button>)}
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 items-start">
          {COLS.map(c => {
            const items = col(c.s)
            return (
              <section key={c.s}
                onDragOver={e => { if (drag) { e.preventDefault(); setOver(c.s) } }} onDragLeave={() => setOver(null)}
                onDrop={e => { e.preventDefault(); setOver(null); if (drag) move(drag, c.s); setDrag(null) }}
                className={cx('glass p-2.5 flex-col gap-2 min-h-[200px] transition-[box-shadow]', tab === c.s ? 'flex' : 'hidden md:flex', over === c.s && 'ring-2 ring-[var(--accent)]')}>
                <header className="flex items-center gap-2 px-2 pt-1.5 pb-1">
                  <span className="size-2 rounded-full" style={{ background: c.tone }} />
                  <span className="font-semibold text-[14px]">{STATUS_LABEL[c.s]}</span>
                  <span className="text-[12px] num px-1.5 rounded-md" style={{ background: 'var(--card-2)', color: 'var(--muted)' }}>{items.length}</span>
                  {owner && (c.s === 'new' || c.s === 'done') && items.length > 0 && <span className="ml-auto text-[12px] num" style={{ color: 'var(--muted)' }}>{compact(items.reduce((s, b) => s + (c.s === 'new' ? toCollect(b) : revenueOf(b)), 0))} ₸</span>}
                </header>
                <div className="text-[11.5px] px-2 -mt-1 mb-1" style={{ color: 'var(--faint)' }}>{c.hint}</div>
                <AnimatePresence initial={false}>
                  {items.map(b => <Ticket key={b.id} b={b} owner={owner} onOpen={() => openBooking(b.id)} onDrag={setDrag} onQuick={to => move(b.id, to)} />)}
                </AnimatePresence>
                {!items.length && <div className="text-[13px] text-center py-8" style={{ color: 'var(--faint)' }}>Пусто</div>}
              </section>
            )
          })}
        </div>
      </> : (
        <div className="glass overflow-hidden">
          {list.length ? (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-[13.5px] min-w-[720px]">
                <thead><tr className="text-left" style={{ color: 'var(--muted)' }}>{['Клиент', 'Зал', 'Дата и время', 'Статус', 'Источник', owner ? 'Сумма' : ''].map(h => <th key={h} className="font-medium text-[12px] px-4 py-3 border-b hairline">{h}</th>)}</tr></thead>
                <tbody>
                  {[...list].sort((a, b) => startOf(b).getTime() - startOf(a).getTime()).slice(0, 300).map(b => (
                    <tr key={b.id} onClick={() => openBooking(b.id)} className="cursor-pointer hover:bg-[var(--card-2)] transition-colors">
                      <td className="px-4 py-2.5 border-b hairline"><div className="flex items-center gap-2.5"><Avatar name={b.name} size={30} /><div className="min-w-0"><div className="truncate font-medium">{b.name}</div><div className="text-[12px] num" style={{ color: 'var(--muted)' }}>{fmtPhone(b.phone)}</div></div></div></td>
                      <td className="px-4 py-2.5 border-b hairline">{hallById(b.hall).name}</td>
                      <td className="px-4 py-2.5 border-b hairline num whitespace-nowrap">{dShort(b.date)} · {timeRange(b.start, b.hours)}</td>
                      <td className="px-4 py-2.5 border-b hairline"><StatusPill s={b.status} /></td>
                      <td className="px-4 py-2.5 border-b hairline" style={{ color: 'var(--muted)' }}>{b.source}</td>
                      <td className="px-4 py-2.5 border-b hairline num text-right">{owner ? money(b.total) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon={<Inbox className="size-6" />} title="Ничего не найдено" />}
        </div>
      )}
    </>
  )
}

function Ticket({ b, owner, onOpen, onDrag, onQuick }: { b: Booking; owner: boolean; onOpen: () => void; onDrag: (id: string | null) => void; onQuick: (to: Status) => void }) {
  const h = hallById(b.hall)
  const soon = b.status === 'new' && startOf(b).getTime() - Date.now() < 48 * 36e5 && startOf(b).getTime() > Date.now()
  const past = startOf(b).getTime() < Date.now()
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }} transition={{ duration: .25 }}>
      <div draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDrag(b.id) }} onDragEnd={() => onDrag(null)} onClick={onOpen}
        className="rounded-2xl p-3 cursor-pointer active:cursor-grabbing hover:bg-[var(--card-3)] transition-colors" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>
        <div className="flex items-start gap-2.5">
          <img src={h.img} alt="" className="size-10 rounded-xl object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold truncate">{b.name}</div>
            <div className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>{h.name} · {dLabel(b.date, false)} · {pad(b.start)}:00, {b.hours} ч</div>
          </div>
          {owner && <span className="text-[12.5px] num font-medium shrink-0">{compact(b.total)}</span>}
        </div>
        <div className="flex items-center gap-2 mt-2.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>
          {b.source === 'Виджет' && <span className="px-1.5 h-5 rounded-md grid place-items-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>сайт</span>}
          {soon && <span className="flex items-center gap-1" style={{ color: 'var(--warn)' }}><Clock className="size-3" />скоро</span>}
          <span className="truncate">{relTime(b.createdAt)}</span>
          <span className="ml-auto flex gap-1" onClick={e => e.stopPropagation()}>
            {b.status === 'new' && <button className="h-7 px-2.5 rounded-lg flex items-center gap-1 font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} onClick={() => onQuick('paid')}><Wallet className="size-3.5" />Оплата</button>}
            {b.status === 'paid' && past && <button className="h-7 px-2.5 rounded-lg flex items-center gap-1 font-medium" style={{ background: 'color-mix(in oklab, var(--good) 14%, transparent)', color: 'var(--good)' }} onClick={() => onQuick('done')}><CheckCircle2 className="size-3.5" />Готово</button>}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
