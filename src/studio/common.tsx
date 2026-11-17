import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cx, Counter } from '../ui/kit'
import { compact } from '../lib/format'

export function Card({ children, className, title, action, pad = true, delay = 0 }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: .55, ease: [.16, 1, .3, 1] }} className={cx('glass min-w-0', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-1">
          <h3 className="text-[14.5px] font-semibold tracking-[-.005em]">{title}</h3>
          {action}
        </div>
      )}
      <div className={cx(pad && 'p-5 pt-3')}>{children}</div>
    </motion.section>
  )
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5 md:mb-6">
      <div className="min-w-0">
        <h1 className="font-display font-light text-[26px] md:text-[32px] leading-[1.05] tracking-[-.01em]">{title}</h1>
        {sub && <div className="mt-1.5 text-[13.5px]" style={{ color: 'var(--muted)' }}>{sub}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function Kpi({ label, value, format, sub, tone, icon, delay = 0, onClick }: { label: string; value: number; format: (n: number) => string; sub?: ReactNode; tone?: string; icon?: ReactNode; delay?: number; onClick?: () => void }) {
  const C = onClick ? 'button' : 'div'
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: .55, ease: [.16, 1, .3, 1] }} className="glass min-w-0">
      <C onClick={onClick} className={cx('w-full text-left p-4 md:p-5 block', onClick && 'hover:bg-[var(--card-2)] transition-colors rounded-[var(--radius)]')}>
        <div className="flex items-center justify-between gap-2 text-[12.5px]" style={{ color: 'var(--muted)' }}><span className="truncate">{label}</span>{icon && <span style={{ color: tone ?? 'var(--accent)' }}>{icon}</span>}</div>
        <div className="mt-2 font-display text-[clamp(19px,5.6vw,24px)] md:text-[28px] leading-none whitespace-nowrap tracking-[-.02em]" style={{ color: tone }}><Counter value={value} format={format} /></div>
        {sub && <div className="mt-2 text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{sub}</div>}
      </C>
    </motion.div>
  )
}

/** Smooth area chart with hover read-out. Re-animates when data length changes (week/month/year morph). */
export function AreaChart({ data, height = 220, format = (n: number) => String(n), color = 'var(--accent)', highlightLast = true }: { data: { label: string; value: number; sub?: string }[]; height?: number; format?: (n: number) => string; color?: string; highlightLast?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 1000, H = height, P = 8
  const max = Math.max(1, ...data.map(d => d.value)) * 1.15
  const pts = data.map((d, i) => [P + (i * (W - 2 * P)) / Math.max(1, data.length - 1), H - 24 - (d.value / max) * (H - 48)] as const)
  const path = useMemo(() => {
    if (!pts.length) return ''
    let s = `M${pts[0][0]},${pts[0][1]}`
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx1 = x0 + (x1 - x0) / 2
      s += ` C${cx1},${y0} ${cx1},${y1} ${x1},${y1}`
    }
    return s
  }, [data]) // eslint-disable-line
  const area = path ? `${path} L${pts[pts.length - 1][0]},${H - 24} L${pts[0][0]},${H - 24} Z` : ''
  const gid = useMemo(() => 'g' + Math.random().toString(36).slice(2, 7), [])
  const hi = hover ?? (highlightLast ? data.length - 1 : null)
  const step = Math.ceil(data.length / 8)
  return (
    <div className="relative select-none" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height }}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".32" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map(k => <line key={k} x1="0" x2={W} y1={(H - 24) * k} y2={(H - 24) * k} stroke="var(--line)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />)}
        <motion.path key={data.length + 'a'} d={area} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .6 }} />
        <motion.path key={data.length + 'l'} d={path} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" initial={{ pathLength: 0 } as any} animate={{ pathLength: 1 } as any} transition={{ duration: .9, ease: [.16, 1, .3, 1] }} />
        {hi !== null && pts[hi] && <line x1={pts[hi][0]} x2={pts[hi][0]} y1="0" y2={H - 24} stroke="var(--line-2)" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hi !== null && pts[hi] && (
        <>
          <span className="absolute size-3 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${(pts[hi][0] / W) * 100}%`, top: pts[hi][1], background: color, boxShadow: '0 0 0 4px color-mix(in oklab, var(--accent) 25%, transparent)' }} />
          <div className="absolute -translate-x-1/2 pointer-events-none rounded-xl px-2.5 py-1.5 text-[12px] whitespace-nowrap" style={{ left: `clamp(60px, ${(pts[hi][0] / W) * 100}%, calc(100% - 60px))`, top: Math.max(0, pts[hi][1] - 52), background: 'var(--ink)', color: 'var(--bg)' }}>
            <b className="num">{format(data[hi].value)}</b><div className="opacity-70">{data[hi].sub ?? data[hi].label}</div>
          </div>
        </>
      )}
      <div className="absolute inset-0 flex" style={{ bottom: 24 }}>
        {data.map((_, i) => <div key={i} className="flex-1" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />)}
      </div>
      <div className="flex justify-between text-[11px] -mt-5 px-1" style={{ color: 'var(--faint)' }}>
        {data.map((d, i) => <span key={i} className={cx('flex-1 text-center truncate', i % step !== 0 && 'invisible')}>{d.label}</span>)}
      </div>
    </div>
  )
}

export function Bars({ items, format = compact }: { items: { label: string; value: number; color?: string; sub?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => (
        <div key={it.label} className="grid grid-cols-[minmax(70px,auto)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate">{it.label}</span>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--card-2)' }}>
            <motion.div className="h-full rounded-full" style={{ background: it.color ?? 'var(--accent)' }} initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }} transition={{ delay: .1 + i * .05, duration: .8, ease: [.16, 1, .3, 1] }} />
          </div>
          <span className="num text-right min-w-[3ch]" style={{ color: 'var(--ink-2)' }}>{format(it.value)}{it.sub && <span style={{ color: 'var(--muted)' }}> {it.sub}</span>}</span>
        </div>
      ))}
    </div>
  )
}

export function Ring({ value, size = 64, stroke = 7, color = 'var(--accent)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-3)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }} transition={{ duration: 1, ease: [.16, 1, .3, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[12px] font-semibold num">{children}</div>
    </div>
  )
}

export function Spark({ values, color = 'var(--accent)', w = 90, h = 28 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(1, ...values)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i * w) / Math.max(1, values.length - 1)},${h - 2 - (v / max) * (h - 4)}`).join(' ')
  return <svg width={w} height={h} className="overflow-visible"><path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
