import { lazy, Suspense, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Wallet, Hourglass, Gift, TrendingUp, ArrowDownRight, PiggyBank } from 'lucide-react'
import { useStudio } from '../store'
import { useUI } from '../ui'
import { revenueOf, toCollect, fines } from '../derive'
import { Card, PageHead, Kpi, AreaChart, Bars } from '../common'
import { HALLS, hallById, PAY_METHODS } from '../../lib/catalog'
import { StatusPill, Segmented } from '../../ui/kit'
import { EXPENSE_CATS } from './financeLedger'

const Ledger = lazy(() => import('./financeLedger'))
const Certs = lazy(() => import('./financeCerts'))
const Statement = lazy(() => import('./financeStatement'))

type Tab = 'month' | 'ledger' | 'certs' | 'statement'
export default function Finance() {
  const [tab, setTab] = useState<Tab>('month')
  return (
    <>
      <div className="mb-4 -mt-1 overflow-x-auto no-scrollbar"><Segmented value={tab} onChange={setTab} items={[['month', 'Месяц'], ['ledger', 'Движения'], ['certs', 'Сертификаты'], ['statement', 'Выписка']]} /></div>
      <Suspense fallback={<div className="skel h-72" />}>{tab === 'month' ? <MonthReport /> : tab === 'ledger' ? <Ledger /> : tab === 'certs' ? <Certs /> : <Statement />}</Suspense>
    </>
  )
}
import { money, compact, num, ymd, dShort, MON_NOM, pad, timeRange } from '../../lib/format'

