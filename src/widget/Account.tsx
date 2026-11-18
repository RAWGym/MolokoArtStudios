import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { create } from 'zustand'
import { Gift, LogOut, Copy, Share2, Users, Eye, EyeOff, ShieldCheck, Clock, CalendarDays, Sparkles } from 'lucide-react'
import { Sheet, Segmented, Counter, toast, cx } from '../ui/kit'
import { hallById } from '../lib/catalog'
import { errCode, sb } from '../lib/supabase'
import { refUrl } from '../lib/messages'
import { maskPhone, normPhone, money, num, plural, timeRange, today, relTime, fmtPhone, dShort, DOW, parseYmd } from '../lib/format'
import { fetchMe, clientLogin, clientRegister, clientLogout, type Me } from './publicApi'

/* ------------------------------------------------------------ session store */
interface Acc { me: Me | null; ready: boolean; load: () => Promise<void>; logout: () => Promise<void> }
export const useAccount = create<Acc>((set) => ({
  me: null, ready: false,
  async load() {
    try { set({ me: await fetchMe(), ready: true }) } catch { set({ me: null, ready: true }) }
  },
  async logout() { await clientLogout(); set({ me: null }) },
}))
let started = false
export function useAccountBoot() {
  useEffect(() => {
    if (started) return; started = true
    useAccount.getState().load()
    const { data } = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') useAccount.getState().load() })
    return () => data.subscription.unsubscribe()
  }, [])
}

const ERR: Record<string, string> = {
  bad_login: 'Неверный номер или пароль', bad_phone: 'Проверьте номер телефона', weak_password: 'Пароль — минимум 6 символов',
  phone_taken: 'На этот номер уже есть кабинет. Войдите', blocked: 'Не получилось создать кабинет. Напишите нам в WhatsApp',
  network: 'Нет связи. Проверьте интернет',
}

export function AccountSheet({ open, onClose, onBook }: { open: boolean; onClose: () => void; onBook: () => void }) {
  const me = useAccount(s => s.me)
  return (
    <Sheet open={open} onClose={onClose} title={me ? undefined : 'Личный кабинет'}>
      <AnimatePresence mode="wait" initial={false}>
        {me ? <motion.div key="cab" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Cabinet me={me} onBook={() => { onClose(); onBook() }} /></motion.div>
          : <motion.div key="auth" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Auth /></motion.div>}
      </AnimatePresence>
    </Sheet>
  )
}

