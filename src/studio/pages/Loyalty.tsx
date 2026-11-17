import { useMemo, useState } from 'react'
import { Gift, Plus, Trash2, Save, Coins, ArrowDownRight, ArrowUpRight, Users } from 'lucide-react'
import { useStudio } from '../store'
import { useUI } from '../ui'
import { useClients, levelTone } from '../derive'
import { Card, PageHead, Kpi } from '../common'
import { Switch, Segmented, toast } from '../../ui/kit'
import { num, relTime, fmtPhone } from '../../lib/format'
import { fail } from '../msg'
import type { Settings, LoyaltyLevel } from '../../lib/types'

const KIND: Record<string, string> = { accrual: 'за съёмку', redeem: 'оплата бонусами', manual: 'вручную', welcome: 'приветственные' }

export default function Loyalty() {
  const { S, tx, staff, saveSettings } = useStudio()
  const { openClient } = useUI()
  const clients = useClients()
  const [L, setL] = useState<Settings['loyalty']>(() => structuredClone(S.loyalty))
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(L) !== JSON.stringify(S.loyalty)
  const setLv = (i: number, p: Partial<LoyaltyLevel>) => setL(x => ({ ...x, levels: x.levels.map((l, j) => j === i ? { ...l, ...p } : l) }))

  const outstanding = clients.reduce((s, c) => s + Math.max(0, c.balance), 0)
  const accrued = tx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const redeemed = -tx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
  const holders = clients.filter(c => c.balance > 0).length
  const feed = useMemo(() => [...tx].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40), [tx])
  const nameOf = (p: string) => clients.find(c => c.phone === p)?.name || fmtPhone(p)

  const save = async () => {
    const levels = [...L.levels].map(l => ({ ...l, name: l.name.trim() || 'Уровень', pct: Math.max(0, Math.min(50, +l.pct || 0)), from: Math.max(0, +l.from || 0) })).sort((a, b) => a.from - b.from)
    levels[0].from = 0
    setBusy(true)
    try { await saveSettings({ ...S, loyalty: { ...L, levels, maxRedeemPct: Math.max(0, Math.min(100, +L.maxRedeemPct || 0)) } }); setL(x => ({ ...x, levels })); toast('Бонусная программа обновлена') }
    catch (e) { fail(e) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHead title="Клуб Moloko" sub="Бонусы копятся по номеру телефона автоматически после каждой завершённой съёмки. 1 бонус = 1 ₸."
        actions={dirty && <button className="btn btn-primary h-10" disabled={busy} onClick={save}><Save className="size-4" />Сохранить</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi label="На счетах клиентов" value={outstanding} format={num} tone="var(--gold)" icon={<Coins className="size-4" />} sub="бонусов можно потратить" />
        <Kpi label="Участников с бонусами" value={holders} format={num} icon={<Users className="size-4" />} sub={`из ${clients.length} клиентов`} delay={.05} />
        <Kpi label="Начислено всего" value={accrued} format={num} icon={<ArrowUpRight className="size-4" />} delay={.1} />
        <Kpi label="Потрачено всего" value={redeemed} format={num} icon={<ArrowDownRight className="size-4" />} delay={.15} />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-3 md:gap-4 mt-3 md:mt-4 items-start">
        <Card title="Правила программы" delay={.1} action={<Switch on={L.enabled} onChange={v => setL({ ...L, enabled: v })} label="Программа включена" />}>
          <div className="flex flex-col gap-5" style={{ opacity: L.enabled ? 1 : .5 }}>
            <div>
              <span className="label">Уровень растёт за</span>
              <Segmented value={L.basis} onChange={v => setL({ ...L, basis: v })} items={[['hours', 'часы съёмок'], ['spent', 'потраченные деньги']]} />
            </div>
            <div>
              <span className="label">Уровни и кэшбэк</span>
              <div className="flex flex-col gap-2">
                {L.levels.map((l, i) => (
                  <div key={i} className="grid grid-cols-[14px_1fr_84px_110px_36px] items-center gap-2">
                    <span className="size-3.5 rounded-full" style={{ background: levelTone(l.id) }} />
                    <input className="field !h-11" value={l.name} onChange={e => setLv(i, { name: e.target.value })} aria-label="Название" />
                    <div className="relative"><input className="field !h-11 num pr-7" inputMode="numeric" value={l.pct} onChange={e => setLv(i, { pct: +e.target.value.replace(/[^\d]/g, '') || 0 })} aria-label="Процент" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: 'var(--muted)' }}>%</span></div>
                    <div className="relative"><input className="field !h-11 num pr-8" inputMode="numeric" disabled={i === 0} value={i === 0 ? 0 : l.from} onChange={e => setLv(i, { from: +e.target.value.replace(/\D/g, '') || 0 })} aria-label="Порог" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--muted)' }}>{L.basis === 'spent' ? '₸' : 'ч'}</span></div>
                    <button className="icon-btn !size-9" disabled={L.levels.length <= 1} onClick={() => setL({ ...L, levels: L.levels.filter((_, j) => j !== i) })} aria-label="Удалить уровень"><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>название · кэшбэк · порог входа</span>
                {L.levels.length < 5 && <button className="btn btn-ghost btn-sm" onClick={() => setL({ ...L, levels: [...L.levels, { id: 'lvl' + Date.now().toString(36), name: 'Platinum', pct: 10, from: (L.levels[L.levels.length - 1]?.from ?? 0) * 2 || 100 }] })}><Plus className="size-4" />Уровень</button>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Оплата бонусами, до % брони</span><input className="field num" inputMode="numeric" value={L.maxRedeemPct} onChange={e => setL({ ...L, maxRedeemPct: +e.target.value.replace(/\D/g, '') || 0 })} /></label>
              <label><span className="label">Приветственные бонусы</span><input className="field num" inputMode="numeric" value={L.welcome || ''} placeholder="0" onChange={e => setL({ ...L, welcome: +e.target.value.replace(/\D/g, '') || 0 })} /></label>
            </div>
            <div className="rounded-2xl p-3.5 text-[13px] leading-relaxed" style={{ background: 'var(--gold-soft)', color: 'var(--ink-2)' }}>
              <Gift className="size-4 inline -mt-0.5 mr-1.5" style={{ color: 'var(--gold)' }} />
              Пример: съёмка на {num(40000)} ₸ у клиента уровня {L.levels[0]?.name} принесёт {num(Math.round(40000 * (L.levels[0]?.pct ?? 0) / 100))} бонусов. Списать в следующий раз можно до {num(Math.round(40000 * L.maxRedeemPct / 100))} ₸. Если съёмку отменят, бонусы вернутся автоматически.
            </div>
            {dirty && <button className="btn btn-primary h-11" disabled={busy} onClick={save}><Save className="size-4" />Сохранить правила</button>}
          </div>
        </Card>

        <Card title="Движение бонусов" delay={.15}>
          {feed.length ? <div className="flex flex-col max-h-[620px] overflow-y-auto thin-scroll -mx-2 px-2">{feed.map(t => (
            <button key={t.id} onClick={() => openClient(t.phone)} className="flex items-center gap-3 py-2.5 border-b hairline last:border-0 text-left">
              <span className="size-9 rounded-full grid place-items-center shrink-0" style={{ background: t.amount > 0 ? 'var(--gold-soft)' : 'var(--card-2)', color: t.amount > 0 ? 'var(--gold)' : 'var(--muted)' }}>{t.amount > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}</span>
              <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{nameOf(t.phone)}</span><span className="block text-[12px] truncate" style={{ color: 'var(--muted)' }}>{KIND[t.kind]}{t.note && t.kind === 'manual' ? `: ${t.note}` : ''} · {relTime(t.createdAt)}{t.createdBy ? ` · ${staff.find(s => s.userId === t.createdBy)?.name ?? ''}` : ''}</span></span>
              <span className="num text-[14px] font-semibold" style={{ color: t.amount > 0 ? 'var(--gold)' : 'var(--ink-2)' }}>{t.amount > 0 ? '+' : ''}{num(t.amount)}</span>
            </button>
          ))}</div> : <div className="text-[13.5px] py-10 text-center" style={{ color: 'var(--muted)' }}>Здесь появятся начисления и списания. Ручное начисление — в карточке клиента.</div>}
        </Card>
      </div>
    </>
  )
}
