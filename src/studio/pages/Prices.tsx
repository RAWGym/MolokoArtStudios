import { useState } from 'react'
import { Save, RotateCcw, Moon, Users, Sparkles } from 'lucide-react'
import { useStudio } from '../store'
import { Card, PageHead } from '../common'
import { HALLS, EQUIP, DEFAULT_SETTINGS, quote } from '../../lib/catalog'
import { toast } from '../../ui/kit'
import { money, num } from '../../lib/format'
import { fail } from '../msg'
import type { Settings } from '../../lib/types'

export default function Prices() {
  const { S, saveSettings } = useStudio()
  const [P, setP] = useState<Settings>(() => structuredClone(S))
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(P) !== JSON.stringify(S)
  const n = (v: string) => +v.replace(/\D/g, '') || 0
  const save = async () => { setBusy(true); try { await saveSettings(P); toast('Прайс обновлён — виджет уже показывает новые цены') } catch (e) { fail(e) } finally { setBusy(false) } }
  const ex = quote({ hall: 'beige', start: 19, hours: 3, guests: 8, equip: ['smoke'], confetti: true }, P)

  return (
    <>
      <PageHead title="Прайс" sub="Цены сразу применяются в виджете и при создании броней в CRM. Старые брони не пересчитываются."
        actions={<>
          <button className="btn btn-ghost h-10" onClick={() => setP({ ...structuredClone(DEFAULT_SETTINGS), loyalty: P.loyalty })}><RotateCcw className="size-4" />По умолчанию</button>
          <button className="btn btn-primary h-10" disabled={!dirty || busy} onClick={save}><Save className="size-4" />Сохранить</button>
        </>} />

      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 md:gap-4 items-start">
        <div className="flex flex-col gap-3 md:gap-4">
          <Card title="Залы, за час">
            <div className="grid sm:grid-cols-2 gap-3">
              {HALLS.map(h => (
                <label key={h.id} className="flex items-center gap-3 rounded-2xl p-2 pr-3" style={{ background: 'var(--card-2)' }}>
                  <img src={h.img} alt="" className="size-14 rounded-xl object-cover" />
                  <span className="flex-1 text-[14px] font-semibold tracking-[.06em]">{h.name}</span>
                  <Money value={P.halls[h.id] ?? 0} onChange={v => setP({ ...P, halls: { ...P.halls, [h.id]: v } })} />
                </label>
              ))}
            </div>
          </Card>
          <Card title="Доплаты">
            <div className="grid sm:grid-cols-2 gap-3">
              <Line icon={<Moon className="size-4" />} label="Ночной час" hint="с 21:00 до 9:00" value={P.night} set={v => setP({ ...P, night: v })} />
              <Line icon={<Sparkles className="size-4" />} label="Уборка конфетти" hint="за съёмку" value={P.confetti} set={v => setP({ ...P, confetti: v })} />
              <Line icon={<Users className="size-4" />} label="Гость сверх лимита" hint="за человека в час" value={P.guest} set={v => setP({ ...P, guest: v })} />
              <label className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--card-2)' }}>
                <Users className="size-4" style={{ color: 'var(--muted)' }} />
                <span className="flex-1 text-[14px]">Бесплатно гостей</span>
                <input className="field !h-10 !w-20 text-right num" inputMode="numeric" value={P.freeGuests} onChange={e => setP({ ...P, freeGuests: n(e.target.value) })} />
              </label>
            </div>
          </Card>
          <Card title="Оборудование, за час">
            <div className="grid sm:grid-cols-2 gap-2">
              {EQUIP.map(e => (
                <label key={e.id} className="flex items-center gap-3 py-1.5">
                  <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{e.n}</span>{'d' in e && e.d && <span className="block text-[11.5px]" style={{ color: 'var(--muted)' }}>{e.d}</span>}</span>
                  <Money value={P.equip[e.id] ?? 0} onChange={v => setP({ ...P, equip: { ...P.equip, [e.id]: v } })} small />
                </label>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Пример расчёта" className="lg:sticky lg:top-24">
          <div className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>BEIGE, 19:00–21:55, 8 гостей, дым и конфетти</div>
          <div className="flex flex-col gap-2">
            {ex.lines.map(([k, v]) => <div key={k} className="flex justify-between gap-3 text-[13.5px]"><span style={{ color: 'var(--ink-2)' }}>{k}</span><span className="num">{money(v)}</span></div>)}
          </div>
          <div className="flex justify-between items-baseline mt-3 pt-3 border-t hairline"><span className="font-semibold">Итого</span><span className="font-display text-[24px] num">{money(ex.total)}</span></div>
          {dirty && <button className="btn btn-primary h-11 w-full mt-4" disabled={busy} onClick={save}><Save className="size-4" />Сохранить прайс</button>}
        </Card>
      </div>
    </>
  )
}

function Money({ value, onChange, small }: { value: number; onChange: (v: number) => void; small?: boolean }) {
  return (
    <span className="relative shrink-0">
      <input className={`field !h-10 text-right num pr-7 ${small ? '!w-[104px]' : '!w-[120px]'}`} inputMode="numeric" value={value ? num(value) : ''} placeholder="0" onChange={e => onChange(+e.target.value.replace(/\D/g, '') || 0)} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none" style={{ color: 'var(--muted)' }}>₸</span>
    </span>
  )
}

function Line({ icon, label, hint, value, set }: { icon: React.ReactNode; label: string; hint: string; value: number; set: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--card-2)' }}>
      <span style={{ color: 'var(--muted)' }}>{icon}</span>
      <span className="flex-1 min-w-0"><span className="block text-[14px]">{label}</span><span className="block text-[11.5px]" style={{ color: 'var(--muted)' }}>{hint}</span></span>
      <Money value={value} onChange={set} small />
    </label>
  )
}
