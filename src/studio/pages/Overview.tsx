import { useMemo, useState } from 'react'
import { CalendarCheck, Gauge, Hourglass, Wallet, Sparkles, Cake, ArrowUpRight, Inbox, Plus } from 'lucide-react'
import { useStudio } from '../store'
import { can } from '../perm'
import { useUI } from '../ui'
import { useClients, active, revenueOf, toCollect, busyHours, startOf, endOf } from '../derive'
import { Card, PageHead, Kpi, AreaChart } from '../common'
import { HALLS, hallById } from '../../lib/catalog'
import { StatusPill, Segmented, Empty, Avatar } from '../../ui/kit'
import { money, compact, num, today, ymd, addDays, parseYmd, dLabel, timeRange, pad, MON_S, DOW, relTime, cap, DOW_FULL, MON } from '../../lib/format'
import type { Booking } from '../../lib/types'

export default function Overview() {
  const { me, bookings } = useStudio()
  const { openBooking, go, newBooking, openClient } = useUI()
  const clients = useClients()
  const owner = can(me?.role, 'seeMoney')
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month')
  const t = today()
  const now = new Date()
  const real = bookings.filter(b => b.status !== 'block')

  const todays = real.filter(b => active(b) && b.date === t).sort((a, b) => a.start - b.start)
  const load = useMemo(() => {
    let busy = 0
    for (const h of HALLS) for (const H of busyHours(bookings, h.id, t)) if (H >= 9 && H < 23) busy++
    return busy / (HALLS.length * 14)
  }, [bookings, t])
  const awaiting = real.filter(b => b.status === 'new').sort((a, b) => startOf(a).getTime() - startOf(b).getTime())
  const month = t.slice(0, 7)
  const prevMonth = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7)
  const rev = (m: string) => real.filter(b => b.date.startsWith(m)).reduce((s, b) => s + revenueOf(b), 0)
  const revM = rev(month), revP = rev(prevMonth)
  const delta = revP ? Math.round((revM / revP - 1) * 100) : 0
  const monthHours = real.filter(b => active(b) && b.date.startsWith(month)).reduce((s, b) => s + b.hours, 0)

  const series = useMemo(() => {
    const val = (bs: Booking[]) => owner ? bs.reduce((s, b) => s + revenueOf(b), 0) : bs.filter(active).reduce((s, b) => s + b.hours, 0)
    if (range === 'year') {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1), m = ymd(d).slice(0, 7)
        return { label: MON_S[d.getMonth()], value: val(real.filter(b => b.date.startsWith(m))), sub: `${cap(MON_S[d.getMonth()])} ${d.getFullYear()}` }
      })
    }
    const n = range === 'week' ? 7 : 30
    return Array.from({ length: n }, (_, i) => {
      const d = addDays(now, i - n + 1), s = ymd(d)
      return { label: range === 'week' ? DOW[d.getDay()] : String(d.getDate()), value: val(real.filter(b => b.date === s)), sub: dLabel(s) }
    })
  }, [bookings, range, owner]) // eslint-disable-line
  const total = series.reduce((s, x) => s + x.value, 0)

  const fresh = real.filter(b => b.source === 'Виджет').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const birthdays = useMemo(() => clients.filter(c => c.birthday).map(c => {
    const bd = parseYmd(c.birthday!); let next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate())
    if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate())
    return { c, next, days: Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5) }
  }).filter(x => x.days <= 14).sort((a, b) => a.days - b.days).slice(0, 4), [clients]) // eslint-disable-line

  const hello = now.getHours() < 5 ? 'Доброй ночи' : now.getHours() < 12 ? 'Доброе утро' : now.getHours() < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <>
      <PageHead title={`${hello}, ${(me?.name || '').split(' ')[0]}`} sub={`${cap(DOW_FULL[now.getDay()])}, ${now.getDate()} ${MON[now.getMonth()]} · ${todays.length ? `сегодня ${todays.length} ${todays.length === 1 ? 'съёмка' : todays.length < 5 ? 'съёмки' : 'съёмок'}` : 'сегодня съёмок нет'}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi label="Съёмок сегодня" value={todays.length} format={n => num(n)} sub={`${todays.reduce((s, b) => s + b.hours, 0)} ч в залах`} icon={<CalendarCheck className="size-4" />} onClick={() => go('schedule')} />
        <Kpi label="Загрузка сегодня" value={Math.round(load * 100)} format={n => `${Math.round(n)}%`} sub="с 9:00 до 23:00" icon={<Gauge className="size-4" />} delay={.05} />
        <Kpi label="Ждут оплаты" value={awaiting.length} format={n => num(n)} sub={owner ? money(awaiting.reduce((s, b) => s + toCollect(b), 0)) : 'брони без подтверждения'} icon={<Hourglass className="size-4" />} tone={awaiting.length ? 'var(--warn)' : undefined} delay={.1} onClick={() => go('pipeline')} />
        {owner
          ? <Kpi label="Выручка за месяц" value={revM} format={n => money(n)} sub={revP ? <span style={{ color: delta >= 0 ? 'var(--good)' : 'var(--bad)' }}>{delta >= 0 ? '+' : ''}{delta}% к прошлому</span> : 'первый месяц'} icon={<Wallet className="size-4" />} tone="var(--gold)" delay={.15} onClick={() => go('finance')} />
          : <Kpi label="Часов за месяц" value={monthHours} format={n => num(n)} sub="забронировано" icon={<Wallet className="size-4" />} delay={.15} />}
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3 md:gap-4 mt-3 md:mt-4">
        <Card delay={.1} title={<span className="flex items-baseline gap-2">{owner ? 'Выручка' : 'Часы в залах'}<span className="font-display text-[18px] num" style={{ color: 'var(--accent)' }}>{owner ? money(total) : `${num(total)} ч`}</span></span>} action={<Segmented value={range} onChange={setRange} items={[['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']]} />}>
          <AreaChart data={series} height={230} format={owner ? money : (n => `${n} ч`)} />
        </Card>

        <Card delay={.15} title="Залы сейчас" action={<span className="text-[12px] num" style={{ color: 'var(--muted)' }}>{pad(now.getHours())}:{pad(now.getMinutes())}</span>}>
          <div className="grid grid-cols-2 gap-2.5">
            {HALLS.map(h => {
              const list = bookings.filter(b => active(b) && b.hall === h.id)
              const cur = list.find(b => startOf(b) <= now && endOf(b) > now)
              const next = list.filter(b => startOf(b) > now).sort((a, b) => startOf(a).getTime() - startOf(b).getTime())[0]
              const nextToday = next && next.date === t
              return (
                <button key={h.id} onClick={() => cur ? openBooking(cur.id) : nextToday ? openBooking(next.id) : newBooking({ hall: h.id, date: t, start: Math.min(23, now.getHours() + 1) })} className="relative h-[118px] rounded-2xl overflow-hidden text-left group">
                  <img src={h.img} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.78))' }} />
                  <span className="absolute left-3 top-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-white px-2 h-6 rounded-full" style={{ background: cur ? 'rgba(212,106,115,.85)' : 'rgba(30,120,90,.75)', backdropFilter: 'blur(6px)' }}>
                    {cur ? <span className="live-dot !size-1.5 !bg-white" /> : null}{cur ? (cur.status === 'block' ? 'Закрыт' : 'Идёт съёмка') : 'Свободен'}
                  </span>
                  <span className="absolute left-3 right-3 bottom-2.5 text-white">
                    <span className="block text-[13px] font-semibold tracking-[.08em]">{h.name}</span>
                    <span className="block text-[11.5px] opacity-85 truncate">{cur ? `${cur.status === 'block' ? 'блок' : cur.name} · до ${pad((cur.start + cur.hours) % 24)}:00` : nextToday ? `далее в ${pad(next.start)}:00 · ${next.name}` : 'до конца дня'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 mt-3 md:mt-4">
        <Card delay={.2} title="Сегодня" action={<button className="text-[12.5px] flex items-center gap-1" style={{ color: 'var(--accent)' }} onClick={() => go('schedule')}>Расписание<ArrowUpRight className="size-3.5" /></button>}>
          {todays.length ? <div className="flex flex-col gap-1">{todays.map(b => <Line key={b.id} b={b} onClick={() => openBooking(b.id)} now={now} />)}</div>
            : <Empty icon={<Sparkles className="size-6" />} title="Свободный день" text="Самое время закрыть зал на уборку или позвать постоянных клиентов." action={<button className="btn btn-line btn-sm" onClick={() => newBooking({ date: t })}><Plus className="size-4" />Бронь на сегодня</button>} />}
        </Card>

        <Card delay={.25} title={<span>Ждут оплаты {awaiting.length > 0 && <span className="pill pill-new ml-1">{awaiting.length}</span>}</span>}>
          {awaiting.length ? <div className="flex flex-col gap-1">{awaiting.slice(0, 6).map(b => (
            <button key={b.id} onClick={() => openBooking(b.id)} className="flex items-center gap-3 p-2 -mx-2 rounded-xl text-left hover:bg-[var(--card-2)] transition-colors">
              <Avatar name={b.name} size={34} />
              <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{b.name}</span><span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{hallById(b.hall).name} · {dLabel(b.date, false)} · {pad(b.start)}:00</span></span>
              <span className="text-[13px] num font-medium" style={{ color: 'var(--warn)' }}>{compact(toCollect(b))}</span>
            </button>
          ))}</div> : <Empty icon={<Wallet className="size-6" />} title="Все брони оплачены" />}
        </Card>

        <Card delay={.3} title="Заявки с сайта" className="md:col-span-2 xl:col-span-1">
          {fresh.length ? <div className="flex flex-col gap-1">{fresh.map(b => (
            <button key={b.id} onClick={() => openBooking(b.id)} className="flex items-center gap-3 p-2 -mx-2 rounded-xl text-left hover:bg-[var(--card-2)] transition-colors">
              <span className="size-[34px] grid place-items-center rounded-full shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Inbox className="size-4" /></span>
              <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{b.name}</span><span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{relTime(b.createdAt)} · {hallById(b.hall).name}, {dLabel(b.date, false)}</span></span>
              <StatusPill s={b.status} />
            </button>
          ))}</div> : <Empty icon={<Inbox className="size-6" />} title="Пока нет заявок" text="Брони из виджета появятся здесь мгновенно." />}
          {birthdays.length > 0 && <>
            <div className="eyebrow mt-4 mb-2 flex items-center gap-1.5"><Cake className="size-3.5" />Дни рождения</div>
            {birthdays.map(({ c, days }) => <button key={c.phone} onClick={() => openClient(c.phone)} className="w-full flex items-center justify-between py-1.5 text-[13.5px]"><span className="truncate">{c.name}</span><span style={{ color: days === 0 ? 'var(--gold)' : 'var(--muted)' }}>{days === 0 ? 'сегодня 🎉' : days === 1 ? 'завтра' : `через ${days} дн.`}</span></button>)}
          </>}
        </Card>
      </div>
    </>
  )
}

function Line({ b, onClick, now }: { b: Booking; onClick: () => void; now: Date }) {
  const live = startOf(b) <= now && endOf(b) > now
  const past = endOf(b) <= now
  return (
    <button onClick={onClick} className="flex items-center gap-3 p-2 -mx-2 rounded-xl text-left hover:bg-[var(--card-2)] transition-colors" style={{ opacity: past ? .55 : 1 }}>
      <span className="w-[52px] shrink-0 text-[13px] num font-semibold">{pad(b.start)}:00<span className="block text-[11px] font-normal" style={{ color: 'var(--muted)' }}>{b.hours} ч</span></span>
      <span className="w-1 self-stretch rounded-full" style={{ background: live ? 'var(--accent)' : hallById(b.hall).tone }} />
      <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{b.status === 'block' ? 'Блокировка' : b.name}</span><span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{hallById(b.hall).name} · {timeRange(b.start, b.hours)}</span></span>
      {live ? <span className="pill pill-paid">идёт</span> : <StatusPill s={b.status} />}
    </button>
  )
}
