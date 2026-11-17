import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Gift, Ticket, Copy, MessageCircle, Search, Minus } from 'lucide-react'
import { useStudio } from '../store'
import { PageHead } from '../common'
import { Sheet, Field, Segmented, Empty, toast, Switch, cx } from '../../ui/kit'
import { money, num, today, dShort, maskPhone, fmtPhone, normPhone, waLink, addDays, ymd, relTime } from '../../lib/format'
import { PAY_METHODS } from '../../lib/catalog'
import { fail } from '../msg'
import type { Cert } from '../../lib/types'

const code = () => 'ML-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')
export const certLeft = (c: Cert) => ({
  amount: Math.max(0, c.amount - c.uses.reduce((s, u) => s + (u.amount || 0), 0)),
  hours: Math.max(0, c.hours - c.uses.reduce((s, u) => s + (u.hours || 0), 0)),
})
const isExpired = (c: Cert) => !!c.expires && c.expires < today()

export default function Certs() {
  const { certs } = useStudio()
  const [tab, setTab] = useState<'active' | 'closed'>('active')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<Cert> | null>(null)
  const [use, setUse] = useState<Cert | null>(null)
  const list = useMemo(() => certs.filter(c => {
    const active = c.status === 'active' && !isExpired(c)
    const s = q.trim().toLowerCase()
    return (tab === 'active' ? active : !active) && (!s || (c.code + c.name + c.phone + c.title).toLowerCase().includes(s))
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [certs, tab, q])
  const live = certs.filter(c => c.status === 'active' && !isExpired(c))
  const owed = live.reduce((s, c) => s + certLeft(c).amount, 0)
  const hoursOwed = live.reduce((s, c) => s + certLeft(c).hours, 0)

  return (
    <>
      <PageHead title="Сертификаты и абонементы" sub={`Активных ${live.length} · не использовано ${money(owed)} и ${hoursOwed} ч по абонементам`}
        actions={<>
          <button className="btn btn-line h-10" onClick={() => setEdit({ kind: 'pass', code: code(), hours: 10, price: 180000, expires: ymd(addDays(new Date(), 180)) })}><Ticket className="size-4" />Абонемент</button>
          <button className="btn btn-primary h-10" onClick={() => setEdit({ kind: 'certificate', code: code(), amount: 30000, price: 30000, expires: ymd(addDays(new Date(), 365)) })}><Gift className="size-4" />Сертификат</button>
        </>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented value={tab} onChange={setTab} items={[['active', 'Действующие'], ['closed', 'Использованные и истёкшие']]} />
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="size-4 absolute z-10 left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} /><input className="field !h-10 !pl-10 glass !rounded-full !text-[14px]" placeholder="Код, имя или телефон" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      {list.length ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4">
          {list.map((c, i) => {
            const left = certLeft(c); const pass = c.kind === 'pass'
            const total = pass ? c.hours : c.amount, rest = pass ? left.hours : left.amount
            return (
              <motion.button key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * .04 }} onClick={() => setUse(c)}
                className="relative text-left rounded-[22px] p-5 overflow-hidden min-h-[184px] flex flex-col transition-transform hover:-translate-y-0.5"
                style={{ background: pass ? 'linear-gradient(135deg, #2c4f52, #182b2d)' : 'linear-gradient(135deg, #d9bd86, #a8844a)', color: pass ? '#FFF9ED' : '#2a1d08', boxShadow: 'var(--shadow)', opacity: tab === 'closed' ? .6 : 1 }}>
                <span className="absolute -right-8 -top-8 size-32 rounded-full border-[14px] opacity-15" style={{ borderColor: 'currentColor' }} />
                <div className="flex items-center justify-between text-[11px] tracking-[.18em] uppercase opacity-80"><span>{pass ? 'Абонемент' : 'Сертификат'}</span><span className="font-mono tracking-normal">{c.code}</span></div>
                <div className="font-display text-[26px] mt-3 num leading-none">{pass ? `${rest} из ${total} ч` : money(rest)}</div>
                {!pass && rest !== total && <div className="text-[12px] opacity-75 mt-1">из {money(total)}</div>}
                <div className="mt-auto pt-4 flex items-end justify-between gap-2 text-[12.5px]">
                  <span className="min-w-0"><span className="block font-semibold truncate">{c.name || 'Без имени'}</span><span className="block opacity-75">{c.expires ? `до ${dShort(c.expires)}` : 'бессрочно'}{c.status !== 'active' ? ` · ${c.status === 'used' ? 'использован' : c.status === 'void' ? 'аннулирован' : 'истёк'}` : isExpired(c) ? ' · истёк' : ''}</span></span>
                  <span className="h-1.5 w-16 rounded-full overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,.25)' }}><span className="block h-full rounded-full" style={{ width: `${total ? (rest / total) * 100 : 0}%`, background: 'currentColor' }} /></span>
                </div>
              </motion.button>
            )
          })}
        </div>
      ) : <div className="glass"><Empty icon={<Gift className="size-6" />} title={tab === 'active' ? 'Пока нет сертификатов' : 'Здесь пусто'} text={tab === 'active' ? 'Подарочный сертификат на сумму или абонемент на часы. Продажа сразу попадёт в доходы.' : undefined} /></div>}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.kind === 'pass' ? 'Новый абонемент' : 'Новый сертификат'}>{edit && <CertForm key={edit.code} c={edit} onDone={() => setEdit(null)} />}</Sheet>
      <Sheet open={!!use} onClose={() => setUse(null)} title={use ? `${use.kind === 'pass' ? 'Абонемент' : 'Сертификат'} ${use.code}` : ''}>{use && <UseForm key={use.id} c={certs.find(x => x.id === use.id) ?? use} onDone={() => setUse(null)} />}</Sheet>
    </>
  )
}

