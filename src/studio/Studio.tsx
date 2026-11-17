import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, CalendarDays, KanbanSquare, Users, Wallet, BarChart3, Gift, Tags, ShieldCheck, History, Search, Plus, Sun, Moon, LogOut, MoreHorizontal, ExternalLink, Lock, Eye, EyeOff, Bell } from 'lucide-react'
import { useStudio } from './store'
import { useUI, type Page, OWNER_PAGES } from './ui'
import { cx, Logo, LogoMark, Avatar, Sheet, toast } from '../ui/kit'
import { errCode } from '../lib/supabase'
import { store } from '../lib/format'
import { BookingDrawer } from './BookingDrawer'
import { BookingForm } from './BookingForm'
import { ClientDrawer } from './ClientDrawer'
import { Palette } from './Palette'
import { InstallSheet, useInstall } from '../widget/Install'
import Overview from './pages/Overview'
import Schedule from './pages/Schedule'
import Pipeline from './pages/Pipeline'
import Clients from './pages/Clients'

const Finance = lazy(() => import('./pages/Finance'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Loyalty = lazy(() => import('./pages/Loyalty'))
const Prices = lazy(() => import('./pages/Prices'))
const Team = lazy(() => import('./pages/Team'))
const Journal = lazy(() => import('./pages/Journal'))

const NAV: { id: Page; label: string; short?: string; icon: ComponentType<{ className?: string }>; owner?: boolean }[] = [
  { id: 'overview', label: 'Сводка', icon: LayoutDashboard },
  { id: 'schedule', label: 'Расписание', short: 'График', icon: CalendarDays },
  { id: 'pipeline', label: 'Заявки', icon: KanbanSquare },
  { id: 'clients', label: 'Клиенты', icon: Users },
  { id: 'finance', label: 'Финансы', icon: Wallet, owner: true },
  { id: 'analytics', label: 'Аналитика', icon: BarChart3, owner: true },
  { id: 'loyalty', label: 'Бонусы', icon: Gift, owner: true },
  { id: 'prices', label: 'Прайс', icon: Tags, owner: true },
  { id: 'team', label: 'Команда', icon: ShieldCheck, owner: true },
  { id: 'journal', label: 'Журнал', icon: History, owner: true },
]

export default function Studio() {
  const phase = useStudio(s => s.phase)
  useEffect(() => { document.documentElement.dataset.app = 'studio'; useStudio.getState().init() }, [])
  return (
    <>
      <div className="scene" aria-hidden />
      <div className="relative z-10">
        {phase === 'boot' && <BootScreen />}
        {(phase === 'login' || phase === 'setup') && <AuthScreen setup={phase === 'setup'} />}
        {phase === 'app' && <Shell />}
      </div>
    </>
  )
}

function BootScreen() {
  return <div className="min-h-dvh grid place-items-center"><motion.div animate={{ scale: [1, 1.06, 1], opacity: [.6, 1, .6] }} transition={{ repeat: Infinity, duration: 1.6 }}><LogoMark size={56} /></motion.div></div>
}

/* ================================================================ auth */
function AuthScreen({ setup }: { setup: boolean }) {
  const { login, setup: doSetup } = useStudio()
  const [name, setName] = useState(''), [lg, setLg] = useState(''), [pw, setPw] = useState('')
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [shake, setShake] = useState(0)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    const l = lg.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,32}$/.test(l)) { setErr('Логин — латиница или цифры, от 3 символов'); setShake(x => x + 1); return }
    if (setup && pw.length < 6) { setErr('Пароль — минимум 6 символов'); setShake(x => x + 1); return }
    setBusy(true)
    try { setup ? await doSetup(name.trim() || 'Владелец', l, pw) : await login(l, pw) }
    catch (e) {
      const c = errCode(e)
      setErr({ bad_credentials: 'Неверный логин или пароль', disabled: 'Доступ отключён владельцем', already_set_up: 'Студия уже настроена — войдите своим логином', network: 'Нет связи с сервером. Проверьте интернет.' }[c] ?? 'Не получилось войти. Попробуйте ещё раз.')
      setShake(x => x + 1); setPw('')
    } finally { setBusy(false) }
  }
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:block relative overflow-hidden">
        <img src="/img/black.jpg" alt="" className="absolute inset-0 w-full h-full object-cover kenburns" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.75))' }} />
        <div className="absolute left-12 bottom-14 right-12 text-white">
          <Logo className="h-10 w-auto mb-8" circle="#3A6367" inner="#FFF9ED" ink="#FFF9ED" />
          <div className="font-display font-light text-[44px] leading-[1.05] tracking-[-.01em]">Студия под контролем.<br />Каждый час на виду.</div>
        </div>
      </div>
      <div className="grid place-items-center px-5 py-10 safe-t">
        <motion.form key={shake} onSubmit={submit} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: .4 }} className="w-full max-w-[400px]">
          <div className="lg:hidden mb-10"><Logo className="h-9 w-auto" /></div>
          <div className="glass p-6 md:p-8 rise">
            <div className="flex items-center gap-2 eyebrow"><Lock className="size-3.5" />Moloko Studio · CRM</div>
            <h1 className="font-display font-light text-[30px] mt-3 leading-tight">{setup ? 'Первый вход' : 'Вход для команды'}</h1>
            <p className="text-[14px] mt-2" style={{ color: 'var(--muted)' }}>{setup ? 'Создайте аккаунт владельца. Администраторов добавите потом в разделе «Команда».' : 'Администраторы и владельцы входят по своему логину и паролю.'}</p>
            <div className="mt-6 flex flex-col gap-4">
              {setup && <label><span className="label">Ваше имя</span><input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Например, Айгерим" autoComplete="name" /></label>}
              <label><span className="label">Логин</span><input className="field" value={lg} onChange={e => setLg(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="username" placeholder="aigerim" /></label>
              <label><span className="label">Пароль</span>
                <div className="relative"><input className="field pr-12" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete={setup ? 'new-password' : 'current-password'} />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 size-9 grid place-items-center rounded-xl" style={{ color: 'var(--muted)' }} onClick={() => setShow(v => !v)} aria-label="Показать пароль">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
              </label>
              <AnimatePresence>{err && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[13.5px]" style={{ color: 'var(--bad)' }} role="alert">{err}</motion.div>}</AnimatePresence>
              <button className="btn btn-primary h-12 mt-1" disabled={busy || !lg || !pw}>{busy ? 'Входим…' : setup ? 'Создать и войти' : 'Войти'}</button>
            </div>
          </div>
          <a href="/" className="block text-center text-[13px] mt-6 underline underline-offset-4" style={{ color: 'var(--muted)' }}>Страница бронирования для клиентов</a>
        </motion.form>
      </div>
    </div>
  )
}

/* ================================================================ shell */
function useTheme() {
  const [t, setT] = useState<string>(() => document.documentElement.dataset.theme || 'dark')
  const toggle = () => {
    const n = t === 'dark' ? 'light' : 'dark'
    const apply = () => { document.documentElement.dataset.theme = n; store.set('moloko.theme', n); try { localStorage.setItem('moloko.theme', n) } catch { /* */ } setT(n); (document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null)?.setAttribute('content', n === 'dark' ? '#12100E' : '#EFE6D8') }
    const d = document as any
    if (d.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) d.startViewTransition(apply); else apply()
  }
  return { theme: t, toggle }
}

function Shell() {
  const { me, bookings, live, logout } = useStudio()
  const { page, go, newBooking, setPalette, more, setMore } = useUI()
  const { theme, toggle } = useTheme()
  const install = useInstall()
  const [installOpen, setInstallOpen] = useState(false)
  const owner = me?.role === 'owner'
  const nav = NAV.filter(n => !n.owner || owner)
  const pending = bookings.filter(b => b.status === 'new').length
  const current = owner || !OWNER_PAGES.includes(page) ? page : 'overview'

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) }
      if (e.key === 'n' && !(e.target as HTMLElement).closest('input,textarea,select') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); newBooking() }
    }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [])
  useEffect(() => { const t = NAV.find(n => n.id === current); document.title = `${t?.label ?? 'CRM'}${pending ? ` (${pending})` : ''} · Moloko Studio` }, [current, pending])

  const askNotify = async () => {
    if (typeof Notification === 'undefined') { toast('Браузер не поддерживает уведомления', 'info'); return }
    const r = await Notification.requestPermission()
    toast(r === 'granted' ? 'Уведомления о новых заявках включены' : 'Уведомления не разрешены в браузере', r === 'granted' ? 'ok' : 'info')
  }

  const PageC = { overview: Overview, schedule: Schedule, pipeline: Pipeline, clients: Clients, finance: Finance, analytics: Analytics, loyalty: Loyalty, prices: Prices, team: Team, journal: Journal }[current]

  return (
    <div className="min-h-dvh md:pl-[84px] xl:pl-[248px]">
      {/* side dock: icons on tablet, full labels on desktop */}
      <aside className="hidden md:flex fixed left-3 top-3 bottom-3 z-40 w-[68px] xl:w-[228px] flex-col glass !rounded-[26px] p-2.5 xl:p-3">
        <button onClick={() => go('overview')} className="flex items-center gap-2 px-1.5 xl:px-2 pt-2 pb-5"><LogoMark size={40} /><span className="hidden xl:block font-display text-[15px] tracking-[.12em]">MOΛOKO</span></button>
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar">
          {nav.map((n, i) => {
            const on = current === n.id
            return (
              <div key={n.id}>
                {n.owner && !nav[i - 1]?.owner && <div className="hidden xl:block eyebrow px-3 pt-4 pb-1.5">Владелец</div>}
                {n.owner && !nav[i - 1]?.owner && <div className="xl:hidden mx-3 my-2 border-t hairline" />}
                <button onClick={() => go(n.id)} title={n.label} className={cx('group relative w-full h-11 flex items-center gap-3 rounded-[14px] px-3 text-[14px] font-medium transition-colors', on ? 'text-[var(--accent-ink)]' : 'text-[var(--ink-2)] hover:bg-[var(--card-2)]')}>
                  {on && <motion.span layoutId="nav-on" className="absolute inset-0 rounded-[14px]" style={{ background: 'var(--accent)' }} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <n.icon className="relative size-[19px] shrink-0" />
                  <span className="relative hidden xl:block truncate">{n.label}</span>
                  {n.id === 'pipeline' && pending > 0 && <span className={cx('relative ml-auto min-w-5 h-5 px-1.5 rounded-full grid place-items-center text-[11px] font-bold num', 'absolute xl:static -top-0.5 -right-0.5 xl:top-auto xl:right-auto')} style={{ background: on ? 'var(--accent-ink)' : 'var(--warn)', color: on ? 'var(--accent)' : '#1a1206' }}>{pending}</span>}
                </button>
              </div>
            )
          })}
        </nav>
        <div className="pt-2 mt-2 border-t hairline flex flex-col gap-1">
          <a href="/" target="_blank" rel="noopener" title="Страница брони" className="h-10 flex items-center gap-3 rounded-[14px] px-3 text-[13.5px] text-[var(--muted)] hover:bg-[var(--card-2)]"><ExternalLink className="size-[18px] shrink-0" /><span className="hidden xl:block">Страница брони</span></a>
          <button onClick={toggle} title="Тема" className="h-10 flex items-center gap-3 rounded-[14px] px-3 text-[13.5px] text-[var(--muted)] hover:bg-[var(--card-2)]">{theme === 'dark' ? <Sun className="size-[18px] shrink-0" /> : <Moon className="size-[18px] shrink-0" />}<span className="hidden xl:block">{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span></button>
          <div className="flex items-center gap-2.5 px-1.5 xl:px-2 pt-2">
            <Avatar name={me?.name ?? ''} size={36} />
            <div className="hidden xl:block min-w-0 flex-1"><div className="text-[13.5px] font-semibold truncate">{me?.name}</div><div className="text-[11.5px]" style={{ color: owner ? 'var(--gold)' : 'var(--muted)' }}>{owner ? 'Владелец' : 'Администратор'}</div></div>
            <button onClick={logout} title="Выйти" className="hidden xl:grid icon-btn !size-9 !rounded-xl"><LogOut className="size-4" /></button>
          </div>
        </div>
      </aside>

      {/* top bar */}
      <header className="sticky top-0 z-30 safe-t">
        <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 lg:px-8 h-16 md:h-[72px]" style={{ background: 'linear-gradient(var(--bg) 0%, color-mix(in oklab, var(--bg) 70%, transparent) 70%, transparent)' }}>
          <div className="md:hidden"><LogoMark size={34} /></div>
          <button onClick={() => setPalette(true)} className="flex-1 md:flex-none md:w-[340px] lg:w-[420px] h-10 md:h-11 flex items-center gap-2.5 rounded-full px-4 text-[14px] glass !rounded-full" style={{ color: 'var(--muted)' }}>
            <Search className="size-4 shrink-0" /><span className="truncate">Клиент, телефон, бронь…</span><kbd className="hidden lg:inline ml-auto text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: 'var(--card-2)' }}>⌘K</kbd>
          </button>
          <div className="flex-1 hidden md:block" />
          <span className="hidden sm:flex items-center gap-2 text-[12.5px] px-3 h-9 rounded-full glass !rounded-full" title={live === 'live' ? 'Данные обновляются в реальном времени' : 'Нет связи в реальном времени'}>
            {live === 'live' ? <span className="live-dot" /> : <span className="size-2 rounded-full" style={{ background: live === 'connecting' ? 'var(--warn)' : 'var(--bad)' }} />}
            <span style={{ color: 'var(--muted)' }}>{live === 'live' ? 'Онлайн' : live === 'connecting' ? 'Подключение' : 'Офлайн'}</span>
          </span>
          {typeof Notification !== 'undefined' && Notification.permission === 'default' && <button className="icon-btn hidden sm:grid glass !rounded-full" onClick={askNotify} title="Уведомления о заявках"><Bell className="size-4" /></button>}
          <button className="btn btn-primary h-10 md:h-11 px-4" onClick={() => newBooking()}><Plus className="size-4" /><span className="hidden sm:inline">Бронь</span></button>
        </div>
      </header>

      <main className="px-4 md:px-6 lg:px-8 pb-28 md:pb-10 pt-1 max-w-[1500px]">
        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .28, ease: [.16, 1, .3, 1] }}>
            <Suspense fallback={<div className="skel h-60" />}><PageC /></Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* phone tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 safe-b pt-2" style={{ background: 'linear-gradient(transparent, var(--bg) 40%)' }}>
        <div className="glass !rounded-[24px] grid grid-cols-5 p-1.5">
          {[...nav.slice(0, 4), { id: 'more' as const, label: 'Ещё', icon: MoreHorizontal }].map(n => {
            const on = n.id === 'more' ? (OWNER_PAGES.includes(current) || more) : current === n.id
            return (
              <button key={n.id} onClick={() => n.id === 'more' ? setMore(true) : go(n.id as Page)} className="relative h-14 flex flex-col items-center justify-center gap-1 rounded-[18px] text-[10.5px] font-medium">
                {on && <motion.span layoutId="tab-on" className="absolute inset-0 rounded-[18px]" style={{ background: 'var(--accent-soft)' }} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <n.icon className={cx('relative size-[21px]', on ? 'text-[var(--accent)]' : 'text-[var(--muted)]')} />
                <span className={cx('relative', on ? 'text-[var(--ink)]' : 'text-[var(--muted)]')}>{'short' in n && n.short ? n.short : n.label}</span>
                {n.id === 'pipeline' && pending > 0 && <span className="absolute top-1.5 right-[calc(50%-20px)] min-w-4 h-4 px-1 rounded-full grid place-items-center text-[10px] font-bold" style={{ background: 'var(--warn)', color: '#1a1206' }}>{pending}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Ещё">
        <div className="flex items-center gap-3 p-3 rounded-2xl mb-3" style={{ background: 'var(--card-2)' }}>
          <Avatar name={me?.name ?? ''} size={42} />
          <div className="flex-1 min-w-0"><div className="font-semibold truncate">{me?.name}</div><div className="text-[12.5px]" style={{ color: owner ? 'var(--gold)' : 'var(--muted)' }}>{owner ? 'Владелец' : 'Администратор'} · {me?.login}</div></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {nav.filter(n => n.owner).map(n => (
            <button key={n.id} onClick={() => go(n.id)} className="aspect-[1.15] rounded-2xl flex flex-col items-center justify-center gap-2 text-[13px] font-medium" style={{ background: current === n.id ? 'var(--accent-soft)' : 'var(--card-2)' }}>
              <n.icon className="size-5" />{n.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col">
          {[
            { icon: theme === 'dark' ? Sun : Moon, label: theme === 'dark' ? 'Светлая тема' : 'Тёмная тема', run: toggle },
            ...(typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? [{ icon: Bell, label: 'Уведомления о заявках', run: askNotify }] : []),
            ...(!install.installed ? [{ icon: Plus, label: 'Установить CRM на экран', run: () => { setMore(false); setInstallOpen(true) } }] : []),
            { icon: ExternalLink, label: 'Страница брони для клиентов', run: () => window.open('/', '_blank') },
            { icon: LogOut, label: 'Выйти', run: logout },
          ].map(r => <button key={r.label} onClick={r.run} className="h-12 flex items-center gap-3 px-2 border-b hairline last:border-0 text-[15px]"><r.icon className="size-[18px]" style={{ color: 'var(--muted)' } as any} />{r.label}</button>)}
        </div>
      </Sheet>

      <BookingDrawer />
      <BookingForm />
      <ClientDrawer />
      <Palette nav={nav} />
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} install={install} title="Moloko CRM" sub="Иконка на экране iPad или телефона — открывается как приложение" />
    </div>
  )
}

