import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Gauge, Repeat, Ban, Timer } from 'lucide-react'
import { useStudio } from '../store'
import { useUI } from '../ui'
import { useClients, active, revenueOf, startOf, levelTone } from '../derive'
import { Card, PageHead, Kpi, Bars, Ring } from '../common'
import { HALLS, KINDS } from '../../lib/catalog'
import { Segmented } from '../../ui/kit'
import { ymd, addDays, parseYmd, num, compact, pad, DOW } from '../../lib/format'

const OPEN = 14 // 9:00–23:00 counted as working hours per hall per day

export default function Analytics() {
  const { bookings } = useStudio()
  const { openClient } = useUI()
  const clients = useClients()
  const [period, setPeriod] = useState<'30' | '90' | '365'>('90')
  const days = +period
  const from = ymd(addDays(new Date(), -days + 1)), to = ymd(new Date())
  const inP = useMemo(() => bookings.filter(b => b.status !== 'block' && b.date >= from && b.date <= to), [bookings, from, to])
  const act = inP.filter(active)

  // heatmap: weekday (Mon first) × hour 8..23
  const heat = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
    for (const b of act) { const d = (parseYmd(b.date).getDay() + 6) % 7; for (let k = 0; k < b.hours; k++) { const H = b.start + k; if (H < 24) g[d][H]++ } }
    return g
  }, [act])
  const hMax = Math.max(1, ...heat.flat())
  const hours = Array.from({ length: 16 }, (_, i) => 8 + i)

  const hallLoad = HALLS.map(h => { const hrs = act.filter(b => b.hall === h.id).reduce((s, b) => s + b.hours, 0); return { h, hrs, pct: hrs / (OPEN * days) } })
  const totalLoad = hallLoad.reduce((s, x) => s + x.hrs, 0) / (OPEN * days * HALLS.length)
  const cancelled = inP.filter(b => b.status === 'cancelled').length
  const cancelRate = inP.length ? cancelled / inP.length : 0
  const lead = act.filter(b => b.createdAt).map(b => (startOf(b).getTime() - new Date(b.createdAt).getTime()) / 864e5).filter(x => x >= 0)
  const leadAvg = lead.length ? lead.reduce((a, b) => a + b, 0) / lead.length : 0

  const phones = new Set(act.map(b => b.phoneNorm).filter(Boolean))
  const repeat = [...phones].filter(p => { const c = clients.find(x => x.phone === p); return c && c.bookings.filter(b => active(b) && b.date < from).length > 0 }).length
  const repeatShare = phones.size ? repeat / phones.size : 0

  const srcMap: Record<string, number> = {}; for (const b of act) srcMap[b.source || 'CRM'] = (srcMap[b.source || 'CRM'] ?? 0) + 1
  const sources = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
  const kindMap: Record<string, number> = {}; for (const b of act) kindMap[b.kind || 'Другое'] = (kindMap[b.kind || 'Другое'] ?? 0) + 1
  const kinds = KINDS.map(k => ({ label: k, value: kindMap[k] ?? 0, color: 'var(--gold)' })).filter(x => x.value).sort((a, b) => b.value - a.value)
  const durMap: Record<number, number> = {}; for (const b of act) durMap[b.hours] = (durMap[b.hours] ?? 0) + 1
  const durations = Object.entries(durMap).sort((a, b) => +a[0] - +b[0]).map(([h, v]) => ({ label: `${h} ч`, value: v }))
  const top = clients.map(c => ({ c, v: c.bookings.filter(b => b.date >= from && b.date <= to).reduce((s, b) => s + revenueOf(b), 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 6)

  return (
    <>
      <PageHead title="Аналитика" sub="Когда студия востребована, какие залы работают лучше и откуда приходят клиенты"
        actions={<Segmented value={period} onChange={setPeriod} items={[['30', '30 дней'], ['90', '90 дней'], ['365', 'Год']]} />} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi label="Загрузка залов" value={Math.round(totalLoad * 100)} format={n => `${Math.round(n)}%`} icon={<Gauge className="size-4" />} sub={`${num(act.reduce((s, b) => s + b.hours, 0))} ч из ${num(OPEN * days * HALLS.length)}`} />
        <Kpi label="Возвращаются" value={Math.round(repeatShare * 100)} format={n => `${Math.round(n)}%`} icon={<Repeat className="size-4" />} sub={`${repeat} из ${phones.size} клиентов`} tone="var(--good)" delay={.05} />
        <Kpi label="Отмены" value={Math.round(cancelRate * 100)} format={n => `${Math.round(n)}%`} icon={<Ban className="size-4" />} sub={`${cancelled} из ${inP.length} броней`} tone={cancelRate > .15 ? 'var(--bad)' : undefined} delay={.1} />
        <Kpi label="Бронируют заранее" value={leadAvg} format={n => `${n.toFixed(1).replace('.', ',')} дн.`} icon={<Timer className="size-4" />} sub="в среднем до съёмки" delay={.15} />
      </div>

      <Card title="Когда бронируют" className="mt-3 md:mt-4" delay={.1} action={<span className="text-[12px]" style={{ color: 'var(--muted)' }}>часы съёмок по дням недели</span>}>
        <div className="overflow-x-auto thin-scroll -mx-1 px-1">
          <div className="grid gap-[3px] min-w-[620px]" style={{ gridTemplateColumns: `34px repeat(${hours.length}, 1fr)` }}>
            <span />
            {hours.map(H => <span key={H} className="text-[10.5px] text-center num" style={{ color: 'var(--faint)' }}>{H % 2 === 0 ? pad(H) : ''}</span>)}
            {heat.map((row, d) => [
              <span key={'l' + d} className="text-[12px] self-center" style={{ color: 'var(--muted)' }}>{DOW[(d + 1) % 7]}</span>,
              ...hours.map((H, i) => {
                const v = row[H], k = v / hMax
                return <motion.span key={d + '-' + H} initial={{ opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (d * hours.length + i) * .003 }}
                  title={`${DOW[(d + 1) % 7]} ${pad(H)}:00 — ${v} ч`} className="h-7 md:h-8 rounded-[6px]"
                  style={{ background: v ? `color-mix(in oklab, var(--accent) ${Math.round(14 + k * 86)}%, transparent)` : 'var(--card-2)' }} />
              }),
            ])}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 text-[11.5px]" style={{ color: 'var(--muted)' }}>меньше{[.15, .4, .65, 1].map(k => <span key={k} className="size-3 rounded-[4px]" style={{ background: `color-mix(in oklab, var(--accent) ${Math.round(14 + k * 86)}%, transparent)` }} />)}больше</div>
      </Card>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 mt-3 md:mt-4">
        <Card title="Загрузка по залам" delay={.15}>
          <div className="grid grid-cols-2 gap-4">
            {hallLoad.map(({ h, hrs, pct }) => (
              <div key={h.id} className="flex items-center gap-3">
                <Ring value={pct} size={58} stroke={6} color={h.tone}>{Math.round(pct * 100)}%</Ring>
                <div><div className="text-[13px] font-semibold tracking-[.06em]">{h.name}</div><div className="text-[12px]" style={{ color: 'var(--muted)' }}>{num(hrs)} ч</div></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Источники броней" delay={.2}>{sources.length ? <Bars items={sources} format={n => num(n)} /> : <Muted />}</Card>
        <Card title="Типы съёмок" delay={.25}>{kinds.length ? <Bars items={kinds} format={n => num(n)} /> : <Muted />}</Card>
        <Card title="Длительность" delay={.3}>{durations.length ? <Bars items={durations} format={n => num(n)} /> : <Muted />}</Card>
        <Card title="Лучшие клиенты" delay={.35} className="xl:col-span-2">
          {top.length ? <div className="grid sm:grid-cols-2 gap-x-6">{top.map(({ c, v }, i) => (
            <button key={c.phone} onClick={() => openClient(c.phone)} className="flex items-center gap-3 py-2.5 border-b hairline text-left">
              <span className="w-5 text-[12px] num" style={{ color: 'var(--faint)' }}>{i + 1}</span>
              <span className="size-8 rounded-full grid place-items-center text-[12px] font-semibold" style={{ background: levelTone(c.level.id), color: '#1a1714' }}>{(c.name || '?')[0]}</span>
              <span className="flex-1 min-w-0 truncate text-[14px]">{c.name}</span>
              <span className="num text-[13px] font-medium">{compact(v)} ₸</span>
            </button>
          ))}</div> : <Muted />}
        </Card>
      </div>
    </>
  )
}

const Muted = () => <div className="text-[13px] py-6 text-center" style={{ color: 'var(--muted)' }}>Пока недостаточно данных</div>