function CertForm({ c, onDone }: { c: Partial<Cert>; onDone: () => void }) {
  const { saveCert, addMoney, me } = useStudio()
  const [f, setF] = useState<Partial<Cert>>({ ...c, phone: c.phone ? maskPhone(c.phone) : '' })
  const [record, setRecord] = useState(true)
  const [method, setMethod] = useState('kaspi')
  const [busy, setBusy] = useState(false)
  const pass = f.kind === 'pass'
  const save = async () => {
    if (pass ? !f.hours : !f.amount) { toast(pass ? 'Укажите количество часов' : 'Укажите номинал', 'err'); return }
    setBusy(true)
    try {
      const saved = await saveCert({ ...f, phone: f.phone ? normPhone(f.phone) : '', title: f.title || (pass ? `Абонемент ${f.hours} ч` : `Сертификат на ${num(f.amount ?? 0)} ₸`) })
      if (record && (f.price ?? 0) > 0 && (me?.role === 'owner' || me?.role === 'accountant')) await addMoney({ kind: 'income', category: pass ? 'Абонемент' : 'Сертификат', amount: f.price, date: today(), method, note: `${saved.code}${f.name ? ' · ' + f.name : ''}`, certId: saved.id })
      toast(pass ? 'Абонемент создан' : 'Сертификат создан'); onDone()
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="grid grid-cols-2 gap-3">
        {pass
          ? <Field label="Часов в абонементе"><input className="field num" inputMode="numeric" value={f.hours || ''} onChange={e => setF({ ...f, hours: +e.target.value.replace(/\D/g, '') || 0 })} /></Field>
          : <Field label="Номинал, ₸"><input className="field num" inputMode="numeric" value={f.amount ? num(f.amount) : ''} onChange={e => { const v = +e.target.value.replace(/\D/g, '') || 0; setF({ ...f, amount: v, price: f.price === f.amount ? v : f.price }) }} /></Field>}
        <Field label="Оплачено, ₸"><input className="field num" inputMode="numeric" value={f.price ? num(f.price) : ''} onChange={e => setF({ ...f, price: +e.target.value.replace(/\D/g, '') || 0 })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Кому (имя)"><input className="field" value={f.name ?? ''} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Телефон"><input className="field num" inputMode="tel" value={f.phone ?? ''} onChange={e => setF({ ...f, phone: maskPhone(e.target.value) })} placeholder="+7" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Код"><input className="field font-mono uppercase" value={f.code ?? ''} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Действует до"><input type="date" className="field" value={f.expires ?? ''} onChange={e => setF({ ...f, expires: e.target.value || null })} /></Field>
      </div>
      <Field label="Комментарий"><input className="field" value={f.note ?? ''} onChange={e => setF({ ...f, note: e.target.value })} placeholder="От кого, повод" /></Field>
      {(me?.role === 'owner' || me?.role === 'accountant') && (
        <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: 'var(--card-2)' }}>
          <label className="flex items-center justify-between gap-3 text-[14px]">Записать продажу в доходы<Switch on={record} onChange={setRecord} /></label>
          {record && <div className="flex flex-wrap gap-1.5">{PAY_METHODS.map(([id, n]) => <button key={id} className="chip" aria-pressed={method === id} onClick={() => setMethod(id)}>{n}</button>)}</div>}
        </div>
      )}
      <button className="btn btn-primary h-12" disabled={busy} onClick={save}>{pass ? 'Создать абонемент' : 'Создать сертификат'}</button>
    </div>
  )
}

