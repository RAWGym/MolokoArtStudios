import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Gift, MapPin, MessageCircle, Moon, Smartphone, Sparkles, Users, CalendarPlus, Info, PawPrint, Instagram, UserRound, Plus, X, Layers, Megaphone, Percent } from 'lucide-react'
import { HALLS, hallById, EQUIP, KINDS, STUDIO, DEFAULT_SETTINGS, quote, noConfetti, isNight } from '../lib/catalog'
import type { Settings } from '../lib/types'
import { addDays, dLabel, DOW, MON_NOM, money, pad, parseYmd, ymd, maskPhone, normPhone, store, plural, hoursLabel, timeRange } from '../lib/format'
import { errCode } from '../lib/supabase'
import { cx, Logo, Switch, Stepper, toast, Counter } from '../ui/kit'
import { fetchBusy, fetchSettings, fetchBonus, book, refInfo, type Busy, type BonusInfo, type Item } from './publicApi'
import { AccountSheet, useAccount, useAccountBoot } from './Account'
import { InstallSheet, useInstall } from './Install'
import { RulesSheet } from './Rules'

type Step = 0 | 1 | 2 | 3 | 4 | 5
const STEP_NAMES = ['Зал', 'Время', 'Детали', 'Контакты', 'Итог']

interface Draft { extra: Item[]; hall: string; date: string; from: number | null; to: number | null; guests: number; equip: string[]; makeup: boolean; confetti: boolean; pet: boolean; kind: string; name: string; phone: string; comment: string; useBonus: boolean; rules: boolean }
interface Done { id: string; hall: string; date: string; start: number; hours: number; total: number; bonus: number; pay: number; name: string; items?: Item[]; discount?: number }

const blankDraft = (): Draft => {
  const me = store.get<{ name: string; phone: string }>('moloko.me')
  const pre = new URLSearchParams(location.search).get('hall')
  return { extra: [], hall: HALLS.some(h => h.id === pre) ? pre! : (HALLS[0]?.id ?? 'white'), date: ymd(new Date()), from: null, to: null, guests: 2, equip: [], makeup: true, confetti: false, pet: false, kind: 'Портрет', name: me?.name ?? '', phone: me?.phone ?? '', comment: '', useBonus: true, rules: false }
}

