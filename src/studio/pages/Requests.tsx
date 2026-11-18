import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, Check, X, Pencil, Ban, Trash2, Undo2, HelpCircle } from 'lucide-react'
import { useStudio } from '../store'
import { useUI } from '../ui'
import { PageHead } from '../common'
import { Empty, Segmented, Avatar, toast } from '../../ui/kit'
import { hallById } from '../../lib/catalog'
import { dLabel, timeRange, relTime } from '../../lib/format'
import { fail } from '../msg'
import type { RequestRow } from '../../lib/types'

const KIND: Record<RequestRow['kind'], { label: string; icon: typeof Pencil; tone: string }> = {
  edit: { label: 'Изменить бронь', icon: Pencil, tone: 'var(--info)' },
  cancel: { label: 'Отменить бронь', icon: Ban, tone: 'var(--warn)' },
  delete: { label: 'Удалить бронь', icon: Trash2, tone: 'var(--bad)' },
  refund: { label: 'Вернуть деньги', icon: Undo2, tone: 'var(--gold)' },
  other: { label: 'Другое', icon: HelpCircle, tone: 'var(--muted)' },
}

export default function Requests() {
  const { requests, staff, bookings, me, decide } = useStudio()
  const { openBooking } = useUI()
  const owner = me?.role === 'owner'
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [answer, setAnswer] = useState<Record<string, string>>({})
  const list = requests.filter(r => tab === 'pending' ? r.status === 'pending' : r.status !== 'pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const who = (id: string | null) => staff.find(s => s.userId === id)?.name ?? 'Сотрудник'

  const act = async (r: RequestRow, ok: boolean) => {
    setBusy(r.id)
    try {
      await decide(r.id, ok, answer[r.id] ?? '')
      toast(ok ? (r.kind === 'edit' || r.kind === 'refund' ? 'Одобрено. Внесите изменения в брони' : 'Одобрено и выполнено') : 'Запрос отклонён')
      if (ok && (r.kind === 'edit' || r.kind === 'refund') && r.bookingId) openBooking(r.bookingId)
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  return (
    <>
      <PageHead title="Запросы" sub={owner ? 'Администраторы не меняют старые брони и не удаляют записи сами — они присылают запрос сюда.' : 'Ваши запросы владельцу и его ответы.'}
        actions={<Segmented value={tab} onChange={setTab} items={[['pending', `Ждут · ${requests.filter(r => r.status === 'pending').length}`], ['done', 'Решённые']]} />} />
      {list.length ? (
        <div className="grid lg:grid-cols-2 2xl:grid-cols-3 gap-3 md:gap-4">
          <AnimatePresence initial={false}>
            {list.map(r => {
              const k = KIND[r.kind]; const b = bookings.find(x => x.id === r.bookingId)
              return (
                <motion.div key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }} className="glass p-4 md:p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="size-10 rounded-xl grid place-items-center" style={{ background: `color-mix(in oklab, ${k.tone} 15%, transparent)`, color: k.tone }}><k.icon className="size-[18px]" /></span>
                    <div className="flex-1 min-w-0"><div className="font-semibold">{k.label}</div><div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{who(r.createdBy)} · {relTime(r.createdAt)}</div></div>
                    {r.status !== 'pending' && <span className="pill" style={r.status === 'approved' ? { color: 'var(--good)', background: 'color-mix(in oklab, var(--good) 14%, transparent)' } : { color: 'var(--bad)', background: 'color-mix(in oklab, var(--bad) 12%, transparent)' }}>{r.status === 'approved' ? 'одобрено' : 'отклонено'}</span>}
                  </div>
                  {b ? (
                    <button onClick={() => openBooking(b.id)} className="flex items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-[var(--card-3)]" style={{ background: 'var(--card-2)' }}>
                      <img src={hallById(b.hall).img} alt="" className="size-11 rounded-xl object-cover" />
                      <span className="min-w-0"><span className="block text-[14px] font-medium truncate">{b.name}</span><span className="block text-[12px]" style={{ color: 'var(--muted)' }}>{hallById(b.hall).name} · {dLabel(b.date, false)} · {timeRange(b.start, b.hours)}</span></span>
                    </button>
                  ) : r.bookingId ? <div className="text-[13px]" style={{ color: 'var(--faint)' }}>Бронь уже удалена</div> : null}
                  {r.note && <div className="text-[14px] whitespace-pre-wrap" style={{ color: 'var(--ink-2)' }}>«{r.note}»</div>}
                  {r.answer && <div className="flex items-start gap-2 text-[13px]" style={{ color: 'var(--muted)' }}><Avatar name={who(r.decidedBy)} size={22} />{r.answer}</div>}
                  {owner && r.status === 'pending' && <>
                    <input className="field !h-11 !text-[14px]" placeholder="Ответ (необязательно)" value={answer[r.id] ?? ''} onChange={e => setAnswer({ ...answer, [r.id]: e.target.value })} />
                    <div className="flex gap-2">
                      <button className="btn btn-line flex-1" disabled={busy === r.id} onClick={() => act(r, false)}><X className="size-4" />Отклонить</button>
                      <button className="btn btn-primary flex-[1.4]" disabled={busy === r.id} onClick={() => act(r, true)}><Check className="size-4" />{r.kind === 'delete' ? 'Удалить' : r.kind === 'cancel' ? 'Отменить бронь' : 'Одобрить'}</button>
                    </div>
                  </>}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      ) : <div className="glass"><Empty icon={<Inbox className="size-6" />} title={tab === 'pending' ? 'Новых запросов нет' : 'Пока пусто'} text={tab === 'pending' ? 'Когда администратору понадобится изменить старую бронь или удалить запись, запрос появится здесь.' : undefined} /></div>}
    </>
  )
}