function UseForm({ c, onDone }: { c: Cert; onDone: () => void }) {
  const { saveCert, me, staff } = useStudio()
  const left = certLeft(c); const pass = c.kind === 'pass'
  const [v, setV] = useState(pass ? Math.min(1, left.hours) : 0)
  const [busy, setBusy] = useState(false)
  const active = c.status === 'active' && !isExpired(c)
  const text = `${pass ? 'Абонемент' : 'Подарочный сертификат'} Moloko Art Studios\nКод: ${c.code}\n${pass ? `Осталось: ${left.hours} ч` : `Остаток: ${money(left.amount)}`}${c.expires ? `\nДействует до ${dShort(c.expires)}` : ''}\n\nДля записи назовите код администратору.`
  const spend = async () => {
    if (!v) return
    if (pass ? v > left.hours : v > left.amount) { toast('Больше, чем осталось', 'err'); return }
    setBusy(true)
    try {
      const uses = [...c.uses, { at: new Date().toISOString(), amount: pass ? 0 : v, hours: pass ? v : 0, by: me?.userId }]
      const after = pass ? left.hours - v : left.amount - v
      await saveCert({ ...c, uses, status: after <= 0 ? 'used' : 'active' })
      toast(pass ? `Списано ${v} ч` : `Списано ${money(v)}`); onDone()
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="rounded-2xl p-4" style={{ background: 'var(--card-2)' }}>
        <div className="text-[13px]" style={{ color: 'var(--muted)' }}>{c.name || 'Без имени'}{c.phone ? ` · ${fmtPhone(c.phone)}` : ''}</div>
        <div className="font-display text-[28px] num mt-1">{pass ? `${left.hours} ч` : money(left.amount)}</div>
        <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>осталось из {pass ? `${c.hours} ч` : money(c.amount)} · продан за {money(c.price)}{c.expires ? ` · до ${dShort(c.expires)}` : ''}</div>
      </div>
      {active && (pass ? left.hours : left.amount) > 0 && (
        <div className="flex flex-col gap-2">
          <span className="label !mb-0">Списать {pass ? 'часы' : 'сумму'} за съёмку</span>
          <div className="flex gap-2">
            {pass ? <div className="flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--card-2)' }}>
              <button className="size-10 grid place-items-center rounded-full" onClick={() => setV(Math.max(1, v - 1))} aria-label="Меньше"><Minus className="size-4" /></button><span className="w-10 text-center font-semibold num">{v}</span><button className="size-10 grid place-items-center rounded-full" onClick={() => setV(Math.min(left.hours, v + 1))} aria-label="Больше"><Plus className="size-4" /></button>
            </div> : <input className="field num flex-1" inputMode="numeric" placeholder="Сумма" value={v ? num(v) : ''} onChange={e => setV(+e.target.value.replace(/\D/g, '') || 0)} />}
            <button className="btn btn-primary flex-1 h-12" disabled={busy || !v} onClick={spend}>Списать</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-line h-11" onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Скопировано') } catch { toast('Не удалось скопировать', 'err') } }}><Copy className="size-4" />Текст</button>
        {c.phone ? <a className="btn btn-line h-11" href={waLink(c.phone, text)} target="_blank" rel="noopener"><MessageCircle className="size-4" />WhatsApp</a> : <span />}
      </div>
      {c.uses.length > 0 && <div className="flex flex-col">
        <span className="eyebrow mb-1">История</span>
        {[...c.uses].reverse().map((u, i) => <div key={i} className="flex justify-between py-2 border-b hairline last:border-0 text-[13.5px]"><span>{relTime(u.at)}{u.by ? ` · ${staff.find(s => s.userId === u.by)?.name ?? ''}` : ''}</span><span className="num">−{u.hours ? `${u.hours} ч` : money(u.amount)}</span></div>)}
      </div>}
      {active && me?.role === 'owner' && <button className={cx('btn btn-ghost btn-sm self-center')} style={{ color: 'var(--bad)' }} onClick={async () => { if (!confirm('Аннулировать?')) return; try { await saveCert({ ...c, status: 'void' }); toast('Аннулирован'); onDone() } catch (e) { fail(e) } }}>Аннулировать</button>}
    </div>
  )
}