function MonthReport() {
  const { bookings, tx, money: ledger } = useStudio()
  const { openBooking } = useUI()
  const now = new Date()
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth()])
  const key = `${ym[0]}-${pad(ym[1] + 1)}`
  const shift = (n: number) => { const d = new Date(ym[0], ym[1] + n, 1); setYm([d.getFullYear(), d.getMonth()]) }
  const prevKey = ymd(new Date(ym[0], ym[1] - 1, 1)).slice(0, 7)

  const m = useMemo(() => bookings.filter(b => b.status !== 'block' && b.date.startsWith(key)), [bookings, key])
  const earned = m.filter(b => revenueOf(b) > 0)
  const revenue = earned.reduce((s, b) => s + revenueOf(b), 0)
  const prevRev = bookings.filter(b => b.date.startsWith(prevKey)).reduce((s, b) => s + revenueOf(b), 0)
  const paidCount = m.filter(b => b.status === 'paid' || b.status === 'done').length
  const avg = paidCount ? Math.round(m.filter(b => b.status === 'paid' || b.status === 'done').reduce((s, b) => s + revenueOf(b), 0) / paidCount) : 0
  const pending = m.filter(b => b.status === 'new').reduce((s, b) => s + toCollect(b), 0)
  const fineSum = m.reduce((s, b) => s + (b.status === 'paid' || b.status === 'done' ? fines(b) : 0), 0)
  const penalties = m.filter(b => b.status === 'cancelled').reduce((s, b) => s + (b.penalty || 0), 0)
  const bonusSpent = m.filter(b => b.status === 'paid' || b.status === 'done').reduce((s, b) => s + (b.bonusUsed || 0), 0)
  const other = ledger.filter(x => x.date.startsWith(key))
  const otherIn = other.filter(x => x.kind === 'income').reduce((s, x) => s + x.amount, 0)
  const expense = other.filter(x => x.kind === 'expense').reduce((s, x) => s + x.amount, 0)
  const byExp = EXPENSE_CATS.map(c => ({ label: c, value: other.filter(x => x.kind === 'expense' && x.category === c).reduce((s, x) => s + x.amount, 0), color: 'var(--bad)' })).filter(x => x.value > 0)
  const accrued = tx.filter(t => t.amount > 0 && t.createdAt.startsWith(key)).reduce((s, t) => s + t.amount, 0)

  const days = new Date(ym[0], ym[1] + 1, 0).getDate()
  const series = Array.from({ length: days }, (_, i) => { const s = `${key}-${pad(i + 1)}`; return { label: String(i + 1), value: m.filter(b => b.date === s).reduce((a, b) => a + revenueOf(b), 0), sub: dShort(s) } })
  const byHall = HALLS.map(h => ({ label: h.name, value: earned.filter(b => b.hall === h.id).reduce((s, b) => s + revenueOf(b), 0), color: h.tone }))
  const byPay = PAY_METHODS.map(([id, n]) => ({ label: n, value: earned.filter(b => (b.payMethod || 'kaspi') === id && b.status !== 'cancelled').reduce((s, b) => s + revenueOf(b), 0) })).filter(x => x.value > 0)
  const srcMap: Record<string, number> = {}; for (const b of earned) srcMap[b.source || 'CRM'] = (srcMap[b.source || 'CRM'] ?? 0) + revenueOf(b)
  const bySrc = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: 'var(--gold)' }))
  const rows = [...m].sort((a, b) => a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1)

  const exportCsv = () => {
    const head = ['Дата', 'Время', 'Зал', 'Клиент', 'Телефон', 'Статус', 'Стоимость', 'Бонусы', 'Штрафы', 'Удержание', 'Получено', 'Оплата', 'Источник']
    const lines = rows.map(b => [b.date, timeRange(b.start, b.hours), hallById(b.hall).name, b.name, b.phone, b.status, b.total, b.bonusUsed || 0, fines(b), b.penalty || 0, revenueOf(b), PAY_METHODS.find(p => p[0] === b.payMethod)?.[1] ?? '', b.source])
    const csv = '﻿' + [head, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `moloko-${key}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const delta = prevRev ? Math.round((revenue / prevRev - 1) * 100) : null

  return (
    <>
      <PageHead title="Финансы" sub="Деньги считаются по дате съёмки: оплаченные и завершённые брони, штрафы и удержания при отмене"
        actions={<>
          <div className="glass !rounded-full flex items-center p-1">
            <button className="icon-btn !rounded-full !size-9 !bg-transparent" onClick={() => shift(-1)} aria-label="Предыдущий месяц"><ChevronLeft className="size-4" /></button>
            <span className="px-2 text-[14px] font-medium min-w-[124px] text-center">{MON_NOM[ym[1]]} {ym[0]}</span>
            <button className="icon-btn !rounded-full !size-9 !bg-transparent" onClick={() => shift(1)} aria-label="Следующий месяц"><ChevronRight className="size-4" /></button>
          </div>
          <button className="btn btn-line h-10" onClick={exportCsv}><Download className="size-4" />CSV</button>
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi label="Доходы" value={revenue + otherIn} format={money} tone="var(--gold)" icon={<Wallet className="size-4" />} sub={delta === null ? `брони ${compact(revenue)} · прочее ${compact(otherIn)}` : <span style={{ color: delta >= 0 ? 'var(--good)' : 'var(--bad)' }}>брони {delta >= 0 ? '+' : ''}{delta}% к {MON_NOM[(ym[1] + 11) % 12].toLowerCase()}</span>} />
        <Kpi label="Расходы" value={expense} format={money} icon={<ArrowDownRight className="size-4" />} tone={expense ? 'var(--bad)' : undefined} sub={byExp[0] ? `больше всего: ${byExp.sort((x, y) => y.value - x.value)[0].label.toLowerCase()}` : 'добавьте во вкладке «Движения»'} delay={.05} />
        <Kpi label="Прибыль" value={revenue + otherIn - expense} format={money} icon={<PiggyBank className="size-4" />} tone={revenue + otherIn - expense >= 0 ? 'var(--good)' : 'var(--bad)'} sub={`средний чек ${compact(avg)} ₸ · ${paidCount} оплат`} delay={.1} />
        <Kpi label="Ожидается" value={pending} format={money} icon={<Hourglass className="size-4" />} tone={pending ? 'var(--warn)' : undefined} sub={`без оплаты · штрафы ${compact(fineSum + penalties)}`} delay={.15} />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3 md:gap-4 mt-3 md:mt-4">
        <Card title="По дням" delay={.1}><AreaChart data={series} height={220} format={money} highlightLast={false} /></Card>
        <Card title="По залам" delay={.15}>
          <Bars items={byHall} format={n => `${compact(n)} ₸`} />
          <div className="mt-5 pt-4 border-t hairline grid grid-cols-2 gap-3">
            <div><div className="text-[12px]" style={{ color: 'var(--muted)' }}><Gift className="size-3.5 inline -mt-0.5 mr-1" />Оплачено бонусами</div><div className="font-display text-[18px] num mt-1">{money(bonusSpent)}</div></div>
            <div><div className="text-[12px]" style={{ color: 'var(--muted)' }}><TrendingUp className="size-3.5 inline -mt-0.5 mr-1" />Начислено бонусов</div><div className="font-display text-[18px] num mt-1" style={{ color: 'var(--gold)' }}>{num(accrued)}</div></div>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
        {byExp.length > 0 && <Card title="Расходы по статьям" delay={.18} className="md:col-span-2">{<Bars items={byExp} format={n => `${compact(n)} ₸`} />}</Card>}
        <Card title="Способы оплаты" delay={.2}>{byPay.length ? <Bars items={byPay} format={n => `${compact(n)} ₸`} /> : <Muted />}</Card>
        <Card title="Откуда пришли деньги" delay={.25}>{bySrc.length ? <Bars items={bySrc} format={n => `${compact(n)} ₸`} /> : <Muted />}</Card>
      </div>

      <Card title={`Брони за ${MON_NOM[ym[1]].toLowerCase()} · ${rows.length}`} className="mt-3 md:mt-4" pad={false} delay={.3}>
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-[13.5px] min-w-[700px]">
            <thead><tr className="text-left text-[12px]" style={{ color: 'var(--muted)' }}>{['Дата', 'Клиент', 'Зал', 'Статус', 'Стоимость', 'Получено'].map((h, i) => <th key={h} className={`font-medium px-5 py-3 border-b hairline ${i > 3 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(b => (
                <tr key={b.id} onClick={() => openBooking(b.id)} className="cursor-pointer hover:bg-[var(--card-2)]">
                  <td className="px-5 py-2.5 border-b hairline num whitespace-nowrap">{dShort(b.date)} <span style={{ color: 'var(--muted)' }}>{pad(b.start)}:00</span></td>
                  <td className="px-5 py-2.5 border-b hairline truncate max-w-[220px]">{b.name}</td>
                  <td className="px-5 py-2.5 border-b hairline">{hallById(b.hall).name}</td>
                  <td className="px-5 py-2.5 border-b hairline"><StatusPill s={b.status} /></td>
                  <td className="px-5 py-2.5 border-b hairline num text-right" style={{ color: 'var(--muted)' }}>{num(b.total)}</td>
                  <td className="px-5 py-2.5 border-b hairline num text-right font-medium">{revenueOf(b) ? num(revenueOf(b)) : '—'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="px-5 py-10 text-center" style={{ color: 'var(--muted)' }}>За этот месяц броней нет</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

const Muted = () => <div className="text-[13px] py-6 text-center" style={{ color: 'var(--muted)' }}>Нет данных за месяц</div>
