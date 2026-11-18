import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { X, Check, AlertTriangle, Info, Minus, Plus } from 'lucide-react'
import clsx from 'clsx'
import type { Status } from '../lib/types'
import { initials } from '../lib/format'
import { LOGO_VIEWBOX, LOGO_WORD_VIEWBOX, MARK_VIEWBOX, MARK_CIRCLE, P_CIRCLE, P_INNER, P_WORD, P_SUB } from './logo'

export const cx = clsx

/* ------------------------------------------------------------ logo (MOΛOKO / art studios) */
export function Logo({ className, circle = 'var(--logo)', inner = 'var(--logo-inner)', ink = 'var(--logo-ink)', sub = true, style }: { className?: string; circle?: string; inner?: string; ink?: string; sub?: boolean; style?: CSSProperties }) {
  return (
    <svg viewBox={sub ? LOGO_VIEWBOX : LOGO_WORD_VIEWBOX} className={className} style={style} role="img" aria-label="Moloko Art Studios">
      <path fill={circle} fillRule="evenodd" d={P_CIRCLE} />
      <path fill={inner} fillRule="evenodd" d={P_INNER} />
      <path fill={ink} fillRule="evenodd" d={P_WORD} />
      {sub && <path fill={ink} fillRule="evenodd" d={P_SUB} />}
    </svg>
  )
}
/** the round mark: circle with the letters that sit inside it */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} width={size} height={size} className={className} aria-hidden>
      <defs><clipPath id="moloko-mark-clip"><circle cx={MARK_CIRCLE.cx} cy={MARK_CIRCLE.cy} r={MARK_CIRCLE.r} /></clipPath></defs>
      <g clipPath="url(#moloko-mark-clip)">
        <circle cx={MARK_CIRCLE.cx} cy={MARK_CIRCLE.cy} r={MARK_CIRCLE.r} fill="var(--logo)" />
        <path fill="var(--logo-inner)" fillRule="evenodd" d={P_INNER} />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------ toasts */
