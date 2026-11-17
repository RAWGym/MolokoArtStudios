import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Moon, Plus, Lock } from 'lucide-react'
import { useStudio } from '../store'
import { useUI } from '../ui'
import { active } from '../derive'
import { PageHead } from '../common'
import { HALLS, hallById } from '../../lib/catalog'
import { Segmented, cx } from '../../ui/kit'
import { today, ymd, addDays, parseYmd, dLabel, pad, DOW, MON_S, timeRange, compact, cap, MON_NOM } from '../../lib/format'
import type { Booking } from '../../lib/types'

const ROW = 54

export default function Schedule() {
  const { bookings, me } = useStudio()
  const { scheduleDate, newBooking, openBooking } = useUI()
  const [date, setDate] = useState(scheduleDate ?? today())
  const [view, setView] = useState<'day' | 'week'>(() => (matchMedia('(max-width: 640px)').matches ? 'day' : 'day'))
  const [night, setNight] = useState(false)
  useEffect(() => { if (scheduleDate) setDate(scheduleDate) }, [scheduleDate])
  const d = parseYmd(date)
  const shift = (n: number) => setDate(ymd(addDays(d, view === 'week' ? n * 7 : n)))
  const owner = me?.role === 'owner'

  const strip = useMemo(() => Array.from({ length: 21 }, (_, i) => ymd(addDays(new Date(), i - 3))), [])
  const countBy = useMemo(() => { const m: Record<string, number> = {}; for (const b of bookings) if (active(b) && b.status !== 'block') m[b.date] = (m[b.date] ?? 0) + 1; return m }, [bookings])
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => { stripRef.current?.querySelector(`[data-d="${date}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }, [date])

  return (
    <>
      <PageHead title="Расписание" sub={view === 'day' ? dLabel(date) : `Неделя с ${weekStart(d).getDate()} ${MON_S[weekStart(d).getMonth()]}`}
        actions={<>
          <Segmented value={view} onChange={setView} items={[['day', 'День'], ['week', 'Неделя']]} />
          <button className="btn btn-line btn-sm h-10" onClick={() => newBooking({ mode: 'block', date })}><Lock className="size-4" /><span className="hidden sm:inline">Закрыть зал</span></button>
        </>} />

      <div className="glass p-2 md:p-2.5 flex items-center gap-2 mb-3 md:mb-4">
        <button className="icon-btn shrink-0" onClick={() => shift(-1)} aria-label="Назад"><ChevronLeft className="size-4" /></button>
        <div ref={stripRef} className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar scroll-px-2">
          {strip.map(s => {
            const x = parseYmd(s), on = s === date, n = countBy[s] ?? 0
            return (
              <button key={s} data-d={s} onClick={() => setDate(s)} className={cx('relative shrink-0 w-[52px] h-[60px] rounded-2xl flex flex-col items-center justify-center transition-colors', !on && 'hover:bg-[var(--card-2)]')}>
                {on && <motion.span layoutId="day-on" className="absolute inset-0 rounded-2xl" style={{ background: 'var(--accent)' }} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <span className={cx('relative text-[11px] uppercase', on ? 'text-[var(--accent-ink)]' : s === today() ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}>{s === today() ? 'сег' : DOW[x.getDay()]}</span>
                <span className={cx('relative text-[17px] font-semibold num', on && 'text-[var(--accent-ink)]')}>{x.getDate()}</span>
                <span className="relative flex gap-0.5 h-1.5 mt-0.5">{Array.from({ length: Math.min(4, n) }, (_, i) => <span key={i} className="size-1 rounded-full" style={{ background: on ? 'var(--accent-ink)' : 'var(--accent)' }} />)}</span>
              </button>
            )
          })}
        </div>
        <input type="date" className="hidden md:block field !h-10 !w-[150px] !text-[14px]" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
        <button className="icon-btn shrink-0" onClick={() => shift(1)} aria-label="Вперёд"><ChevronRight className="size-4" /></button>
      </div>

      {view === 'day'
        ? <DayGrid date={date} bookings={bookings} night={night} setNight={setNight} onNew={(hall, start) => newBooking({ hall, date, start })} onOpen={openBooking} owner={owner} />
        : <Week date={date} bookings={bookings} onOpen={openBooking} onDay={s => { setDate(s); setView('day') }} />}
    </>
  )
}

const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

function DayGrid({ date, bookings, night, setNight, onNew, onOpen, owner }: { date: string; bookings: Booking[]; night: boolean; setNight: (v: boolean) => void; onNew: (hall: string, start: number) => void; onOpen: (id: string) => void; owner: boolean }) {
  const from = night ? 0 : 8, to = 24
  const hours = Array.from({ length: to - from }, (_, i) => from + i)
  const prev = ymd(addDays(parseYmd(date), -1))
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])
  const isToday = date === today()
  const nowY = ((now.getHours() + now.getMinutes() / 60) - from) * ROW
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { if (isToday && scroller.current) scroller.current.scrollTop = Math.max(0, nowY - 160) }, [date]) // eslint-disable-line

  const blocks = (hall: string) => {
    const out: { b: Booking; top: number; h: number; cutTop: boolean; cutBottom: boolean }[] = []
    for (const b of bookings) {
      if (!active(b) || b.hall !== hall) continue
      let s: number, e: number
      if (b.date === date) { s = b.start; e = b.start + b.hours }
      else if (b.date === prev && b.start + b.hours > 24) { s = b.start - 24; e = b.start + b.hours - 24 }
      else continue
      const vs = Math.max(s, from), ve = Math.min(e, to)
      if (ve <= vs) continue
      out.push({ b, top: (vs - from) * ROW, h: (ve - vs) * ROW, cutTop: s < from, cutBottom: e > to })
    }
    return out
  }
  const dayTotal = bookings.filter(b => b.date === date && active(b) && b.status !== 'block')

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b hairline text-[13px]">
        <span style={{ color: 'var(--muted)' }}>{dayTotal.length ? `${dayTotal.length} брон. · ${dayTotal.reduce((s, b) => s + b.hours, 0)} ч${owner ? ` · ${compact(dayTotal.reduce((s, b) => s + b.total, 0))} ₸` : ''}` : 'Нет броней — нажмите на свободный час'}</span>
        <button className={cx('chip !h-8', night && '!bg-[var(--accent-soft)]')} onClick={() => setNight(!night)}><Moon className="size-3.5" />{night ? 'Скрыть ночь' : 'Ночь 0–8'}</button>
      </div>
      <div ref={scroller} className="overflow-auto thin-scroll max-h-[calc(100dvh-300px)] md:max-h-[calc(100dvh-280px)] min-h-[360px]">
        <div className="relative grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${HALLS.length}, minmax(140px, 1fr))` }}>
          <div className="sticky top-0 left-0 z-30" style={{ background: 'var(--panel, var(--bg))' }} />
          {HALLS.map(h => (
            <div key={h.id} className="sticky top-0 z-20 flex items-center gap-2 px-3 h-12 border-l hairline" style={{ background: 'var(--panel, var(--bg))' }}>
              <img src={h.img} alt="" className="size-7 rounded-lg object-cover" />
              <span className="text-[13px] font-semibold tracking-[.08em]">{h.name}</span>
            </div>
          ))}
          <div className="sticky left-0 z-10" style={{ background: 'var(--panel, var(--bg))' }}>
            {hours.map(H => <div key={H} className="text-[11.5px] num text-right pr-2.5 -translate-y-2" style={{ height: ROW, color: 'var(--faint)' }}>{pad(H)}:00</div>)}
          </div>
          {HALLS.map(h => (
            <div key={h.id} className="relative border-l hairline">
              {hours.map(H => {
                const past = isToday && H < now.getHours() || date < today()
                return (
                  <button key={H} disabled={past && !owner} onClick={() => onNew(h.id, H)} className="group w-full border-t hairline flex items-center justify-center disabled:cursor-default" style={{ height: ROW, background: H >= 21 || H < 9 ? 'color-mix(in oklab, var(--card-2) 60%, transparent)' : undefined }}>
                    <span className="opacity-0 group-hover:opacity-100 group-enabled:group-hover:opacity-100 transition-opacity text-[12px] flex items-center gap-1" style={{ color: 'var(--accent)' }}><Plus className="size-3.5" />{pad(H)}:00</span>
                  </button>
                )
              })}
              {blocks(h.id).map(({ b, top, h: ht, cutTop, cutBottom }) => <Block key={b.id} b={b} top={top} h={ht} cutTop={cutTop} cutBottom={cutBottom} onClick={() => onOpen(b.id)} />)}
            </div>
          ))}
          {isToday && nowY > 0 && nowY < hours.length * ROW && (
            <div className="absolute left-[50px] right-0 z-[15] flex items-center pointer-events-none" style={{ top: 48 + nowY - 1 }}>
              <span className="size-2.5 rounded-full -ml-1" style={{ background: 'var(--bad)' }} />
              <span className="flex-1 h-[2px]" style={{ background: 'var(--bad)' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Block({ b, top, h, cutTop, cutBottom, onClick }: { b: Booking; top: number; h: number; cutTop: boolean; cutBottom: boolean; onClick: () => void }) {
  const isBlock = b.status === 'block'
  const st: Record<string, string> = isBlock
    ? { background: 'repeating-linear-gradient(135deg, var(--card-3) 0 8px, transparent 8px 16px)', border: '1px solid var(--line-2)' }
    : b.status === 'new' ? { background: 'color-mix(in oklab, var(--warn) 16%, var(--bg))', border: '1px dashed var(--warn)' }
    : b.status === 'done' ? { background: 'color-mix(in oklab, var(--good) 14%, var(--bg))', border: '1px solid color-mix(in oklab, var(--good) 35%, transparent)' }
    : { background: 'color-mix(in oklab, var(--accent) 22%, var(--bg))', border: '1px solid color-mix(in oklab, var(--accent) 45%, transparent)' }
  return (
    <motion.button layout initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} onClick={onClick}
      className={cx('absolute left-1.5 right-1.5 z-10 text-left px-2.5 py-1.5 overflow-hidden transition-[filter] hover:brightness-110', cutTop ? 'rounded-b-xl' : 'rounded-t-xl', cutBottom ? '' : 'rounded-b-xl', !cutTop && !cutBottom && 'rounded-xl')}
      style={{ top: top + 2, height: h - 4, ...st }}>
      <div className="text-[13px] font-semibold truncate">{isBlock ? (b.comment || 'Закрыто') : b.name}</div>
      {h > 44 && <div className="text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>{timeRange(b.start, b.hours)}{!isBlock && b.kind ? ` · ${b.kind}` : ''}</div>}
      {h > 90 && !isBlock && <div className="text-[11.5px] mt-1 truncate" style={{ color: b.status === 'new' ? 'var(--warn)' : 'var(--muted)' }}>{b.status === 'new' ? 'ждёт оплаты' : b.status === 'done' ? 'завершена' : 'оплачено'}{b.guests ? ` · ${b.guests} гост.` : ''}</div>}
    </motion.button>
  )
}

function Week({ date, bookings, onOpen, onDay }: { date: string; bookings: Booking[]; onOpen: (id: string) => void; onDay: (d: string) => void }) {
  const ws = weekStart(parseYmd(date))
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(ws, i)))
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {days.map((s, i) => {
        const x = parseYmd(s)
        const list = bookings.filter(b => b.date === s && active(b)).sort((a, b) => a.start - b.start)
        const hrs = list.filter(b => b.status !== 'block').reduce((a, b) => a + b.hours, 0)
        return (
          <motion.div key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .03 }} className={cx('glass p-3 min-h-[160px] flex flex-col gap-1.5', s === today() && 'ring-1 ring-[var(--accent)]')}>
            <button onClick={() => onDay(s)} className="flex items-baseline justify-between mb-1 text-left">
              <span><span className="font-display text-[20px] num">{x.getDate()}</span> <span className="text-[12.5px]" style={{ color: s === today() ? 'var(--accent)' : 'var(--muted)' }}>{cap(DOW[x.getDay()])}{x.getDate() === 1 ? ` · ${MON_NOM[x.getMonth()]}` : ''}</span></span>
              <span className="text-[11.5px]" style={{ color: 'var(--faint)' }}>{hrs ? `${hrs} ч` : ''}</span>
            </button>
            {list.map(b => (
              <button key={b.id} onClick={() => onOpen(b.id)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-[var(--card-3)] transition-colors" style={{ background: 'var(--card-2)' }}>
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: b.status === 'new' ? 'var(--warn)' : b.status === 'block' ? 'var(--faint)' : hallById(b.hall).tone }} />
                <span className="min-w-0"><span className="block text-[12.5px] font-medium truncate">{b.status === 'block' ? 'Блокировка' : b.name}</span><span className="block text-[11px] num" style={{ color: 'var(--muted)' }}>{pad(b.start)}:00 · {hallById(b.hall).name} · {b.hours} ч</span></span>
              </button>
            ))}
            {!list.length && <div className="text-[12.5px] m-auto" style={{ color: 'var(--faint)' }}>свободно</div>}
          </motion.div>
        )
      })}
    </div>
  )
}
