import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, CalendarPlus, Lock, User, CalendarDays, CornerDownLeft } from 'lucide-react'
import { useStudio } from './store'
import { useUI, type Page } from './ui'
import { useClients, levelTone } from './derive'
import { hallById } from '../lib/catalog'
import { cx, StatusPill } from '../ui/kit'
import { fmtPhone, dShort, timeRange } from '../lib/format'

type Item = { key: string; group: string; label: string; sub?: string; icon: React.ReactNode; run: () => void; right?: React.ReactNode }

export function Palette({ nav }: { nav: { id: Page; label: string; icon: ComponentType<{ className?: string }> }[] }) {
  const { palette, setPalette, go, newBooking, openClient, openBooking } = useUI()
  const bookings = useStudio(s => s.bookings)
  const clients = useClients()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => { if (palette) { setQ(''); setI(0); setTimeout(() => input.current?.focus(), 30) } }, [palette])

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase(), d = s.replace(/\D/g, '')
    const close = (f: () => void) => () => { setPalette(false); f() }
    const out: Item[] = []
    const acts: Item[] = [
      { key: 'a:new', group: 'Действия', label: 'Новая бронь', sub: 'клавиша N', icon: <CalendarPlus className="size-4" />, run: close(() => newBooking()) },
      { key: 'a:block', group: 'Действия', label: 'Закрыть зал на время', icon: <Lock className="size-4" />, run: close(() => newBooking({ mode: 'block' })) },
      ...nav.map(n => ({ key: 'n:' + n.id, group: 'Разделы', label: n.label, icon: <n.icon className="size-4" />, run: close(() => go(n.id)) })),
    ]
    out.push(...acts.filter(a => !s || a.label.toLowerCase().includes(s)))
    if (s.length >= 2 || d.length >= 3) {
      const cs = clients.filter(c => c.name.toLowerCase().includes(s) || (d.length >= 3 && c.phone.includes(d)) || c.tags.some(t => t.toLowerCase().includes(s))).sort((a, b) => b.visits - a.visits).slice(0, 6)
      out.push(...cs.map(c => ({ key: 'c:' + c.phone, group: 'Клиенты', label: c.name || fmtPhone(c.phone), sub: `${fmtPhone(c.phone)} · ${c.visits} виз. · бонусов ${c.balance}`, icon: <span className="size-6 rounded-full grid place-items-center text-[11px] font-semibold" style={{ background: levelTone(c.level.id), color: '#1a1714' }}>{(c.name || '?')[0]}</span>, run: close(() => openClient(c.phone)) })))
      const bs = bookings.filter(b => b.status !== 'block' && (b.name.toLowerCase().includes(s) || (d.length >= 3 && b.phoneNorm.includes(d)) || hallById(b.hall).name.toLowerCase() === s)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
      out.push(...bs.map(b => ({ key: 'b:' + b.id, group: 'Брони', label: `${b.name} · ${hallById(b.hall).name}`, sub: `${dShort(b.date)} · ${timeRange(b.start, b.hours)}`, icon: <CalendarDays className="size-4" />, right: <StatusPill s={b.status} />, run: close(() => openBooking(b.id)) })))
    }
    return out
  }, [q, clients, bookings, nav]) // eslint-disable-line

  useEffect(() => { setI(0) }, [q])
  useEffect(() => { list.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' }) }, [i])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(items.length - 1, x + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); items[i]?.run() }
    else if (e.key === 'Escape') setPalette(false)
  }

  let last = ''
  return (
    <AnimatePresence>
      {palette && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center p-3 pt-[max(12px,env(safe-area-inset-top))] md:pt-[12vh]">
          <motion.div className="absolute inset-0" style={{ background: 'rgba(8,8,7,.5)', backdropFilter: 'blur(4px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPalette(false)} />
          <motion.div initial={{ opacity: 0, y: -12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .98 }} transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            className="relative w-full max-w-[620px] panel rounded-[24px] border hairline overflow-hidden" style={{ boxShadow: '0 40px 100px -30px rgba(0,0,0,.6)' }} onKeyDown={onKey}>
            <div className="flex items-center gap-3 px-5 h-16 border-b hairline">
              <Search className="size-5 shrink-0" style={{ color: 'var(--muted)' }} />
              <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Имя, телефон, зал или раздел…" className="flex-1 bg-transparent outline-none text-[16px] min-w-0" />
              <kbd className="hidden md:inline text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: 'var(--card-2)', color: 'var(--muted)' }}>esc</kbd>
            </div>
            <div ref={list} className="max-h-[min(60vh,480px)] overflow-y-auto thin-scroll p-2">
              {items.length === 0 && <div className="py-10 text-center text-[14px]" style={{ color: 'var(--muted)' }}><User className="size-5 mx-auto mb-2" />Ничего не нашлось</div>}
              {items.map((it, k) => {
                const head = it.group !== last; last = it.group
                return (
                  <div key={it.key}>
                    {head && <div className="eyebrow px-3 pt-3 pb-1.5">{it.group}</div>}
                    <button data-i={k} onMouseMove={() => setI(k)} onClick={it.run} className={cx('w-full flex items-center gap-3 px-3 h-12 rounded-xl text-left transition-colors', i === k && 'bg-[var(--card-2)]')}>
                      <span className="size-8 grid place-items-center rounded-lg shrink-0" style={{ background: 'var(--card-2)', color: 'var(--ink-2)' }}>{it.icon}</span>
                      <span className="flex-1 min-w-0"><span className="block text-[14.5px] truncate">{it.label}</span>{it.sub && <span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{it.sub}</span>}</span>
                      {it.right}
                      {i === k && <CornerDownLeft className="size-4 hidden md:block" style={{ color: 'var(--faint)' }} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
