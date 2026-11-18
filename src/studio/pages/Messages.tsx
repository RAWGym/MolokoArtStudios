import { useMemo, useRef, useState } from 'react'
import { Save, RotateCcw, MessageCircle, Star, Users } from 'lucide-react'
import { useStudio } from '../store'
import { Card, PageHead } from '../common'
import { DEFAULT_SETTINGS } from '../../lib/catalog'
import { TEMPLATE_META, VARS, messageFor, type TemplateKey } from '../../lib/messages'
import { Segmented, Switch, Field, toast } from '../../ui/kit'
import { today } from '../../lib/format'
import { fail } from '../msg'
import type { Booking, Settings } from '../../lib/types'

const SAMPLE: Booking[] = [
  { id: 'demo-invite', hall: 'beige', date: today(), start: 14, hours: 2, status: 'new', name: 'Айгерим Сейткали', phone: '+7 701 000 00 00', phoneNorm: '77010000000', total: 40000, bonusUsed: 2000, source: 'Виджет', demo: true, createdAt: new Date().toISOString() },
  { id: 'demo-2', hall: 'black', date: today(), start: 17, hours: 1, status: 'new', name: 'Айгерим Сейткали', phone: '+7 701 000 00 00', phoneNorm: '77010000000', total: 20000, bonusUsed: 0, source: 'Виджет', demo: true, createdAt: new Date().toISOString() },
]

export default function Messages() {
  const { S, saveSettings } = useStudio()
  const [T, setT] = useState<Settings['templates']>(() => ({ ...S.templates }))
  const [ref, setRef] = useState(() => ({ ...S.referral }))
  const [review, setReview] = useState(S.reviewUrl)
  const [support, setSupport] = useState(S.supportPhone ?? '')
  const [k, setK] = useState<TemplateKey>('contact')
  const [combo, setCombo] = useState(false)
  const [busy, setBusy] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const dirty = JSON.stringify(T) !== JSON.stringify(S.templates) || JSON.stringify(ref) !== JSON.stringify(S.referral) || review !== S.reviewUrl || support !== (S.supportPhone ?? '')
  const preview = useMemo(() => messageFor(k, { ...S, templates: T, referral: ref, reviewUrl: review }, combo ? SAMPLE : SAMPLE.slice(0, 1), 'AB12CD'), [k, T, ref, review, combo, S])

  const insert = (v: string) => {
    const el = area.current; const cur = T[k]
    const pos = el ? el.selectionStart : cur.length
    const next = cur.slice(0, pos) + v + cur.slice(pos)
    setT({ ...T, [k]: next })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + v.length, pos + v.length) })
  }
  const save = async () => { setBusy(true); try { await saveSettings({ ...S, templates: T, referral: ref, reviewUrl: review.trim(), supportPhone: support.trim() }); toast('Шаблоны сохранены') } catch (e) { fail(e) } finally { setBusy(false) } }

  return (
    <>
      <PageHead title="Сообщения" sub="Тексты, которые администратор отправляет клиенту одной кнопкой из карточки брони. Слова в фигурных скобках подставятся сами."
        actions={<button className="btn btn-primary h-10" disabled={!dirty || busy} onClick={save}><Save className="size-4" />Сохранить</button>} />
      <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3 md:gap-4 items-start">
        <Card title={TEMPLATE_META[k].title} action={<div className="max-w-full overflow-x-auto no-scrollbar"><Segmented value={k} onChange={setK} items={(Object.keys(TEMPLATE_META) as TemplateKey[]).map(x => [x, { contact: 'Связаться', remind: 'Напомнить', thanks: 'Спасибо', invite: 'Приглашение' }[x]])} /></div>}>
          <div className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>{TEMPLATE_META[k].when}</div>
          <textarea ref={area} className="field !text-[14.5px] leading-relaxed font-[inherit]" rows={14} value={T[k]} onChange={e => setT({ ...T, [k]: e.target.value })} />
          <div className="flex flex-wrap gap-1.5 mt-3">{VARS.map(([v, hint]) => <button key={v} className="chip !h-8 !text-[12.5px]" title={hint} onClick={() => insert(v)}>{v}</button>)}</div>
          <div className="flex justify-end mt-3"><button className="btn btn-ghost btn-sm" onClick={() => setT({ ...T, [k]: DEFAULT_SETTINGS.templates[k] })}><RotateCcw className="size-4" />Вернуть стандартный текст</button></div>
        </Card>
        <div className="flex flex-col gap-3 md:gap-4 xl:sticky xl:top-24">
          <Card title="Так увидит клиент" action={<label className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>комбо-бронь<Switch on={combo} onChange={setCombo} /></label>}>
            <div className="rounded-[22px] p-3" style={{ background: 'color-mix(in oklab, #0b141a 70%, var(--card))' }}>
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-white" style={{ background: '#005c4b' }}>{preview}</div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-[12px]" style={{ color: 'var(--muted)' }}><MessageCircle className="size-4" />Откроется в WhatsApp с номером клиента</div>
          </Card>
          <Card title="Отзывы и приглашения друзей">
            <div className="flex flex-col gap-4">
              <Field label="Ссылка для отзыва" hint="2ГИС, Google или Instagram — подставится в {отзыв}"><div className="relative"><Star className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--gold)' }} /><input className="field !pl-10" value={review} onChange={e => setReview(e.target.value)} /></div></Field>
              <Field label="WhatsApp поддержки" hint="Сюда уходят «Нужна помощь» и «Нашли ошибку?» из CRM. Пусто: номер студии"><input className="field num" inputMode="tel" value={support} onChange={e => setSupport(e.target.value)} placeholder="+7 701 155 55 71" /></Field>
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[14px]"><Users className="size-4" />Реферальная программа</span><Switch on={ref.enabled} onChange={v => setRef({ ...ref, enabled: v })} /></div>
              <div className="grid grid-cols-2 gap-3" style={{ opacity: ref.enabled ? 1 : .5 }}>
                <Field label="Скидка другу, %"><input className="field num" inputMode="numeric" value={ref.friendPct} onChange={e => setRef({ ...ref, friendPct: Math.min(50, +e.target.value.replace(/\D/g, '') || 0) })} /></Field>
                <Field label="Бонус пригласившему, %"><input className="field num" inputMode="numeric" value={ref.referrerPct} onChange={e => setRef({ ...ref, referrerPct: Math.min(50, +e.target.value.replace(/\D/g, '') || 0) })} /></Field>
              </div>
              <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Друг получает скидку на первую бронь по ссылке клиента. Пригласивший получает бонусы, когда съёмка друга завершится.</div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