export default function Widget() {
  const [S, setS] = useState<Settings>(DEFAULT_SETTINGS)
  const [busy, setBusy] = useState<Busy[]>([])
  const [loaded, setLoaded] = useState(false)
  const [step, setStep] = useState<Step>(() => new URLSearchParams(location.search).get('hall') ? 1 : 0)
  const [dir, setDir] = useState(1)
  const [d, setD] = useState<Draft>(blankDraft)
  const [bonus, setBonus] = useState<BonusInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [accOpen, setAccOpen] = useState(false)
  const [ref, setRef] = useState<{ code: string; name: string; pct: number } | null>(null)
  const me = useAccount(s => s.me)
  useAccountBoot()
  const install = useInstall()
  const panelRef = useRef<HTMLDivElement>(null)
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }))

  const loadBusy = () => fetchBusy().then(setBusy).catch(() => {})
  useEffect(() => {
    document.documentElement.dataset.app = 'widget'
    Promise.all([fetchSettings().then(x => { setS(x); setD(v => HALLS.some(h => h.id === v.hall) ? v : { ...v, hall: HALLS[0]?.id ?? v.hall }) }).catch(() => {}), loadBusy()]).finally(() => setLoaded(true))
    // referral link: ?ref=CODE (kept for a week so the friend can come back later)
    const qs = new URLSearchParams(location.search).get('ref')
    if (qs) store.set('moloko.ref', { code: qs.toUpperCase(), at: Date.now() })
    const saved = store.get<{ code: string; at: number }>('moloko.ref')
    if (saved && Date.now() - saved.at < 7 * 864e5) refInfo(saved.code).then(x => x && setRef({ code: saved.code, ...x }))
  }, [])
  // signed-in client: prefill contacts
  useEffect(() => { if (me) setD(v => ({ ...v, name: v.name || me.name || '', phone: v.phone || maskPhone(me.phone) })) }, [me])
  useEffect(() => {
    if (step !== 1) return
    loadBusy(); const t = setInterval(loadBusy, 45000); return () => clearInterval(t)
  }, [step])

  // bonus lookup once the phone is complete
  const pn = normPhone(d.phone)
  useEffect(() => {
    if (pn.length !== 11) { setBonus(null); return }
    let alive = true
    const t = setTimeout(() => fetchBonus(pn).then(b => { if (alive) setBonus(b) }), 350)
    return () => { alive = false; clearTimeout(t) }
  }, [pn])

  const hall = hallById(d.hall)
  const sel = d.from !== null ? { start: d.from, hours: (d.to ?? d.from) - d.from + 1 } : null
  const bookingDate = sel && sel.start >= 24 ? ymd(addDays(parseYmd(d.date), 1)) : d.date
  const bookingStart = sel ? sel.start % 24 : 0
  const q = useMemo(() => sel ? quote({ hall: d.hall, start: bookingStart, hours: sel.hours, guests: d.guests, equip: d.equip, confetti: d.confetti, makeup: d.makeup }, S) : { lines: [], total: 0 }, [d, S, sel?.start, sel?.hours]) // eslint-disable-line
  const extraQ = useMemo(() => d.extra.map(x => quote({ hall: x.hall, start: x.start, hours: x.hours, guests: 1 }, S).total), [d.extra, S])
  const listTotal = q.total + extraQ.reduce((a, b) => a + b, 0)
  const refPct = ref ? ref.pct : 0
  const discount = refPct ? [q.total, ...extraQ].reduce((a, v) => a + Math.floor(v * refPct / 100), 0) : 0
  const orderTotal = listTotal - discount
  const maxBonus = Math.floor(orderTotal * S.loyalty.maxRedeemPct / 100)
  const bonusApplied = d.useBonus && bonus && S.loyalty.enabled ? Math.min(bonus.balance, maxBonus) : 0
  const toPay = orderTotal - bonusApplied

  const go = (n: Step) => {
    setDir(n > step ? 1 : -1); setStep(n)
    if (innerWidth >= 900) { requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' })); return }
    // wait for the hero to finish shrinking, then land exactly on the panel
    setTimeout(() => { const el = panelRef.current; if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - 6), behavior: 'smooth' }) }, step === 0 && n > 0 ? 560 : 40)
  }

  const canNext = [true, !!sel, true, d.name.trim().length >= 2 && pn.length === 11, d.rules][step] ?? false

  async function submit() {
    if (!sel) return
    setSaving(true)
    try {
      const items: Item[] = [{ hall: d.hall, date: bookingDate, start: bookingStart, hours: sel.hours }, ...d.extra]
      const r = await book({ items, ref: ref?.code, guests: d.guests, equip: d.equip, makeup: d.makeup, confetti: d.confetti, pet: d.pet, name: d.name.trim(), phone: d.phone, kind: d.kind, comment: d.comment.trim(), bonus: bonusApplied })
      store.set('moloko.me', { name: d.name.trim(), phone: d.phone })
      const res: Done = { id: r.id, hall: d.hall, date: bookingDate, start: bookingStart, hours: sel.hours, total: r.total, bonus: r.bonus, pay: r.pay, name: d.name.trim(), items, discount: r.discount }
      if (r.discount) store.set('moloko.ref', null)
      if (me) useAccount.getState().load()
      store.set('moloko.last', { ...res, at: Date.now() })
      setDone(res); setDir(1); setStep(5); loadBusy()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      const c = errCode(e)
      const msg: Record<string, string> = {
        slot_taken: 'Это время только что заняли. Выберите другое.', past: 'Это время уже прошло. Выберите другое.',
        bad_phone: 'Проверьте номер телефона.', bad_name: 'Укажите имя.', too_many: 'С этого номера уже есть заявки. Мы скоро свяжемся.',
        no_confetti_in_grey: 'В этом зале конфетти запрещено.', bad_time: 'Это время недоступно для онлайн-брони.', too_far: 'Так далеко вперёд онлайн не бронируем. Напишите нам.', bad_hall: 'Этот зал сейчас недоступен.', blocked: 'Не получилось принять заявку онлайн. Напишите нам в WhatsApp.',
      }
      toast(msg[c] ?? 'Не получилось отправить. Проверьте интернет или напишите нам в WhatsApp.', 'err')
      if (c === 'slot_taken' || c === 'past' || c === 'bad_time') { set({ from: null, to: null, extra: [] }); loadBusy(); go(1) }
    } finally { setSaving(false) }
  }

  const again = () => { setD(x => ({ ...blankDraft(), hall: x.hall, name: x.name, phone: x.phone, extra: [] })); setDone(null); setDir(-1); setStep(0) }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,560px)] xl:grid-cols-[minmax(0,1.25fr)_600px]">
      <Stage hall={d.hall} S={S} step={step} onHall={id => set({ hall: id, from: null, to: null, confetti: noConfetti(id) ? false : d.confetti })} onInstall={() => setInstallOpen(true)} bonus={bonus} installed={install.installed} onAccount={() => setAccOpen(true)} />

      <main ref={panelRef} className="relative z-10 -mt-7 lg:mt-0 rounded-t-[30px] lg:rounded-none min-h-[60dvh] lg:min-h-dvh flex flex-col scroll-mt-0" style={{ background: 'var(--bg)' }}>
        {step < 5 && <Progress step={step} onBack={step > 0 ? () => go((step - 1) as Step) : undefined} />}
        <div className="flex-1 px-5 sm:px-8 lg:px-10 pb-40 lg:pb-36 pt-2">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir}
              initial={{ opacity: 0, x: dir * 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -20 }}
              transition={{ duration: .32, ease: [.16, 1, .3, 1] }}>
              {step === 0 && <StepHall S={S} hall={d.hall} onPick={id => { set({ hall: id, from: null, to: null, confetti: noConfetti(id) ? false : d.confetti }); }} onGo={() => go(1)} loaded={loaded} refBanner={ref} />}
              {step === 1 && <StepTime d={d} set={set} busy={busy} S={S} bookingDate={bookingDate} bookingStart={bookingStart} />}
              {step === 2 && <StepDetails d={d} set={set} S={S} />}
              {step === 3 && <StepContacts d={d} set={set} bonus={bonus} S={S} maxBonus={maxBonus} bonusApplied={bonusApplied} />}
              {step === 4 && sel && <StepSummary d={d} set={set} q={q} bookingDate={bookingDate} start={bookingStart} hours={sel.hours} bonusApplied={bonusApplied} toPay={toPay} openRules={() => setRulesOpen(true)} extraQ={extraQ} discount={discount} refPct={refPct} />}
              {step === 5 && done && <StepDone done={done} onInstall={() => setInstallOpen(true)} onAgain={again} installed={install.installed} />}
            </motion.div>
          </AnimatePresence>
        </div>
        <Footer />
      </main>

      {step < 5 && (
        <CtaBar
          left={step === 0 ? <><span className="text-[12px]" style={{ color: 'var(--muted)' }}>Зал {hall.name}</span><b className="num text-[17px]">{money(S.halls[d.hall])}<span className="font-normal text-[13px]" style={{ color: 'var(--muted)' }}> / час</span></b></>
            : sel ? <><span className="text-[12px]" style={{ color: 'var(--muted)' }}>{d.extra.length ? `${d.extra.length + 1} брони · комбо` : `${hoursLabel(sel.hours)} · ${pad(bookingStart)}:00`}</span><b className="num text-[17px]"><Counter value={step === 4 ? toPay : orderTotal} format={money} /></b></>
            : <><span className="text-[12px]" style={{ color: 'var(--muted)' }}>Выберите время</span><b className="num text-[17px]">{money(S.halls[d.hall])}<span className="font-normal text-[13px]" style={{ color: 'var(--muted)' }}> / час</span></b></>}
          label={step === 4 ? (saving ? 'Отправляем…' : 'Отправить заявку') : step === 0 ? `Выбрать ${hall.name}` : 'Далее'}
          disabled={!canNext || saving}
          onClick={() => step === 4 ? submit() : go((step + 1) as Step)}
        />
      )}

      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} install={install} />
      <AccountSheet open={accOpen} onClose={() => setAccOpen(false)} onBook={() => go(0)} />
      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} S={S} onAgree={() => { set({ rules: true }); setRulesOpen(false) }} />
    </div>
  )
}

