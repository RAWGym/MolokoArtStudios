import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileDown, ArrowUpRight, ArrowDownRight, Scale } from 'lucide-react'
import { useStudio } from '../store'
import { Card } from '../common'
import { Field, Empty, toast } from '../../ui/kit'
import { STUDIO } from '../../lib/catalog'
import { logoSvg } from '../../ui/logo'
import { printHtml } from '../../lib/native'
import { money, num, today, ymd, addDays, parseYmd, pad } from '../../lib/format'
import { buildEntries, METHOD, type Entry } from './financeLedger'

const LOGO = logoSvg({ width: 170 })

const dmy = (s: string) => { const d = parseYmd(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` }
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function presets(): [string, string, string][] {
  const t = new Date(); const y = t.getFullYear(); const m = t.getMonth()
  const q = Math.floor(m / 3) * 3
  return [
    ['Этот месяц', ymd(new Date(y, m, 1)), today()],
    ['Прошлый месяц', ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))],
    ['Квартал', ymd(new Date(y, q, 1)), today()],
    ['30 дней', ymd(addDays(t, -29)), today()],
    ['Год', ymd(new Date(y, 0, 1)), today()],
  ]
}

function totals(list: Entry[]) {
  const inc = list.filter(e => e.kind === 'income').reduce((s, e) => s + e.amount, 0)
  const exp = list.filter(e => e.kind === 'expense').reduce((s, e) => s + e.amount, 0)
  return { inc, exp, net: inc - exp }
}

function statementHtml(list: Entry[], from: string, to: string, studio: string, address: string) {
  const t = totals(list)
  const rows = [...list].sort((a, b) => a.date.localeCompare(b.date)).map((e, i) => `<tr>
    <td class="n">${i + 1}</td><td>${dmy(e.date)}</td>
    <td><b>${esc(e.category)}</b><div class="s">${esc(e.title)}${e.note && e.note !== e.title ? ' · ' + esc(e.note) : ''}</div></td>
    <td>${esc(METHOD(e.method))}</td>
    <td class="a ${e.kind}">${e.kind === 'income' ? '+' : '−'}${num(e.amount)}</td></tr>`).join('')
  const now = new Date()
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Выписка ${dmy(from)}–${dmy(to)}</title>
<style>
@page{size:A4;margin:16mm 14mm}
*{box-sizing:border-box}body{font-family:Onest,'Segoe UI',system-ui,-apple-system,sans-serif;color:#1d2a2b;margin:0;font-size:11.5px}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0D4042;padding-bottom:12px}
h1{font-size:20px;margin:18px 0 2px;letter-spacing:-.01em}.muted{color:#6b7a7a}
.kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0 18px}
.kpi div{border:1px solid #dfe6e4;border-radius:10px;padding:10px 12px;background:#FFF9ED}
.kpi span{display:block;color:#6b7a7a;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em}
.kpi b{font-size:17px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7a7a;border-bottom:1px solid #cfd8d6;padding:6px 6px}
td{padding:7px 6px;border-bottom:1px solid #eef1f0;vertical-align:top}tr{page-break-inside:avoid}
.n{color:#9aa6a5;width:28px}.s{color:#6b7a7a;font-size:10.5px;margin-top:1px}
.a{text-align:right;white-space:nowrap;font-weight:600;font-variant-numeric:tabular-nums}.income{color:#2f6b4f}.expense{color:#a2412f}
tfoot td{border:0;border-top:2px solid #0D4042;font-weight:700;padding-top:10px}
footer{margin-top:22px;color:#9aa6a5;font-size:10px;display:flex;justify-content:space-between}
</style></head><body>
<header><div>${LOGO}</div><div style="text-align:right" class="muted">${esc(studio)}<br>${esc(address)}</div></header>
<h1>Выписка за период ${dmy(from)} – ${dmy(to)}</h1>
<div class="muted">Сформирована ${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} в ${pad(now.getHours())}:${pad(now.getMinutes())} · операций: ${list.length}</div>
<div class="kpi"><div><span>Поступления</span><b class="income">+${num(t.inc)} ₸</b></div><div><span>Расходы</span><b class="expense">−${num(t.exp)} ₸</b></div><div><span>Итог за период</span><b>${t.net < 0 ? '−' : ''}${num(Math.abs(t.net))} ₸</b></div></div>
<table><thead><tr><th>#</th><th>Дата</th><th>Операция</th><th>Способ</th><th style="text-align:right">Сумма, ₸</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">За период операций нет</td></tr>'}</tbody>
<tfoot><tr><td colspan="4">Итого: поступления ${num(t.inc)} ₸, расходы ${num(t.exp)} ₸</td><td class="a">${t.net < 0 ? '−' : ''}${num(Math.abs(t.net))}</td></tr></tfoot></table>
<footer><span>Moloko Art Studios</span><span>Документ сформирован в CRM студии</span></footer>
</body></html>`
}

export default function Statement() {
  const { bookings, money: rows } = useStudio()
  const P = useMemo(presets, [])
  const [from, setFrom] = useState(P[0][1])
  const [to, setTo] = useState(P[0][2])
  const [busy, setBusy] = useState(false)
  const lo = from <= to ? from : to, hi = from <= to ? to : from
  const list = useMemo(() => buildEntries(bookings, rows, lo, hi), [bookings, rows, lo, hi])
  const t = totals(list)

  const download = () => {
    const html = statementHtml(list, lo, hi, 'Moloko Art Studios', STUDIO.address)
    if (printHtml(html, `Выписка ${dmy(lo)}–${dmy(hi)}`)) return
    setBusy(true)
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
    document.body.appendChild(frame)
    const doc = frame.contentDocument!
    doc.open(); doc.write(html); doc.close()
    const go = () => {
      try { frame.contentWindow!.focus(); frame.contentWindow!.print() } catch { toast('Не удалось открыть печать', 'err') }
      setTimeout(() => { frame.remove(); setBusy(false) }, 1500)
    }
    // give fonts a moment to load before printing
    setTimeout(go, 350)
    toast('В окне печати выберите «Сохранить как PDF»')
  }

  return (
    <div className="grid xl:grid-cols-[minmax(320px,380px)_1fr] gap-3 md:gap-4 items-start">
      <Card title="Период выписки">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {P.map(([l, f, tt]) => <button key={l} className="chip !h-8 !text-[12.5px]" aria-pressed={lo === f && hi === tt} onClick={() => { setFrom(f); setTo(tt) }}>{l}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="С"><input type="date" className="field" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} /></Field>
          <Field label="По"><input type="date" className="field" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} /></Field>
        </div>
        <div className="flex flex-col gap-2 mt-4">
          {([['Поступления', t.inc, ArrowUpRight, 'var(--good)'], ['Расходы', t.exp, ArrowDownRight, 'var(--bad)'], ['Итог', t.net, Scale, 'var(--accent)']] as const).map(([l, v, I, c], i) => (
            <motion.div key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .05 }} className="flex items-center justify-between rounded-2xl px-3.5 py-3" style={{ background: 'var(--card-2)' }}>
              <span className="flex items-center gap-2 text-[13.5px]"><I className="size-4" style={{ color: c }} />{l}</span>
              <b className="num text-[15px]">{money(v)}</b>
            </motion.div>
          ))}
        </div>
        <button className="btn btn-primary h-12 w-full mt-4" disabled={busy} onClick={download}><FileDown className="size-5" />Скачать PDF</button>
        <div className="text-[12px] mt-2 text-center" style={{ color: 'var(--muted)' }}>С логотипом, датами периода, итогами и каждой операцией</div>
      </Card>
      <Card title={`Операции · ${list.length}`} pad={false}>
        {list.length === 0 ? <div className="p-6"><Empty title="За этот период движений нет" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                <th className="px-4 py-2.5 font-medium">Дата</th><th className="px-2 py-2.5 font-medium">Операция</th><th className="px-2 py-2.5 font-medium hidden md:table-cell">Способ</th><th className="px-4 py-2.5 font-medium text-right">Сумма</th>
              </tr></thead>
              <tbody>{[...list].sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                <tr key={e.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
                  <td className="px-4 py-2.5 whitespace-nowrap num">{dmy(e.date)}</td>
                  <td className="px-2 py-2.5"><div className="font-medium">{e.category}</div><div className="text-[12px] line-clamp-1" style={{ color: 'var(--muted)' }}>{e.title}</div></td>
                  <td className="px-2 py-2.5 hidden md:table-cell" style={{ color: 'var(--muted)' }}>{METHOD(e.method)}</td>
                  <td className="px-4 py-2.5 text-right num font-semibold whitespace-nowrap" style={{ color: e.kind === 'income' ? 'var(--good)' : 'var(--bad)' }}>{e.kind === 'income' ? '+' : '−'}{num(e.amount)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
