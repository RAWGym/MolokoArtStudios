import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, UserPlus, Users, Ban } from 'lucide-react'
import { useStudio } from '../store'
import { can } from '../perm'
import { useUI } from '../ui'
import { useClients, levelTone } from '../derive'
import { PageHead } from '../common'
import { Sheet, Field, Empty, cx, toast } from '../../ui/kit'
import { num, fmtPhone, dShort, maskPhone, normPhone, compact } from '../../lib/format'
import { fail } from '../msg'

type Sort = 'recent' | 'visits' | 'spent' | 'balance'

export default function Clients() {
  const { me, S, upsertClient } = useStudio()
  const { openClient } = useUI()
  const all = useClients()
  const owner = can(me?.role, 'seeMoney')
  const [q, setQ] = useState('')
  const [lvl, setLvl] = useState('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [add, setAdd] = useState(false)
  const [n, setN] = useState(''), [p, setP] = useState('')

  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), d = s.replace(/\D/g, '')
    const r = all.filter(c => (lvl === 'all' || (lvl === 'blocked' ? c.blocked : c.level.id === lvl))
      && (!s || c.name.toLowerCase().includes(s) || (d.length >= 3 && c.phone.includes(d)) || c.tags.some(t => t.toLowerCase().includes(s))))
    const key: Record<Sort, (c: typeof r[number]) => number | string> = {
      recent: c => (c.next ? '2' + c.next.date : '1' + (c.last ?? c.firstAt ?? '')), visits: c => c.visits, spent: c => c.spent, balance: c => c.balance,
    }
    return r.sort((a, b) => { const x = key[sort](a), y = key[sort](b); return x < y ? 1 : x > y ? -1 : 0 })
  }, [all, q, lvl, sort])

  const byLevel = (id: string) => all.filter(c => c.level.id === id).length

  const create = async () => {
    const ph = normPhone(p)
    if (ph.length !== 11) { toast('Проверьте номер телефона', 'err'); return }
    try { await upsertClient(ph, { name: n.trim() }); toast('Клиент добавлен'); setAdd(false); setN(''); setP(''); openClient(ph) } catch (e) { fail(e) }
  }

  return (
    <>
      <PageHead title="Клиенты" sub={`${num(all.length)} в базе · бонусы копятся по номеру телефона`} actions={<button className="btn btn-line h-10" onClick={() => setAdd(true)}><UserPlus className="size-4" />Добавить</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {S.loyalty.levels.map((l, i) => (
          <motion.button key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }} onClick={() => setLvl(lvl === l.id ? 'all' : l.id)}
            className={cx('glass p-4 text-left transition-shadow', lvl === l.id && 'ring-2 ring-[var(--accent)]')}>
            <div className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: levelTone(l.id) }} /><span className="font-semibold text-[14px]">{l.name}</span><span className="ml-auto text-[12px]" style={{ color: 'var(--muted)' }}>{l.pct}%</span></div>
            <div className="font-display text-[26px] mt-2 num">{byLevel(l.id)}</div>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>от {l.from} {S.loyalty.basis === 'spent' ? '₸' : 'ч'}</div>
          </motion.button>
        ))}
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }} onClick={() => setLvl(lvl === 'blocked' ? 'all' : 'blocked')} className={cx('glass p-4 text-left', lvl === 'blocked' && 'ring-2 ring-[var(--bad)]')}>
          <div className="flex items-center gap-2"><Ban className="size-3.5" style={{ color: 'var(--bad)' }} /><span className="font-semibold text-[14px]">Чёрный список</span></div>
          <div className="font-display text-[26px] mt-2 num">{all.filter(c => c.blocked).length}</div>
          <div className="text-[12px]" style={{ color: 'var(--muted)' }}>не могут бронировать</div>
        </motion.button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 absolute z-10 left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input className="field !h-11 !pl-10 glass !rounded-full" value={q} onChange={e => setQ(e.target.value)} placeholder="Имя, телефон или тег" />
        </div>
        <select className="field !h-11 !w-auto glass !rounded-full !text-[14px]" value={sort} onChange={e => setSort(e.target.value as Sort)}>
          <option value="recent">Сначала активные</option><option value="visits">По визитам</option>{owner && <option value="spent">По сумме</option>}<option value="balance">По бонусам</option>
        </select>
      </div>

      <div className="glass overflow-hidden">
        {list.length ? list.slice(0, 400).map((c, i) => (
          <motion.button key={c.phone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * .02 }} onClick={() => openClient(c.phone)}
            className="w-full grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1.4fr_1fr_90px_90px_110px] items-center gap-3 md:gap-4 px-4 py-3 border-b hairline last:border-0 text-left hover:bg-[var(--card-2)] transition-colors">
            <span className="size-10 rounded-full grid place-items-center font-semibold" style={{ background: levelTone(c.level.id), color: '#1a1714', opacity: c.blocked ? .4 : 1 }}>{(c.name || '?')[0]}</span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium truncate" style={{ textDecoration: c.blocked ? 'line-through' : undefined }}>{c.name || 'Без имени'}</span>
              <span className="block text-[12.5px] num truncate" style={{ color: 'var(--muted)' }}>{fmtPhone(c.phone)}<span className="md:hidden"> · {c.visits} виз.</span></span>
            </span>
            <span className="hidden md:block text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{c.next ? <span style={{ color: 'var(--accent)' }}>запись {dShort(c.next.date)}</span> : c.last ? `был ${dShort(c.last)}` : 'ещё не был'}{c.tags.length ? ` · ${c.tags.join(', ')}` : ''}</span>
            <span className="hidden md:block text-[13px] num text-right">{c.visits} <span style={{ color: 'var(--muted)' }}>виз.</span></span>
            <span className="hidden md:block text-[13px] num text-right">{owner ? `${compact(c.spent)} ₸` : `${c.hours} ч`}</span>
            <span className="text-[13px] num text-right font-medium" style={{ color: c.balance ? 'var(--gold)' : 'var(--faint)' }}>{num(c.balance)} <span className="text-[11px] font-normal">бон.</span></span>
          </motion.button>
        )) : <Empty icon={<Users className="size-6" />} title={all.length ? 'Никого не нашли' : 'Клиентов пока нет'} text={all.length ? undefined : 'Клиенты появляются автоматически после первой брони.'} />}
      </div>

      <Sheet open={add} onClose={() => setAdd(false)} title="Новый клиент">
        <div className="flex flex-col gap-4 pt-1">
          <Field label="Имя"><input className="field" value={n} onChange={e => setN(e.target.value)} placeholder="Айгерим" /></Field>
          <Field label="Телефон"><input className="field num" inputMode="tel" value={p} onChange={e => setP(maskPhone(e.target.value))} placeholder="+7 (7__) ___-__-__" /></Field>
          <button className="btn btn-primary h-12" disabled={!n.trim() || normPhone(p).length !== 11} onClick={create}>Добавить клиента</button>
        </div>
      </Sheet>
    </>
  )
}
