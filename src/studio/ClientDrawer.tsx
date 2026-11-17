import { useState } from 'react'
import { X, Phone, MessageCircle, CalendarPlus, Gift, Plus, Minus, Ban, Cake, Save } from 'lucide-react'
import { useStudio } from './store'
import { useUI } from './ui'
import { useClient, levelTone, revenueOf } from './derive'
import { Ring } from './common'
import { hallById } from '../lib/catalog'
import { Drawer, StatusPill, Switch, Field, Segmented, Empty, toast, cx } from '../ui/kit'
import { money, num, fmtPhone, waLink, dShort, timeRange, relTime, hoursLabel } from '../lib/format'
import { fail } from './msg'
import type { Client } from './derive'

export function ClientDrawer() {
  const { clientPhone, openClient } = useUI()
  const c = useClient(clientPhone)
  return <Drawer open={!!c} onClose={() => openClient(null)} width={520}>{c && <Body key={c.phone} c={c} />}</Drawer>
}

const KIND: Record<string, string> = { accrual: 'Начислено за съёмку', redeem: 'Списано в оплату', manual: 'Вручную', welcome: 'Приветственные' }

function Body({ c }: { c: Client }) {
  const { me, tx, S, staff, upsertClient, addBonus } = useStudio()
  const { openClient, openBooking, newBooking } = useUI()
  const owner = me?.role === 'owner'
  const [tab, setTab] = useState<'visits' | 'bonus' | 'profile'>('visits')
  const [p, setP] = useState({ name: c.name, note: c.note, tags: c.tags.join(', '), birthday: c.birthday ?? '', blocked: c.blocked })
  const [amt, setAmt] = useState(0), [sign, setSign] = useState<1 | -1>(1), [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const ledger = tx.filter(t => t.phone === c.phone).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const who = (id?: string | null) => staff.find(s => s.userId === id)?.name
  const tone = levelTone(c.level.id)
  const basisLeft = c.nextLevel ? (S.loyalty.basis === 'spent' ? money(c.nextLevel.from - c.spent) : hoursLabel(Math.ceil(c.nextLevel.from - c.hours))) : ''

  const saveProfile = async () => {
    setBusy(true)
    try { await upsertClient(c.phone, { name: p.name.trim(), note: p.note, tags: p.tags.split(',').map(t => t.trim()).filter(Boolean), birthday: p.birthday || null, blocked: p.blocked }); toast('Карточка клиента сохранена') }
    catch (e) { fail(e) } finally { setBusy(false) }
  }
  const adjust = async () => {
    if (!amt) return
    if (sign < 0 && amt > c.balance) { toast(`На счёте только ${num(c.balance)} бонусов`, 'err'); return }
    setBusy(true)
    try { await addBonus(c.phone, sign * amt, note.trim() || (sign > 0 ? 'Начисление' : 'Списание')); toast(sign > 0 ? `Начислено ${num(amt)} бонусов` : `Списано ${num(amt)} бонусов`); setAmt(0); setNote('') }
    catch (e) { fail(e) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="relative p-5 pb-4 safe-t" style={{ background: `radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, ${tone} 22%, transparent), transparent 70%)` }}>
        <button className="icon-btn absolute right-4 top-4" onClick={() => openClient(null)} aria-label="Закрыть"><X className="size-4" /></button>
        <div className="flex items-center gap-4 pr-12">
          <Ring value={c.progress} size={68} stroke={5} color={tone}>
            <span className="size-[50px] rounded-full grid place-items-center font-display text-[18px]" style={{ background: tone, color: '#1a1714' }}>{(c.name || '?')[0]}</span>
          </Ring>
          <div className="min-w-0">
            <div className="font-display text-[21px] leading-tight truncate">{c.name || 'Без имени'}</div>
            <div className="text-[13.5px] mt-0.5 num" style={{ color: 'var(--muted)' }}>{fmtPhone(c.phone)}</div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="pill" style={{ color: tone, background: `color-mix(in oklab, ${tone} 16%, transparent)` }}>{c.level.name} · {c.level.pct}%</span>
              {c.blocked && <span className="pill" style={{ color: 'var(--bad)', background: 'color-mix(in oklab, var(--bad) 14%, transparent)' }}>чёрный список</span>}
              {c.tags.map(t => <span key={t} className="pill pill-block">{t}</span>)}
            </div>
          </div>
        </div>
        {c.nextLevel && <div className="text-[12.5px] mt-3" style={{ color: 'var(--muted)' }}>До уровня {c.nextLevel.name} ({c.nextLevel.pct}%) — {basisLeft}</div>}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <Stat k="Визитов" v={num(c.visits)} />
          <Stat k="Часов" v={num(c.hours)} />
          <Stat k="Потратил" v={owner ? compactMoney(c.spent) : '—'} />
          <Stat k="Бонусов" v={num(c.balance)} tone="var(--gold)" />
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary h-11 flex-1" onClick={() => { openClient(null); newBooking({ name: c.name, phone: c.phone }) }}><CalendarPlus className="size-4" />Записать</button>
          <a className="btn btn-line h-11 px-4" href={`tel:+${c.phone}`}><Phone className="size-4" /></a>
          <a className="btn btn-line h-11 px-4" href={waLink(c.phone, `Здравствуйте, ${c.name.split(' ')[0]}!`)} target="_blank" rel="noopener"><MessageCircle className="size-4" /></a>
        </div>
      </div>

      <div className="px-5 pt-1"><Segmented value={tab} onChange={setTab} items={[['visits', `Съёмки · ${c.bookings.length}`], ['bonus', 'Бонусы'], ['profile', 'Профиль']]} /></div>

      <div className="p-5 flex flex-col gap-3">
        {tab === 'visits' && (c.bookings.length ? c.bookings.map(b => (
          <button key={b.id} onClick={() => { openClient(null); openBooking(b.id) }} className="flex items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-[var(--card-3)] transition-colors" style={{ background: 'var(--card-2)' }}>
            <img src={hallById(b.hall).img} alt="" className="size-12 rounded-xl object-cover shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium">{dShort(b.date)} · {timeRange(b.start, b.hours)}</span>
              <span className="block text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{hallById(b.hall).name} · {b.kind || 'Съёмка'}{owner ? ` · ${money(revenueOf(b) || b.total)}` : ''}</span>
            </span>
            <StatusPill s={b.status} />
          </button>
        )) : <Empty title="Пока нет съёмок" />)}

        {tab === 'bonus' && <>
          <div className="rounded-2xl p-4" style={{ background: 'var(--gold-soft)' }}>
            <div className="flex items-baseline justify-between"><span className="text-[13px]" style={{ color: 'var(--muted)' }}>Баланс</span><span className="text-[12px]" style={{ color: 'var(--muted)' }}>начислено {num(c.accrued)} · списано {num(c.redeemed)}</span></div>
            <div className="font-display text-[34px] leading-none mt-2 num" style={{ color: 'var(--gold)' }}>{num(c.balance)}</div>
            <div className="text-[12.5px] mt-1.5" style={{ color: 'var(--muted)' }}>1 бонус = 1 ₸ · можно оплатить до {S.loyalty.maxRedeemPct}% брони</div>
          </div>
          <div className="rounded-2xl p-4 flex flex-col gap-3 border hairline">
            <div className="font-medium text-[14.5px]">Начислить или списать вручную</div>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <div className="flex rounded-[14px] p-1 gap-1" style={{ background: 'var(--card-2)' }}>
                <button className={cx('size-10 grid place-items-center rounded-[10px]', sign > 0 && 'bg-[var(--good)] text-white')} onClick={() => setSign(1)} aria-label="Начислить"><Plus className="size-4" /></button>
                <button className={cx('size-10 grid place-items-center rounded-[10px]', sign < 0 && 'bg-[var(--bad)] text-white')} onClick={() => setSign(-1)} aria-label="Списать"><Minus className="size-4" /></button>
              </div>
              <input className="field num" inputMode="numeric" placeholder="Сумма бонусов" value={amt ? num(amt) : ''} onChange={e => setAmt(+e.target.value.replace(/\D/g, '') || 0)} />
            </div>
            <div className="flex flex-wrap gap-1.5">{[500, 1000, 2000, 5000].map(v => <button key={v} className="chip" onClick={() => setAmt(v)}>{num(v)}</button>)}</div>
            <input className="field" placeholder="Комментарий: подарок на день рождения, компенсация…" value={note} onChange={e => setNote(e.target.value)} />
            <button className="btn btn-primary h-11" disabled={busy || !amt} onClick={adjust}><Gift className="size-4" />{sign > 0 ? 'Начислить' : 'Списать'}{amt ? ` ${num(amt)}` : ''}</button>
          </div>
          <div className="flex flex-col">
            {ledger.length ? ledger.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 border-b hairline last:border-0">
                <span className="size-9 rounded-full grid place-items-center shrink-0" style={{ background: t.amount > 0 ? 'var(--gold-soft)' : 'var(--card-2)', color: t.amount > 0 ? 'var(--gold)' : 'var(--muted)' }}>{t.amount > 0 ? <Plus className="size-4" /> : <Minus className="size-4" />}</span>
                <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{t.note || KIND[t.kind]}</span><span className="block text-[12px]" style={{ color: 'var(--muted)' }}>{KIND[t.kind]} · {relTime(t.createdAt)}{who(t.createdBy) ? ` · ${who(t.createdBy)}` : ''}</span></span>
                <span className="num font-semibold" style={{ color: t.amount > 0 ? 'var(--gold)' : 'var(--ink-2)' }}>{t.amount > 0 ? '+' : ''}{num(t.amount)}</span>
              </div>
            )) : <Empty icon={<Gift className="size-6" />} title="Бонусов пока нет" text={`Начисляются автоматически после каждой завершённой съёмки: ${S.loyalty.levels.map(l => `${l.name} ${l.pct}%`).join(', ')}.`} />}
          </div>
        </>}

        {tab === 'profile' && <>
          <Field label="Имя"><input className="field" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="День рождения"><div className="relative"><Cake className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} /><input type="date" className="field !pl-10" value={p.birthday} onChange={e => setP({ ...p, birthday: e.target.value })} /></div></Field>
            <Field label="Теги" hint="через запятую"><input className="field" value={p.tags} onChange={e => setP({ ...p, tags: e.target.value })} placeholder="фотограф, VIP" /></Field>
          </div>
          <Field label="Заметка"><textarea className="field" rows={3} value={p.note} onChange={e => setP({ ...p, note: e.target.value })} placeholder="Любит зал BEIGE, всегда опаздывает на 10 минут…" /></Field>
          <div className="flex items-center justify-between gap-3 rounded-2xl p-3.5" style={{ background: 'var(--card-2)' }}>
            <span className="flex items-center gap-2.5 text-[14px]"><Ban className="size-4" style={{ color: 'var(--bad)' }} />Чёрный список<span className="text-[12px]" style={{ color: 'var(--muted)' }}>виджет не примет бронь</span></span>
            <Switch on={p.blocked} onChange={v => setP({ ...p, blocked: v })} />
          </div>
          <button className="btn btn-primary h-11" disabled={busy} onClick={saveProfile}><Save className="size-4" />Сохранить</button>
          {c.firstAt && <div className="text-[12px] text-center" style={{ color: 'var(--faint)' }}>Клиент с {dShort(c.firstAt)}</div>}
        </>}
      </div>
    </div>
  )
}

const compactMoney = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')}м` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : num(n)

function Stat({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return <div className="rounded-2xl p-2.5 text-center" style={{ background: 'var(--card-2)' }}><div className="font-display text-[17px] num" style={{ color: tone }}>{v}</div><div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{k}</div></div>
}
