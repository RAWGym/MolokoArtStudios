import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarPlus, MapPin, MessageCircle, Clock, Users, Info } from 'lucide-react'
import { hallById, STUDIO } from '../lib/catalog'
import { dLabel, timeRange, pad, parseYmd } from '../lib/format'
import { Logo } from '../ui/kit'
import { t, useLang } from './i18n'
import { fetchInvite, fetchSettings, type Invite as Inv } from './publicApi'

/** Public invitation card: /i/<booking id>. Photographers forward it to their clients. */
export default function Invite({ id }: { id: string }) {
  const [inv, setInv] = useState<Inv | null | undefined>(undefined)
  const lang = useLang(s => s.lang)
  useEffect(() => {
    document.documentElement.dataset.app = 'widget'
    fetchSettings().catch(() => {}).finally(() => fetchInvite(id).then(setInv).catch(() => setInv(null)))
  }, [id])

  if (inv === undefined) return <div className="min-h-dvh grid place-items-center"><div className="size-10 rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent)] animate-spin" /></div>
  if (!inv || !inv.items?.length) return (
    <div className="min-h-dvh grid place-items-center p-6 text-center">
      <div><Logo className="h-12 mx-auto" /><p className="mt-6 text-[15px]" style={{ color: 'var(--muted)' }}>{t('Приглашение не найдено или съёмка отменена.')}</p><a className="btn btn-primary mt-5" href="/">{t('Забронировать студию')}</a></div>
    </div>
  )

  const first = inv.items[0]
  const h = hallById(first.hall)
  const ics = () => {
    const ev = inv.items.map((x, i) => {
      const st = parseYmd(x.date); st.setHours(x.start, 0, 0, 0)
      const en = new Date(st.getTime() + x.hours * 36e5 - 5 * 6e4)
      const f = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
      return ['BEGIN:VEVENT', `UID:${id}-${i}@moloko`, `DTSTART:${f(st)}`, `DTEND:${f(en)}`, `SUMMARY:Съёмка в Moloko · ${hallById(x.hall).name}`, `LOCATION:${STUDIO.address}`, 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Съёмка в Moloko', 'END:VALARM', 'END:VEVENT'].join('\r\n')
    })
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moloko//Invite//RU', ...ev, 'END:VCALENDAR'].join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' })); a.download = 'moloko.ics'; a.click()
  }
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_560px]">
      <section className="relative h-[52svh] lg:h-dvh lg:sticky lg:top-0 overflow-hidden" style={{ background: '#111' }}>
        {h.video ? <video src={h.video} poster={h.img} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
          : <img src={h.img} alt="" className="absolute inset-0 w-full h-full object-cover kenburns" />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,10,9,.5), transparent 30%, transparent 55%, rgba(10,10,9,.8))' }} />
        <div className="absolute top-0 inset-x-0 px-5 sm:px-8 pt-[max(16px,env(safe-area-inset-top))] flex items-center justify-between"><Logo className="h-10 w-auto" circle="#0D4042" inner="#FFF9ED" ink="#FFF9ED" /><button onClick={() => useLang.getState().set(lang === 'kk' ? 'ru' : 'kk')} className="h-9 px-3 rounded-full text-[12.5px] font-semibold tracking-wide text-white" style={{ background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.22)' }}>{lang === 'kk' ? 'РУС' : 'ҚАЗ'}</button></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: [.16, 1, .3, 1] }} className="absolute bottom-0 inset-x-0 px-5 sm:px-8 lg:px-12 pb-12 text-white">
          <div className="text-[11px] tracking-[.22em] uppercase opacity-80">{t('Вас ждут на съёмку')}</div>
          <h1 className="font-display font-light text-[52px] sm:text-[72px] leading-none tracking-[.06em] mt-2">{h.name}</h1>
          <p className="mt-3 text-[15px] opacity-90">{dLabel(first.date)} · <span className="num">{timeRange(first.start, first.hours)}</span></p>
        </motion.div>
      </section>
      <main className="relative z-10 -mt-7 lg:mt-0 rounded-t-[30px] lg:rounded-none px-5 sm:px-8 lg:px-10 pt-7 pb-16" style={{ background: 'var(--bg)' }}>
        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }} className="font-display font-light text-[28px] leading-tight">{inv.host ? t('{host} приглашает вас в Moloko Art Studios', { host: inv.host }) : t('Приглашение в Moloko Art Studios')}</motion.h2>
        <div className="mt-5 flex flex-col gap-2.5">
          {inv.items.map((x, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2 + i * .07 }} className="flex items-center gap-3 rounded-[20px] p-2.5" style={{ background: 'var(--card)', boxShadow: '0 0 0 1px var(--line)' }}>
              <img src={hallById(x.hall).img} alt="" className="size-16 rounded-[14px] object-cover" />
              <div><div className="font-display text-[19px] tracking-[.06em]">{hallById(x.hall).name}</div><div className="text-[13.5px] flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><Clock className="size-3.5" />{dLabel(x.date)} · <span className="num">{timeRange(x.start, x.hours)}</span></div></div>
            </motion.div>
          ))}
        </div>
        {(inv.kind || inv.guests) && <div className="mt-3 flex flex-wrap gap-2 text-[13px]">{inv.kind && <span className="chip">{t(inv.kind)}</span>}{inv.guests ? <span className="chip"><Users className="size-3.5" />{t('{n} чел.', { n: inv.guests })}</span> : null}</div>}
        <a href={STUDIO.gis} target="_blank" rel="noopener" className="mt-5 flex items-center gap-3 rounded-[20px] p-4" style={{ background: 'var(--accent-soft)' }}>
          <span className="size-10 rounded-full grid place-items-center shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}><MapPin className="size-4" /></span>
          <span className="text-[14px] leading-snug"><b>{STUDIO.address}</b><br /><span style={{ color: 'var(--muted)' }}>{t('Алматы · открыть маршрут в 2ГИС')}</span></span>
        </a>
        <div className="mt-4 rounded-[18px] p-4 flex gap-3 text-[13.5px] leading-snug" style={{ background: 'var(--card-2)', color: 'var(--ink-2)' }}>
          <Info className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <span>{t('Приходите за 10–15 минут: гримёрка открывается заранее. В студии сменная обувь или бахилы, без курения и открытого огня.')}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="btn btn-primary h-12" onClick={ics}><CalendarPlus className="size-4" />{t('В календарь')}</button>
          <a className="btn btn-line h-12" href={STUDIO.wa} target="_blank" rel="noopener"><MessageCircle className="size-4 shrink-0" />{t('Написать студии')}</a>
        </div>
        <a href="/" className="block text-center mt-8 text-[13px] underline underline-offset-2" style={{ color: 'var(--muted)' }}>{t('Забронировать свою съёмку в Moloko')}</a>
      </main>
    </div>
  )
}
