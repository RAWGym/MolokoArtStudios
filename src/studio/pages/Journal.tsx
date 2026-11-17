import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { History, PlusCircle, Wallet, CheckCircle2, Ban, MoveRight, Trash2, RefreshCw, Lock, Globe } from 'lucide-react'
import { useStudio } from '../store'
import { useUI } from '../ui'
import { PageHead } from '../common'
import { Empty, cx } from '../../ui/kit'
import { dLabel, pad, ymd } from '../../lib/format'

const ACT: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  'create:new': { label: 'Новая бронь', icon: PlusCircle, tone: 'var(--warn)' },
  'create:paid': { label: 'Бронь с оплатой', icon: PlusCircle, tone: 'var(--accent)' },
  'create:block': { label: 'Зал закрыт', icon: Lock, tone: 'var(--muted)' },
  'status:paid': { label: 'Оплата получена', icon: Wallet, tone: 'var(--accent)' },
  'status:done': { label: 'Съёмка завершена', icon: CheckCircle2, tone: 'var(--good)' },
  'status:cancelled': { label: 'Отмена', icon: Ban, tone: 'var(--bad)' },
  'status:new': { label: 'Возвращена в ожидание', icon: RefreshCw, tone: 'var(--warn)' },
  move: { label: 'Перенос или изменение', icon: MoveRight, tone: 'var(--info)' },
  delete: { label: 'Удалена', icon: Trash2, tone: 'var(--bad)' },
}

export default function Journal() {
  const { audit, staff, bookings, loadAudit } = useStudio()
  const { openBooking } = useUI()
  const [loading, setLoading] = useState(true)
  const [who, setWho] = useState('all')
  useEffect(() => { loadAudit().finally(() => setLoading(false)) }, []) // eslint-disable-line
  const name = (id: string | null) => id ? staff.find(s => s.userId === id)?.name ?? 'Сотрудник' : 'Клиент через сайт'
  const groups = useMemo(() => {
    const m = new Map<string, typeof audit>()
    for (const a of audit.filter(a => who === 'all' || (who === 'site' ? !a.actor : a.actor === who))) { const d = ymd(new Date(a.at)); m.set(d, [...(m.get(d) ?? []), a]) }
    return [...m.entries()]
  }, [audit, who])

  return (
    <>
      <PageHead title="Журнал" sub="Кто и когда создавал, оплачивал, переносил и отменял брони. Последние 300 действий."
        actions={<button className="btn btn-line h-10" onClick={() => { setLoading(true); loadAudit().finally(() => setLoading(false)) }}><RefreshCw className={cx('size-4', loading && 'animate-spin')} />Обновить</button>} />
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4">
        <button className="chip" aria-pressed={who === 'all'} onClick={() => setWho('all')}>Все</button>
        <button className="chip" aria-pressed={who === 'site'} onClick={() => setWho('site')}><Globe className="size-3.5" />Сайт</button>
        {staff.map(s => <button key={s.userId} className="chip" aria-pressed={who === s.userId} onClick={() => setWho(s.userId)}>{s.name}</button>)}
      </div>
      {loading && !audit.length ? <div className="flex flex-col gap-2">{[0, 1, 2, 3].map(i => <div key={i} className="skel h-16" />)}</div>
        : groups.length ? groups.map(([d, list]) => (
          <section key={d} className="mb-5">
            <div className="eyebrow mb-2 px-1">{dLabel(d)}</div>
            <div className="glass overflow-hidden">
              {list.map((a, i) => {
                const meta = ACT[a.action] ?? { label: a.action, icon: History, tone: 'var(--muted)' }
                const exists = a.bookingId && bookings.some(b => b.id === a.bookingId)
                const t = new Date(a.at)
                return (
                  <motion.button key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 10) * .02 }} disabled={!exists} onClick={() => exists && openBooking(a.bookingId!)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b hairline last:border-0 text-left enabled:hover:bg-[var(--card-2)] transition-colors">
                    <span className="size-9 rounded-full grid place-items-center shrink-0" style={{ background: `color-mix(in oklab, ${meta.tone} 14%, transparent)`, color: meta.tone }}><meta.icon className="size-4" /></span>
                    <span className="flex-1 min-w-0"><span className="block text-[14px]">{meta.label}</span><span className="block text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{a.summary}</span></span>
                    <span className="text-right shrink-0"><span className="block text-[12.5px] num">{pad(t.getHours())}:{pad(t.getMinutes())}</span><span className="block text-[11.5px]" style={{ color: 'var(--faint)' }}>{name(a.actor)}</span></span>
                  </motion.button>
                )
              })}
            </div>
          </section>
        )) : <div className="glass"><Empty icon={<History className="size-6" />} title="Журнал пуст" text="Действия с бронями появятся здесь автоматически." /></div>}
    </>
  )
}