function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [phone, setPhone] = useState(''), [name, setName] = useState(''), [pw, setPw] = useState(''), [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const pn = normPhone(phone)
  const ok = pn.length === 11 && pw.length >= 6 && (mode === 'in' || name.trim().length >= 2)
  const submit = async () => {
    if (!ok) return
    setBusy(true)
    try {
      if (mode === 'in') await clientLogin(pn, pw); else await clientRegister(pn, pw, name.trim())
      await useAccount.getState().load()
      toast(mode === 'in' ? 'С возвращением!' : 'Кабинет создан')
    } catch (e) {
      const c = errCode(e); toast(ERR[c] ?? 'Не получилось. Попробуйте ещё раз', 'err')
      if (c === 'phone_taken') setMode('in')
    } finally { setBusy(false) }
  }
  return (
    <form className="flex flex-col gap-4 pt-1" onSubmit={e => { e.preventDefault(); submit() }}>
      <p className="text-[14px] leading-snug" style={{ color: 'var(--muted)' }}>Бонусы, история съёмок и ваша ссылка для друзей. Бронировать можно и без кабинета.</p>
      <Segmented value={mode} onChange={setMode} items={[['in', 'Вход'], ['up', 'Регистрация']]} className="self-start" />
      <AnimatePresence initial={false}>
        {mode === 'up' && <motion.label initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><span className="label">Имя</span><input className="field" value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Как к вам обращаться" /></motion.label>}
      </AnimatePresence>
      <label><span className="label">Телефон</span><input className="field num" inputMode="tel" autoComplete="tel" value={phone} onFocus={e => { if (!e.target.value) setPhone('+7') }} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="+7 (700) 000-00-00" /></label>
      <label><span className="label">Пароль</span>
        <div className="relative"><input className="field pr-12" type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={e => setPw(e.target.value)} placeholder={mode === 'up' ? 'Минимум 6 символов' : ''} />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 size-9 grid place-items-center" onClick={() => setShow(!show)} aria-label="Показать пароль">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
      </label>
      <button className="btn btn-primary h-12" disabled={!ok || busy}>{busy ? 'Секунду…' : mode === 'in' ? 'Войти' : 'Создать кабинет'}</button>
      {mode === 'in' && <p className="text-[12.5px] text-center" style={{ color: 'var(--muted)' }}>Забыли пароль? Напишите администратору в WhatsApp, он поможет восстановить.</p>}
      {mode === 'up' && <p className="text-[12.5px] text-center leading-snug" style={{ color: 'var(--muted)' }}>Бонусы и история откроются после первой оплаченной брони из кабинета. Так мы убеждаемся, что номер ваш.</p>}
    </form>
  )
}

const KIND: Record<string, string> = { accrual: 'За съёмку', redeem: 'Оплата бонусами', manual: 'От студии', welcome: 'Приветственные', referral: 'За приглашённого друга' }
const ST: Record<string, [string, string]> = { new: ['Ждёт оплаты', 'var(--warn)'], paid: ['Оплачено', 'var(--good)'], done: ['Завершена', 'var(--muted)'], cancelled: ['Отменена', 'var(--bad)'] }

function Cabinet({ me, onBook }: { me: Me; onBook: () => void }) {
  const [tab, setTab] = useState<'next' | 'past' | 'bonus'>('next')
  const t = today()
  const next = me.bookings.filter(b => b.date >= t && b.status !== 'cancelled' && b.status !== 'done').reverse()
  const past = me.bookings.filter(b => !next.includes(b))
  const link = me.refCode ? refUrl(me.refCode) : ''
  const cur = me.basis === 'spent' ? me.level.spent : me.level.hours
  const prog = me.next ? Math.min(1, cur / me.next.from) : 1
  const share = async () => {
    const text = `Бронирую фотостудию Moloko в Алматы. По моей ссылке у тебя −${me.friendPct}% на первую съёмку: ${link}`
    try { if (navigator.share) await navigator.share({ title: 'Moloko Art Studios', text, url: link }); else { await navigator.clipboard.writeText(text); toast('Ссылка скопирована') } } catch { /* cancelled */ }
  }
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="relative overflow-hidden rounded-[26px] p-5 text-white" style={{ background: 'linear-gradient(140deg, #24403F, #3A6367 55%, #7E9B86)' }}>
        <motion.div className="absolute -right-10 -top-14 size-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,249,237,.28), transparent 70%)' }} animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="font-display text-[22px] leading-tight truncate">{me.name || 'Гость Moloko'}</div><div className="text-[13px] opacity-80 num">{fmtPhone(me.phone)}</div></div>
          <button className="size-9 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,.14)' }} onClick={() => useAccount.getState().logout()} aria-label="Выйти"><LogOut className="size-4" /></button>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11.5px] tracking-[.16em] uppercase opacity-75 flex items-center gap-1.5"><Gift className="size-3.5" />Бонусы</div>
            {me.balance !== null ? <div className="font-display text-[40px] leading-none mt-1 num"><Counter value={me.balance} format={n => num(n)} /></div>
              : <div className="text-[13.5px] mt-1.5 opacity-90 max-w-[220px] leading-snug">Откроются после первой оплаченной брони из кабинета</div>}
          </div>
          <div className="text-right"><div className="text-[11.5px] opacity-75">Ваш уровень</div><div className="font-semibold text-[16px]">{me.level.name} · {me.level.pct}%</div></div>
        </div>
        {me.next && <div className="mt-4">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.2)' }}><motion.div className="h-full rounded-full" style={{ background: '#FFF9ED' }} initial={{ width: 0 }} animate={{ width: `${prog * 100}%` }} transition={{ duration: 1, ease: [.16, 1, .3, 1], delay: .2 }} /></div>
          <div className="text-[12px] mt-1.5 opacity-80">До уровня {me.next.name} ({me.next.pct}%): {me.basis === 'spent' ? money(me.next.from - cur) : `${me.next.from - cur} ${plural(me.next.from - cur, 'час', 'часа', 'часов')}`}</div>
        </div>}
        {!me.verified && <div className="mt-4 flex items-center gap-2 text-[12.5px] rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,.12)' }}><ShieldCheck className="size-4 shrink-0" />Номер подтвердится после первой оплаты</div>}
      </div>

      {link && (
        <div className="rounded-[22px] p-4 border hairline" style={{ background: 'var(--card)' }}>
          <div className="flex items-center gap-2 font-semibold text-[15px]"><Sparkles className="size-4" style={{ color: 'var(--gold)' }} />Приглашайте друзей</div>
          <p className="text-[13px] mt-1 leading-snug" style={{ color: 'var(--muted)' }}>Друг получит −{me.friendPct}% на первую бронь по вашей ссылке, а вы — {me.referrerPct}% от его съёмки бонусами.</p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl p-1.5 pl-3.5" style={{ background: 'var(--card-2)' }}>
            <span className="flex-1 min-w-0 truncate text-[13px] num">{link.replace(/^https?:\/\//, '')}</span>
            <button className="icon-btn !size-9" aria-label="Скопировать" onClick={async () => { try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована') } catch { toast(link, 'info') } }}><Copy className="size-4" /></button>
            <button className="btn btn-primary btn-sm !h-9" onClick={share}><Share2 className="size-4" />Поделиться</button>
          </div>
          {me.friends > 0 && <div className="mt-2.5 text-[12.5px] flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><Users className="size-3.5" />По вашей ссылке пришли {me.friends} {plural(me.friends, 'друг', 'друга', 'друзей')}</div>}
        </div>
      )}

      <Segmented value={tab} onChange={setTab} items={[['next', `Предстоящие${next.length ? ' · ' + next.length : ''}`], ['past', 'Прошлые'], ['bonus', 'Бонусы']]} />
      <div className="flex flex-col gap-2 min-h-[120px]">
        {tab !== 'bonus' && ((tab === 'next' ? next : past).length ? (tab === 'next' ? next : past).map((b, i) => {
          const h = hallById(b.hall); const [sl, sc] = ST[b.status] ?? [b.status, 'var(--muted)']
          return (
            <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .04 }} className="flex items-center gap-3 rounded-2xl p-2.5" style={{ background: 'var(--card-2)' }}>
              <img src={h.img} alt="" className="size-14 rounded-xl object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14.5px] tracking-[.04em]">{h.name}{b.group && <span className="ml-1.5 text-[11px] font-normal" style={{ color: 'var(--accent)' }}>комбо</span>}</div>
                <div className="text-[12.5px] flex items-center gap-1" style={{ color: 'var(--muted)' }}><CalendarDays className="size-3 shrink-0" /><span className="truncate">{dShort(b.date)}, {DOW[parseYmd(b.date).getDay()]} · <span className="num">{timeRange(b.start, b.hours)}</span></span></div>
              </div>
              <div className="text-right shrink-0"><div className="num text-[13.5px] font-semibold">{money(b.total - b.bonus)}</div><div className="text-[11.5px]" style={{ color: sc }}>{sl}</div></div>
            </motion.div>)
        }) : <div className="text-center py-8 text-[13.5px]" style={{ color: 'var(--muted)' }}>
          <Clock className="size-6 mx-auto mb-2 opacity-60" />{tab === 'next' ? 'Нет предстоящих съёмок' : 'Здесь появятся прошлые съёмки'}
          {tab === 'next' && <div className="mt-3"><button className="btn btn-primary btn-sm" onClick={onBook}>Забронировать</button></div>}
        </div>)}
        {tab === 'bonus' && (me.balance === null ? <div className="text-center py-8 text-[13.5px]" style={{ color: 'var(--muted)' }}>История бонусов откроется после первой оплаченной брони</div>
          : me.tx.length ? me.tx.map((x, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b hairline last:border-0">
              <span className={cx('size-9 rounded-full grid place-items-center shrink-0 text-[13px] font-semibold')} style={{ background: x.amount > 0 ? 'var(--gold-soft)' : 'var(--card-2)', color: x.amount > 0 ? 'var(--gold)' : 'var(--muted)' }}>{x.amount > 0 ? '+' : '−'}</span>
              <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{KIND[x.kind] ?? x.note}</span><span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{x.note && KIND[x.kind] !== x.note ? x.note + ' · ' : ''}{relTime(x.at)}</span></span>
              <span className="num font-semibold" style={{ color: x.amount > 0 ? 'var(--gold)' : 'var(--ink-2)' }}>{x.amount > 0 ? '+' : ''}{num(x.amount)}</span>
            </div>))
          : <div className="text-center py-8 text-[13.5px]" style={{ color: 'var(--muted)' }}>Бонусы начисляются после каждой завершённой съёмки</div>)}
      </div>
    </div>
  )
}