type Toast = { id: number; text: string; tone: 'ok' | 'err' | 'info'; action?: { label: string; run: () => void } }
export const useToasts = create<{ list: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set, get) => ({
  list: [],
  push: t => { const id = Date.now() + Math.random(); set({ list: [...get().list.slice(-2), { ...t, id }] }); setTimeout(() => get().drop(id), t.action ? 6000 : 3200) },
  drop: id => set({ list: get().list.filter(x => x.id !== id) }),
}))
export const toast = (text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']) => useToasts.getState().push({ text, tone, action })

export function Toasts() {
  const { list, drop } = useToasts()
  return (
    <div className="fixed z-[200] left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+88px)] md:bottom-6 flex flex-col items-center gap-2 pointer-events-none w-[min(440px,calc(100%-24px))]">
      <AnimatePresence initial={false}>
        {list.map(t => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .96 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] shadow-2xl w-full"
            style={{ background: 'color-mix(in oklab, var(--ink) 94%, transparent)', color: 'var(--bg)' }}>
            <span className="grid place-items-center size-6 rounded-full shrink-0" style={{ background: t.tone === 'err' ? 'var(--bad)' : t.tone === 'info' ? 'var(--info)' : 'var(--good)', color: '#fff' }}>
              {t.tone === 'err' ? <AlertTriangle className="size-3.5" /> : t.tone === 'info' ? <Info className="size-3.5" /> : <Check className="size-3.5" />}
            </span>
            <span className="flex-1 leading-snug">{t.text}</span>
            {t.action && <button className="font-semibold underline underline-offset-2" onClick={() => { t.action!.run(); drop(t.id) }}>{t.action.label}</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------ overlays */
function useLockScroll(on: boolean) {
  useEffect(() => {
    if (!on) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [on])
}
function useEsc(on: boolean, fn: () => void) {
  const ref = useRef(fn); ref.current = fn
  useEffect(() => {
    if (!on) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current() }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [on])
}

/** Bottom sheet on phones, centered dialog from md. */
export function Sheet({ open, onClose, children, title, wide, className }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode; wide?: boolean; className?: string }) {
  useLockScroll(open); useEsc(open, onClose)
  // portal: page wrappers use transform/filter, which would trap position:fixed inside them
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center md:p-6">
          <motion.div className="absolute inset-0" style={{ background: 'rgba(8,8,7,.5)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div role="dialog" aria-modal="true"
            initial={{ y: '100%', opacity: .6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: .5 }} onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 600) onClose() }}
            className={cx('relative w-full panel rounded-t-[28px] md:rounded-[28px] max-h-[92dvh] overflow-y-auto thin-scroll safe-b', wide ? 'md:max-w-2xl' : 'md:max-w-lg', className)}
            style={{ background: 'var(--panel, var(--bg))', boxShadow: '0 -20px 60px -20px rgba(0,0,0,.35)' }}>
            <div className="sticky top-0 z-10 pt-2.5 pb-2 px-5 md:px-7" style={{ background: 'inherit' }}>
              <div className="mx-auto mb-2 h-1 w-10 rounded-full md:hidden" style={{ background: 'var(--line-2)' }} />
              {title !== undefined && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="font-display text-[19px] md:text-[21px] font-normal leading-tight">{title}</div>
                  <button className="icon-btn shrink-0" onClick={onClose} aria-label="Закрыть"><X className="size-4" /></button>
                </div>
              )}
            </div>
            <div className="px-5 md:px-7 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Right-hand drawer on tablet/desktop, full sheet on phones. */
export function Drawer({ open, onClose, children, width = 480 }: { open: boolean; onClose: () => void; children: ReactNode; width?: number }) {
  useLockScroll(open); useEsc(open, onClose)
  // portal: page wrappers use transform/filter, which would trap position:fixed inside them
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110]">
          <motion.div className="absolute inset-0" style={{ background: 'rgba(8,8,7,.42)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 360, damping: 40 }}
            className="absolute right-0 top-0 bottom-0 w-full panel overflow-y-auto thin-scroll border-l hairline" style={{ maxWidth: width, boxShadow: '-30px 0 80px -30px rgba(0,0,0,.5)' }}>
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ------------------------------------------------------------ small pieces */
export const STATUS_LABEL: Record<Status, string> = { new: 'Ждёт оплаты', paid: 'Оплачено', done: 'Завершена', cancelled: 'Отменена', block: 'Блокировка' }
export function StatusPill({ s }: { s: Status }) { return <span className={`pill pill-${s}`}>{STATUS_LABEL[s]}</span> }

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--card-2)' }}>
      <button type="button" className="size-9 grid place-items-center rounded-full disabled:opacity-30 transition-colors hover:bg-[var(--card-3)]" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Меньше"><Minus className="size-4" /></button>
      <span className="w-8 text-center font-semibold num">{value}</span>
      <button type="button" className="size-9 grid place-items-center rounded-full disabled:opacity-30 transition-colors hover:bg-[var(--card-3)]" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Больше"><Plus className="size-4" /></button>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: [T, ReactNode][]; className?: string }) {
  return (
    <div className={cx('relative inline-flex p-1 rounded-full', className)} style={{ background: 'var(--card-2)' }}>
      {items.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={cx('relative z-10 h-8 px-3.5 rounded-full text-[13px] font-medium transition-colors', value === k ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]')}>
          {value === k && <motion.span layoutId={`seg-${items.map(i => i[0]).join('')}`} className="absolute inset-0 -z-10 rounded-full" style={{ background: 'var(--card)', boxShadow: '0 1px 3px rgba(0,0,0,.12)' }} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          {label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, size = 36, tone }: { name: string; size?: number; tone?: string }) {
  const hue = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const bg = tone ?? `hsl(${hue} 30% 50% / .2)`
  return <span className="grid place-items-center rounded-full shrink-0 font-semibold" style={{ width: size, height: size, background: bg, color: tone ? 'var(--accent-ink)' : `hsl(${hue} 35% 62%)`, fontSize: size * .36 }}>{initials(name)}</span>
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6 gap-3">
      {icon && <div className="size-14 grid place-items-center rounded-2xl" style={{ background: 'var(--card-2)', color: 'var(--muted)' }}>{icon}</div>}
      <div className="font-display text-[17px]">{title}</div>
      {text && <p className="text-[14px] max-w-sm" style={{ color: 'var(--muted)' }}>{text}</p>}
      {action}
    </div>
  )
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return <label className={cx('block', className)}><span className="label">{label}</span>{children}{hint && <span className="block text-[12px] mt-1.5" style={{ color: 'var(--muted)' }}>{hint}</span>}</label>
}

/** Animated number (counts up when value changes) */
export function Counter({ value, format = (n: number) => String(Math.round(n)), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const a = from.current, b = value, t0 = performance.now(), dur = 700
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4)
      el.textContent = format(a + (b - a) * e)
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value]) // eslint-disable-line
  return <span ref={ref} className={cx('num', className)}>{format(value)}</span>
}