/* ================================================================ stage (hero) */
function Stage({ hall, S, step, onHall, onInstall, bonus, installed, onAccount }: { hall: string; S: Settings; step: Step; onHall: (id: string) => void; onInstall: () => void; bonus: BonusInfo | null; installed: boolean; onAccount: () => void }) {
  const me = useAccount(s => s.me)
  const idx = HALLS.findIndex(h => h.id === hall)
  const scroller = useRef<HTMLDivElement>(null)
  const programmatic = useRef(false)
  // keep the carousel in sync with the chosen hall
  useEffect(() => {
    const el = scroller.current; if (!el) return
    const x = idx * el.clientWidth
    if (Math.abs(el.scrollLeft - x) > 4) { programmatic.current = true; el.scrollTo({ left: x, behavior: 'smooth' }); setTimeout(() => { programmatic.current = false }, 600) }
  }, [idx])
  const onScroll = () => {
    const el = scroller.current; if (!el || programmatic.current) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (HALLS[i] && HALLS[i].id !== hall) onHall(HALLS[i].id)
  }
  const h = HALLS[idx] ?? HALLS[0]
  const compact = step > 0
  return (
    <section className={cx('relative overflow-hidden lg:sticky lg:top-0 lg:h-dvh transition-[height] duration-500', compact ? 'h-[38svh] lg:h-dvh' : 'h-[64svh] lg:h-dvh')} style={{ background: '#111' }}>
      <div ref={scroller} onScroll={onScroll} className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar" style={{ overscrollBehaviorX: 'contain' }}>
        {HALLS.map((x, i) => (
          <div key={x.id} className="relative h-full w-full shrink-0 snap-center overflow-hidden">
            <img src={x.img} alt={`Зал ${x.name}`} className={cx('absolute inset-0 h-full w-full object-cover', i === idx && !x.video && 'kenburns')} loading={i === 0 ? 'eager' : 'lazy'} draggable={false} />
            {x.video && i === idx && <motion.video key={x.video} src={x.video} poster={x.img} autoPlay muted loop playsInline preload="metadata" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .8 }} className="absolute inset-0 h-full w-full object-cover" />}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,10,9,.55) 0%, rgba(10,10,9,0) 26%, rgba(10,10,9,0) 50%, rgba(10,10,9,.78) 100%)' }} />

      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 sm:px-8 pt-[max(16px,env(safe-area-inset-top))]">
        <Logo className="h-10 w-auto" circle="#0D4042" inner="#FFF9ED" ink="#FFF9ED" />
        <div className="flex items-center gap-2">
          <button onClick={onAccount} className="h-9 px-3.5 rounded-full inline-flex items-center gap-1.5 text-[13px] font-semibold text-white active:scale-95 transition-transform" style={{ background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.22)' }}><UserRound className="size-3.5" />{me ? (me.name?.split(' ')[0] || 'Кабинет') : 'Войти'}</button>
          {bonus && bonus.balance > 0 && <span className="h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-semibold text-white" style={{ background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.22)' }}><Gift className="size-3.5" />{bonus.balance.toLocaleString('ru-RU')}</span>}
          {!installed && <button onClick={onInstall} className="hidden sm:inline-flex h-9 px-3.5 rounded-full items-center gap-1.5 text-[13px] font-semibold text-white active:scale-95 transition-transform" style={{ background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.22)' }}><Smartphone className="size-3.5" />Приложение</button>}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 sm:px-8 lg:px-12 pb-12 lg:pb-14 text-white pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div key={h.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .45, ease: [.16, 1, .3, 1] }}>
            <div className="text-[11px] tracking-[.22em] uppercase opacity-75 mb-2">Фотостудия · Алматы · 24/7</div>
            <h1 className={cx('font-display font-light tracking-[.06em] leading-none transition-all duration-500', compact ? 'text-[40px] lg:text-[84px]' : 'text-[56px] sm:text-[72px] lg:text-[96px]')}>{h.name}</h1>
            <div className={cx('transition-all duration-500 overflow-hidden', compact ? 'max-h-0 opacity-0 lg:max-h-40 lg:opacity-100' : 'max-h-40 opacity-100')}>
              <p className="mt-3 text-[14.5px] leading-snug max-w-md opacity-90">{h.line}</p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="h-7 px-3 rounded-full inline-flex items-center text-[12.5px] font-semibold" style={{ background: '#FFF9ED', color: '#1B2120' }}>{money(S.halls[h.id])} / час</span>
                {h.features.map(f => <span key={f} className="h-7 px-3 rounded-full inline-flex items-center text-[12.5px]" style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)' }}>{f}</span>)}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-4 flex gap-1.5 pointer-events-auto">
          {HALLS.map((x, i) => <button key={x.id} aria-label={x.name} onClick={() => onHall(x.id)} className="h-1 rounded-full transition-all duration-500" style={{ width: i === idx ? 28 : 12, background: i === idx ? '#fff' : 'rgba(255,255,255,.4)' }} />)}
        </div>
      </div>
    </section>
  )
}

/* ================================================================ progress + CTA */
function Progress({ step, onBack }: { step: Step; onBack?: () => void }) {
  return (
    <div className="sticky top-0 z-20 px-5 sm:px-8 lg:px-10 pt-4 pb-3 flex items-center gap-3" style={{ background: 'linear-gradient(var(--bg) 70%, transparent)' }}>
      <div className="lg:hidden absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full" style={{ background: 'var(--line-2)' }} />
      <button onClick={onBack} disabled={!onBack} className={cx('icon-btn shrink-0 transition-opacity', !onBack && 'opacity-0 pointer-events-none')} aria-label="Назад"><ArrowLeft className="size-4" /></button>
      <div className="flex-1 flex gap-1.5">
        {STEP_NAMES.map((n, i) => (
          <div key={n} className="flex-1">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
              <motion.div className="h-full rounded-full" style={{ background: 'var(--accent)' }} initial={false} animate={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }} transition={{ duration: .5, ease: [.16, 1, .3, 1] }} />
            </div>
            <div className={cx('hidden sm:block text-[11px] mt-1.5 transition-colors', i <= step ? 'text-[var(--ink)]' : 'text-[var(--faint)]')}>{n}</div>
          </div>
        ))}
      </div>
      <span className="text-[12px] num shrink-0" style={{ color: 'var(--muted)' }}>{step + 1}/5</span>
    </div>
  )
}

function CtaBar({ left, label, disabled, onClick }: { left: ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="fixed z-30 bottom-0 right-0 left-0 lg:left-auto lg:w-[min(600px,calc(100%-(100%*1.08/2.08)))] xl:w-[600px] px-4 sm:px-8 lg:px-10 pt-3 safe-b" style={{ background: 'linear-gradient(transparent, var(--bg) 30%)' }}>
      <div className="flex items-center gap-4 rounded-[24px] p-2 pl-5" style={{ background: 'var(--card)', boxShadow: '0 20px 50px -18px rgba(40,30,15,.35), 0 0 0 1px var(--line)' }}>
        <div className="flex-1 min-w-0 flex flex-col leading-tight">{left}</div>
        <button className="btn btn-primary h-[52px] px-6 text-[15px]" disabled={disabled} onClick={onClick}>{label}<ArrowRight className="size-4" /></button>
      </div>
    </div>
  )
}

function H({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: ReactNode }) {
  return (
    <div className="mb-6 mt-2">
      {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
      <h2 className="font-display font-light text-[28px] sm:text-[32px] leading-[1.08]">{title}</h2>
      {text && <p className="mt-2 text-[14.5px]" style={{ color: 'var(--muted)' }}>{text}</p>}
    </div>
  )
}

/* ================================================================ step 0: hall */
function StepHall({ S, hall, onPick, onGo, loaded, refBanner }: { S: Settings; hall: string; onPick: (id: string) => void; onGo: () => void; loaded: boolean; refBanner: { name: string; pct: number } | null }) {
  const A = S.announcement
  const showA = A.enabled && (A.title || A.text) && (!A.until || A.until >= ymd(new Date()))
  const tone = { gold: ['var(--gold-soft)', 'var(--gold)'], accent: ['var(--accent-soft)', 'var(--accent)'], wine: ['color-mix(in oklab, var(--wine) 12%, transparent)', 'var(--wine)'] }[A.tone] ?? ['var(--gold-soft)', 'var(--gold)']
  const last = store.get<Done & { at: number }>('moloko.last')
  const showLast = last && Date.now() - last.at < 7 * 864e5 && parseYmd(last.date) >= parseYmd(ymd(new Date()))
  return (
    <div>
      <H eyebrow="Онлайн-бронь" title="Выберите зал" text={`${HALLS.length} ${plural(HALLS.length, 'интерьер', 'интерьера', 'интерьеров')}, свет Aputure и Bowens, гримёрка. Заявка за минуту, счёт Kaspi пришлёт администратор.`} />
      {showA && (
        <motion.div initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .5, ease: [.16, 1, .3, 1] }} className="mb-4 rounded-[20px] p-4 flex gap-3" style={{ background: tone[0] }}>
          <motion.span animate={{ rotate: [0, -12, 10, -6, 0] }} transition={{ delay: .6, duration: .9 }} className="size-10 rounded-full grid place-items-center shrink-0" style={{ background: tone[1], color: '#fff' }}><Megaphone className="size-4" /></motion.span>
          <div className="text-[13.5px] leading-snug min-w-0">{A.title && <b className="block text-[14.5px]" style={{ color: 'var(--ink)' }}>{A.title}</b>}{A.text && <span className="whitespace-pre-line" style={{ color: 'var(--ink-2)' }}>{A.text}</span>}</div>
        </motion.div>
      )}
      {refBanner && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="mb-4 rounded-[20px] p-4 flex items-center gap-3 text-white relative overflow-hidden" style={{ background: 'linear-gradient(120deg, #3A6367, #6F8F7E)' }}>
          <span className="size-10 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,.18)' }}><Percent className="size-4" /></span>
          <div className="text-[13.5px] leading-snug"><b className="text-[15px]">−{refBanner.pct}% на первую съёмку</b><br /><span className="opacity-85">Вас пригласил(а) {refBanner.name}. Скидка применится автоматически</span></div>
        </motion.div>
      )}
      {showLast && (
        <div className="mb-5 rounded-[20px] p-4 flex items-center gap-3" style={{ background: 'var(--accent-soft)' }}>
          <div className="size-10 rounded-full grid place-items-center shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}><Clock className="size-4" /></div>
          <div className="text-[13.5px] leading-snug"><b>Ваша заявка: {hallById(last!.hall).name}, {dLabel(last!.date)}, {pad(last!.start)}:00</b><br /><span style={{ color: 'var(--muted)' }}>Администратор пришлёт счёт в WhatsApp</span></div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {HALLS.map((h, i) => (
          <motion.button key={h.id} onClick={() => onPick(h.id)} onDoubleClick={onGo}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 * i, duration: .5, ease: [.16, 1, .3, 1] }}
            className={cx('group relative aspect-[3/4] rounded-[22px] overflow-hidden text-left transition-all duration-300', hall === h.id ? 'ring-2 ring-offset-2 ring-[var(--accent)] ring-offset-[var(--bg)]' : 'opacity-90 hover:opacity-100')}>
            <img src={h.img} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 45%, rgba(0,0,0,.72))' }} />
            {hall === h.id && <span className="absolute top-3 right-3 size-7 rounded-full grid place-items-center" style={{ background: 'var(--accent)', color: '#fff' }}><Check className="size-4" /></span>}
            <div className="absolute bottom-3 left-3.5 right-3 text-white">
              <div className="font-display font-light text-[22px] tracking-[.08em] leading-none">{h.name}</div>
              <div className="text-[12.5px] mt-1.5 opacity-85 num">{loaded ? `${money(S.halls[h.id])} / час` : '…'}</div>
            </div>
          </motion.button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[['24/7', 'без выходных'], ['55 мин', 'студийный час'], ['до ' + S.freeGuests, 'гостей без доплаты']].map(([a, b]) => (
          <div key={a} className="rounded-2xl py-3 px-2" style={{ background: 'var(--card-2)' }}><div className="font-display text-[16px]">{a}</div><div className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{b}</div></div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================ step 1: date & time */
const GROUPS: [string, number, number, boolean?][] = [['Ночь', 0, 9, true], ['Утро', 9, 12], ['День', 12, 18], ['Вечер', 18, 21], ['Поздний вечер', 21, 24], ['После полуночи', 24, 33, true]]

function StepTime({ d, set, busy, S, bookingDate, bookingStart }: { d: Draft; set: (p: Partial<Draft>) => void; busy: Busy[]; S: Settings; bookingDate: string; bookingStart: number }) {
  const W = S.booking
  const [nightOpen, setNightOpen] = useState(() => d.from !== null && (d.from < 9 || d.from >= 24))
  const days = useMemo(() => Array.from({ length: Math.min(180, Math.max(7, W.daysAhead + 1)) }, (_, i) => ymd(addDays(new Date(), i))), [W.daysAhead])
  const base = parseYmd(d.date).getTime()
  const busySet = useMemo(() => {
    const s = new Set<number>()
    for (const b of [...busy, ...d.extra]) {
      if (b.hall !== d.hall) continue
      const off = Math.round((parseYmd(b.date).getTime() - base) / 864e5) * 24
      for (let k = 0; k < b.hours; k++) s.add(off + b.start + k)
    }
    return s
  }, [busy, d.extra, d.hall, d.date, base])
  const now = new Date()
  const isPast = (abs: number) => { const t = new Date(base); t.setHours(abs, 0, 0, 0); return t.getTime() <= now.getTime() + W.leadHours * 36e5 }
  const inWindow = (abs: number) => { const h = abs % 24; return h >= W.open && h < W.close }
  const lastDay = days[days.length - 1]
  const tooFar = (abs: number) => ymd(addDays(parseYmd(d.date), Math.floor(abs / 24))) > lastDay
  const free = (abs: number) => inWindow(abs) && !busySet.has(abs) && !isPast(abs) && !tooFar(abs)

  const tap = (abs: number) => {
    if (!free(abs)) return
    const { from, to } = d
    if (from === null || (to !== null && to !== from) || abs < from) { set({ from: abs, to: abs }); return }
    if (abs === from) { set({ from: null, to: null }); return }
    if (abs - from >= W.maxHours) { toast(`Онлайн — до ${hoursLabel(W.maxHours)} подряд. Дольше — напишите нам.`, 'info'); return }
    for (let h = from; h <= abs; h++) if (!free(h)) { set({ from: abs, to: abs }); return }
    set({ to: abs })
  }
  const inSel = (abs: number) => d.from !== null && abs >= d.from && abs <= (d.to ?? d.from)
  const freeCount = (date: string) => {
    const off = Math.round((parseYmd(date).getTime() - base) / 864e5) * 24
    let n = 0; for (let h = 9; h < 24; h++) if (!busySet.has(off + h)) n++
    return n
  }

  const dayRef = useRef<HTMLDivElement>(null)
  let lastMonth = -1
  return (
    <div>
      <H eyebrow={hallById(d.hall).name} title="Дата и время" text="Нажмите на начало и конец съёмки. Минимум — 1 час." />

      <div ref={dayRef} className="-mx-5 sm:-mx-8 lg:-mx-10 px-5 sm:px-8 lg:px-10 scroll-pl-5 sm:scroll-pl-8 lg:scroll-pl-10 flex gap-2 overflow-x-auto no-scrollbar snap-x pb-1">
        {days.map(s => {
          const dt = parseYmd(s); const m = dt.getMonth(); const showM = m !== lastMonth; lastMonth = m
          const on = s === d.date; const wk = dt.getDay() === 0 || dt.getDay() === 6
          const few = freeCount(s) <= 3
          return (
            <div key={s} className="snap-start shrink-0 flex flex-col">
              <div className="h-5 text-[11px] font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>{showM ? MON_NOM[m] : ''}</div>
              <button onClick={() => set({ date: s, from: null, to: null })}
                className={cx('relative w-[58px] h-[74px] rounded-[18px] flex flex-col items-center justify-center gap-0.5 transition-all duration-300', on ? 'scale-[1.02]' : 'hover:bg-[var(--card-3)]')}
                style={{ background: on ? 'var(--ink)' : 'var(--card-2)', color: on ? 'var(--bg)' : wk ? 'var(--wine)' : 'var(--ink)' }}>
                <span className="text-[11px] uppercase tracking-wider opacity-70">{DOW[dt.getDay()]}</span>
                <span className="font-display text-[21px] leading-none num">{dt.getDate()}</span>
                {few && <span className="absolute bottom-2 size-1 rounded-full" style={{ background: on ? 'var(--bg)' : 'var(--warn)' }} />}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {GROUPS.map(([title, a, b, night]) => {
          if (night && !nightOpen) return null
          if (!Array.from({ length: b - a }, (_, k) => inWindow(a + k)).some(Boolean)) return null
          const hasNight = Array.from({ length: b - a }, (_, k) => isNight((a + k) % 24, S)).some(Boolean)
          const label = a >= 24 ? `${title} · ${dLabel(ymd(addDays(parseYmd(d.date), 1)), false).toLowerCase()}` : title
          return (
            <div key={title}>
              <div className="eyebrow mb-2.5 flex items-center gap-2">{label}{hasNight && S.night > 0 && <span className="normal-case tracking-normal font-medium" style={{ color: 'var(--gold)' }}>+{money(S.night)}/ч</span>}</div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {Array.from({ length: b - a }, (_, k) => {
                  const abs = a + k; const f = free(abs); const on = inSel(abs)
                  const edge = on && (abs === d.from || abs === d.to)
                  return (
                    <button key={abs} disabled={!f} onClick={() => tap(abs)}
                      className={cx('h-12 rounded-[14px] text-[14.5px] num font-medium transition-all duration-200', !f && 'line-through opacity-35', f && !on && 'hover:bg-[var(--card-3)] active:scale-95')}
                      style={{ background: on ? (edge ? 'var(--accent)' : 'color-mix(in oklab, var(--accent) 22%, var(--bg))') : 'var(--card-2)', color: edge ? 'var(--accent-ink)' : 'var(--ink)' }}>
                      {pad(abs % 24)}:00
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {Array.from({ length: 9 }, (_, h) => h >= W.open && h < W.close).some(Boolean) ? <button className="self-start btn btn-ghost btn-sm" onClick={() => setNightOpen(v => !v)}><Moon className="size-4" />{nightOpen ? 'Скрыть ночные часы' : 'Показать ночные часы'}</button> : null}
      </div>

      <AnimatePresence>
        {d.from !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-6 rounded-[20px] p-4 flex items-center gap-3" style={{ background: 'var(--accent-soft)' }}>
            <Clock className="size-5 shrink-0" style={{ color: 'var(--accent)' }} />
            <div className="text-[14px]"><b className="num">{timeRange(d.from % 24, (d.to ?? d.from) - d.from + 1)}</b> · {hoursLabel((d.to ?? d.from) - d.from + 1)}{d.to === d.from && <span style={{ color: 'var(--muted)' }}> — нажмите на последний час, чтобы продлить</span>}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* combined booking: several halls or times in one order */}
      <div className="mt-6 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {d.extra.map((x, i) => (
            <motion.div key={`${x.hall}${x.date}${x.start}`} layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16, height: 0 }} className="flex items-center gap-3 rounded-[18px] p-2 pr-3" style={{ background: 'var(--card)', boxShadow: '0 0 0 1px var(--line)' }}>
              <img src={hallById(x.hall).img} alt="" className="size-11 rounded-[12px] object-cover" />
              <div className="flex-1 min-w-0 text-[13.5px]"><b className="tracking-[.06em]">{hallById(x.hall).name}</b><div style={{ color: 'var(--muted)' }}>{dLabel(x.date)} · <span className="num">{timeRange(x.start, x.hours)}</span></div></div>
              <button className="icon-btn !size-8" aria-label="Убрать" onClick={() => set({ extra: d.extra.filter((_, k) => k !== i) })}><X className="size-3.5" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
        {d.from !== null && d.extra.length < 5 && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[18px] p-3.5 flex items-center gap-3 text-left border-2 border-dashed transition-colors hover:bg-[var(--card-2)]" style={{ borderColor: 'var(--line-2)' }}
            onClick={() => { const hours = (d.to ?? d.from!) - d.from! + 1; const nextHall = HALLS.find(h => h.id !== d.hall)?.id ?? d.hall; set({ extra: [...d.extra, { hall: d.hall, date: bookingDate, start: bookingStart, hours }], hall: nextHall, from: null, to: null }); toast('Добавлено. Выберите следующий зал и время', 'info') }}>
            <span className="size-10 rounded-full grid place-items-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Layers className="size-4" /></span>
            <span className="flex-1"><b className="block text-[14px]">Добавить ещё зал или время</b><span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Например, BEIGE с 14:00, а потом BLACK с 17:00</span></span>
            <Plus className="size-4" style={{ color: 'var(--accent)' }} />
          </motion.button>
        )}
        {d.extra.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">{HALLS.map(h => <button key={h.id} className="chip" aria-pressed={d.hall === h.id} onClick={() => set({ hall: h.id, from: null, to: null })}>{h.name}</button>)}</div>
        )}
      </div>
    </div>
  )
}

/* ================================================================ step 2: details */
function Row({ icon, title, sub, right, disabled }: { icon?: ReactNode; title: string; sub?: ReactNode; right: ReactNode; disabled?: boolean }) {
  return (
    <div className={cx('flex items-center gap-3.5 py-3.5 border-b hairline last:border-0', disabled && 'opacity-45')}>
      {icon && <span className="size-10 rounded-[14px] grid place-items-center shrink-0" style={{ background: 'var(--card-2)', color: 'var(--accent)' }}>{icon}</span>}
      <div className="flex-1 min-w-0"><div className="text-[15px] font-medium">{title}</div>{sub && <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{sub}</div>}</div>
      {right}
    </div>
  )
}
function StepDetails({ d, set, S }: { d: Draft; set: (p: Partial<Draft>) => void; S: Settings }) {
  const [allEquip, setAllEquip] = useState(d.equip.length > 0)
  const grey = noConfetti(d.hall)
  const list = allEquip ? EQUIP : EQUIP.slice(0, 3)
  return (
    <div>
      <H eyebrow="Детали" title="Расскажите о съёмке" text="Это поможет подготовить зал к вашему приходу." />
      <div className="eyebrow mb-2.5">Тип съёмки</div>
      <div className="flex flex-wrap gap-2 mb-6">{KINDS.map(k => <button key={k} className="chip" aria-pressed={d.kind === k} onClick={() => set({ kind: k })}>{k}</button>)}</div>

      <div className="rounded-[22px] px-4" style={{ background: 'var(--card)', boxShadow: '0 0 0 1px var(--line)' }}>
        <Row icon={<Users className="size-[18px]" />} title="Сколько человек" sub={d.guests > S.freeGuests ? `+${money(S.guest)}/ч за каждого сверх ${S.freeGuests}` : `До ${S.freeGuests} — без доплаты, с фотографом`} right={<Stepper value={d.guests} min={1} max={30} onChange={v => set({ guests: v })} />} />
        <Row icon={<Sparkles className="size-[18px]" />} title="Гримёрка за час до съёмки" sub="Бесплатно" right={<Switch on={d.makeup} onChange={v => set({ makeup: v })} label="Гримёрка" />} />
        <Row icon={<Sparkles className="size-[18px]" />} title="Конфетти или хлопушки" sub={grey ? `В зале ${hallById(d.hall).name} запрещены` : `Уборка ${money(S.confetti)}`} disabled={grey} right={<Switch on={d.confetti && !grey} onChange={v => !grey && set({ confetti: v })} label="Конфетти" />} />
        <Row icon={<PawPrint className="size-[18px]" />} title="Будет питомец" sub="Предупредим администратора" right={<Switch on={d.pet} onChange={v => set({ pet: v })} label="Питомец" />} />
      </div>

      <div className="eyebrow mt-7 mb-2.5">Оборудование · 2 источника света уже входят</div>
      <div className="flex flex-col gap-2">
        {list.map(e => {
          const on = d.equip.includes(e.id)
          return (
            <button key={e.id} onClick={() => set({ equip: on ? d.equip.filter(x => x !== e.id) : [...d.equip, e.id] })}
              className="flex items-center gap-3 rounded-[16px] px-4 py-3 text-left transition-all duration-200 active:scale-[.99]"
              style={{ background: on ? 'var(--accent-soft)' : 'var(--card-2)', boxShadow: on ? 'inset 0 0 0 1.5px var(--accent)' : 'none' }}>
              <span className="size-5 rounded-md grid place-items-center shrink-0 transition-colors" style={{ background: on ? 'var(--accent)' : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--line-2)', color: 'var(--accent-ink)' }}>{on && <Check className="size-3.5" />}</span>
              <span className="flex-1 min-w-0"><span className="block text-[14.5px] font-medium">{e.n}</span>{'d' in e && e.d && <span className="block text-[12px]" style={{ color: 'var(--muted)' }}>{e.d}</span>}</span>
              <span className="text-[13px] num shrink-0" style={{ color: 'var(--muted)' }}>{money(S.equip[e.id] ?? 0)}/ч</span>
            </button>
          )
        })}
        {!allEquip && <button className="btn btn-ghost btn-sm self-start mt-1" onClick={() => setAllEquip(true)}>Ещё {EQUIP.length - 3} позиций<ChevronDown className="size-4" /></button>}
      </div>
    </div>
  )
}

/* ================================================================ step 3: contacts + bonus */
function StepContacts({ d, set, bonus, S, maxBonus, bonusApplied }: { d: Draft; set: (p: Partial<Draft>) => void; bonus: BonusInfo | null; S: Settings; maxBonus: number; bonusApplied: number }) {
  const pn = normPhone(d.phone)
  return (
    <div>
      <H eyebrow="Контакты" title="Куда прислать счёт" text="Администратор напишет в WhatsApp и пришлёт счёт Kaspi. Бонусы копятся на этот номер." />
      <div className="flex flex-col gap-4">
        <label><span className="label">Имя</span><input className="field" value={d.name} onChange={e => set({ name: e.target.value })} placeholder="Как к вам обращаться" autoComplete="name" /></label>
        <label><span className="label">Телефон (WhatsApp)</span><input className="field num" value={d.phone} onChange={e => set({ phone: maskPhone(e.target.value) })} onFocus={e => { if (!e.target.value) set({ phone: '+7' }) }} placeholder="+7 (700) 000-00-00" inputMode="tel" autoComplete="tel" /></label>
        <label><span className="label">Комментарий</span><textarea className="field" rows={3} value={d.comment} onChange={e => set({ comment: e.target.value })} placeholder="Идея съёмки, фотограф, пожелания" /></label>
      </div>

      <AnimatePresence>
        {pn.length === 11 && S.loyalty.enabled && (
          <motion.div initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .45, ease: [.16, 1, .3, 1] }}
            className="mt-6 relative overflow-hidden rounded-[24px] p-5 text-white" style={{ background: 'linear-gradient(135deg, #2E5054, #3A6367 55%, #6F8F7E)' }}>
            <div className="absolute -right-8 -top-10 size-40 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,249,237,.25), transparent 70%)' }} />
            <div className="flex items-center gap-2 text-[12px] tracking-[.16em] uppercase opacity-80"><Gift className="size-4" />Клуб Moloko</div>
            {bonus ? (
              <>
                <div className="mt-3 flex items-end gap-3">
                  <div className="font-display text-[34px] leading-none num"><Counter value={bonus.balance} format={n => Math.round(n).toLocaleString('ru-RU')} /></div>
                  <div className="text-[13px] opacity-85 pb-1">{plural(bonus.balance, 'бонус', 'бонуса', 'бонусов')} · уровень {bonus.level}, {bonus.pct}% с каждой съёмки</div>
                </div>
                {bonus.balance > 0 && (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,.12)' }}>
                    <div className="flex-1 text-[13.5px] leading-snug">Списать {money(bonusApplied || Math.min(bonus.balance, maxBonus))}<br /><span className="opacity-75 text-[12px]">до {S.loyalty.maxRedeemPct}% от суммы брони</span></div>
                    <Switch on={d.useBonus} onChange={v => set({ useBonus: v })} label="Списать бонусы" />
                  </div>
                )}
              </>
            ) : (
              <div className="mt-2 text-[14px] leading-snug opacity-90">Вы впервые у нас? После съёмки на этот номер придут бонусы — {S.loyalty.levels[0]?.pct ?? 3}% от суммы. Ими можно оплатить до {S.loyalty.maxRedeemPct}% следующей брони.</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ================================================================ step 4: summary */
function StepSummary({ d, set, q, bookingDate, start, hours, bonusApplied, toPay, openRules, extraQ, discount, refPct }: { d: Draft; set: (p: Partial<Draft>) => void; q: { lines: [string, number][]; total: number }; bookingDate: string; start: number; hours: number; bonusApplied: number; toPay: number; openRules: () => void; extraQ: number[]; discount: number; refPct: number }) {
  const h = hallById(d.hall)
  return (
    <div>
      <H eyebrow="Итог" title="Проверьте бронь" />
      <div className="rounded-[24px] overflow-hidden" style={{ background: 'var(--card)', boxShadow: '0 0 0 1px var(--line), var(--shadow)' }}>
        <div className="relative h-28">
          <img src={h.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.7), rgba(0,0,0,.1))' }} />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white">
            <div className="font-display font-light text-[26px] tracking-[.08em] leading-none">{h.name}</div>
            <div className="text-[13.5px] mt-1.5 opacity-90">{dLabel(bookingDate)} · <span className="num">{timeRange(start, hours)}</span></div>
          </div>
        </div>
        <div className="p-5">
          {q.lines.map(([n, v]) => <div key={n} className="flex justify-between gap-3 py-1.5 text-[14px]"><span style={{ color: 'var(--ink-2)' }}>{n}</span><span className="num shrink-0">{v ? money(v) : 'бесплатно'}</span></div>)}
          {d.extra.map((x, i) => <div key={i} className="flex justify-between gap-3 py-1.5 text-[14px]"><span style={{ color: 'var(--ink-2)' }}><Layers className="inline size-3.5 mr-1 -mt-0.5" style={{ color: 'var(--accent)' }} />{hallById(x.hall).name} · {dLabel(x.date, false)}, <span className="num">{timeRange(x.start, x.hours)}</span></span><span className="num shrink-0">{money(extraQ[i])}</span></div>)}
          {discount > 0 && <div className="flex justify-between gap-3 py-1.5 text-[14px]" style={{ color: 'var(--good)' }}><span>Скидка по приглашению · {refPct}%</span><span className="num">−{money(discount)}</span></div>}
          {bonusApplied > 0 && <div className="flex justify-between gap-3 py-1.5 text-[14px]" style={{ color: 'var(--accent)' }}><span>Бонусами</span><span className="num">−{money(bonusApplied)}</span></div>}
          <div className="mt-3 pt-3 border-t border-dashed flex justify-between items-baseline" style={{ borderColor: 'var(--line-2)' }}><span className="font-medium">К оплате</span><b className="font-display text-[26px] font-normal num">{money(toPay)}</b></div>
        </div>
      </div>
      <div className="mt-4 rounded-[18px] p-4 flex gap-3 text-[13.5px] leading-snug" style={{ background: 'var(--card-2)', color: 'var(--ink-2)' }}>
        <Info className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
        <span>Бронь закрепляется после 100% оплаты. Перенос или отмена менее чем за 72 часа — удержание 50%, менее чем за 24 часа — 100%.</span>
      </div>
      <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
        <button type="button" onClick={() => set({ rules: !d.rules })} className="mt-0.5 size-6 rounded-lg grid place-items-center shrink-0 transition-all" style={{ background: d.rules ? 'var(--accent)' : 'transparent', boxShadow: d.rules ? 'none' : 'inset 0 0 0 1.5px var(--line-2)', color: 'var(--accent-ink)' }} aria-pressed={d.rules} aria-label="Согласен с правилами">{d.rules && <Check className="size-4" />}</button>
        <span className="text-[14px] leading-snug">Согласен с <button type="button" className="underline underline-offset-2" style={{ color: 'var(--accent)' }} onClick={openRules}>правилами студии</button>: без курения и открытого огня, бережно к фонам и декору.</span>
      </label>
    </div>
  )
}

/* ================================================================ step 5: done */
function StepDone({ done, onInstall, onAgain, installed }: { done: Done; onInstall: () => void; onAgain: () => void; installed: boolean }) {
  const h = hallById(done.hall)
  const ics = () => {
    const st = parseYmd(done.date); st.setHours(done.start, 0, 0, 0)
    const en = new Date(st.getTime() + done.hours * 36e5 - 5 * 6e4)
    const f = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moloko//Booking//RU', 'BEGIN:VEVENT', `UID:${done.id}@moloko`, `DTSTART:${f(st)}`, `DTEND:${f(en)}`, `SUMMARY:Съёмка в Moloko · ${h.name}`, `LOCATION:${STUDIO.address}`, 'DESCRIPTION:Заявка отправлена. Бронь закрепляется после оплаты.', 'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:Съёмка в Moloko', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' })); a.download = 'moloko.ics'; a.click()
  }
  const wa = `${STUDIO.wa}?text=${encodeURIComponent(`Здравствуйте! Оставил(а) заявку: ${h.name}, ${dLabel(done.date)}, ${timeRange(done.start, done.hours)}. ${done.name}`)}`
  return (
    <div className="pt-8 text-center">
      <motion.div initial={{ scale: .4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto size-20 rounded-full grid place-items-center" style={{ background: 'var(--accent)', boxShadow: '0 0 0 10px var(--accent-soft)' }}>
        <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" className="draw-check" /></svg>
      </motion.div>
      <h2 className="font-display font-light text-[30px] mt-6">Заявка принята</h2>
      <p className="mt-2 text-[14.5px] max-w-sm mx-auto" style={{ color: 'var(--muted)' }}>Администратор напишет в WhatsApp и пришлёт счёт Kaspi. После оплаты бронь закрепится за вами.</p>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .6, ease: [.16, 1, .3, 1] }} className="mt-7 text-left rounded-[24px] overflow-hidden" style={{ background: 'var(--card)', boxShadow: '0 0 0 1px var(--line), var(--shadow)' }}>
        <div className="relative h-32"><img src={h.img} alt="" className="absolute inset-0 w-full h-full object-cover" /><div className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.6))' }} /><div className="absolute left-5 bottom-3 text-white font-display font-light text-[28px] tracking-[.08em]">{h.name}</div></div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-[14px]">
          {done.items && done.items.length > 1 && <div className="col-span-2 flex flex-col gap-1">{done.items.map((x, i) => <div key={i} className="flex items-center gap-2 text-[13.5px]"><Layers className="size-3.5" style={{ color: 'var(--accent)' }} /><b className="tracking-[.05em]">{hallById(x.hall).name}</b><span style={{ color: 'var(--muted)' }}>{dLabel(x.date, false)} · <span className="num">{timeRange(x.start, x.hours)}</span></span></div>)}</div>}
          <div><div className="label !mb-0.5">Дата</div><b>{dLabel(done.date)}</b></div>
          <div><div className="label !mb-0.5">Время</div><b className="num">{timeRange(done.start, done.hours)}</b></div>
          <div><div className="label !mb-0.5">К оплате</div><b className="num">{money(done.pay)}</b>{done.bonus > 0 && <span className="text-[12px]" style={{ color: 'var(--accent)' }}> · −{money(done.bonus)} бонусами</span>}{done.discount ? <span className="text-[12px]" style={{ color: 'var(--good)' }}> · скидка {done.discount}%</span> : null}</div>
          <div><div className="label !mb-0.5">Адрес</div><b>Торайгырова 21/1</b></div>
        </div>
        <div className="border-t border-dashed mx-5" style={{ borderColor: 'var(--line-2)' }} />
        <div className="p-3 grid grid-cols-3 gap-2">
          <button className="btn btn-ghost btn-sm !px-2" onClick={ics}><CalendarPlus className="size-4" />Календарь</button>
          <a className="btn btn-ghost btn-sm !px-2" href={wa} target="_blank" rel="noopener"><MessageCircle className="size-4" />WhatsApp</a>
          <a className="btn btn-ghost btn-sm !px-2" href={STUDIO.gis} target="_blank" rel="noopener"><MapPin className="size-4" />Маршрут</a>
        </div>
      </motion.div>

      {!installed && (
        <motion.button initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .45, duration: .6, ease: [.16, 1, .3, 1] }} onClick={onInstall}
          className="mt-4 w-full text-left rounded-[24px] p-4 flex items-center gap-4" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
          <span className="size-14 rounded-[16px] grid place-items-center shrink-0" style={{ background: '#0D4042' }}><Logo className="w-11" circle="transparent" inner="#FFF9ED" ink="#FFF9ED" sub={false} /></span>
          <span className="flex-1"><b className="block text-[15px]">Moloko на главном экране</b><span className="text-[12.5px] opacity-70">Бронь в два касания, бонусы всегда под рукой</span></span>
          <span className="btn btn-sm" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>Установить</span>
        </motion.button>
      )}
      <button className="btn btn-line w-full mt-4" onClick={onAgain}>Забронировать ещё</button>
    </div>
  )
}

function Footer() {
  return (
    <footer className="px-5 sm:px-8 lg:px-10 pb-32 lg:pb-28 pt-6 border-t hairline text-[13px] flex flex-wrap gap-x-5 gap-y-2" style={{ color: 'var(--muted)' }}>
      <a href={STUDIO.gis} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-[var(--ink)]"><MapPin className="size-3.5" />{STUDIO.address}</a>
      <a href={STUDIO.wa} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-[var(--ink)]"><MessageCircle className="size-3.5" />{STUDIO.phone}</a>
      <a href={STUDIO.ig} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-[var(--ink)]"><Instagram className="size-3.5" />@moloko.artstudios</a>
    </footer>
  )
}

