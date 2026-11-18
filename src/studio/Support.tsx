import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, ChevronDown, Copy, Bug, Send } from 'lucide-react'
import { Sheet, toast } from '../ui/kit'
import { STUDIO } from '../lib/catalog'
import { normPhone } from '../lib/format'
import { nativePlatform, nativeVersion } from '../lib/native'
import { useStudio } from './store'
import { useUI } from './ui'
import { ROLE_LABEL } from './perm'

const FAQ: [string, string][] = [
  ['Как создать бронь?', 'Кнопка «Бронь» вверху справа или клавиша N. Выберите зал, дату и время, введите телефон клиента: имя и бонусы подтянутся сами. Несколько залов в одном заказе: «Добавить зал».'],
  ['Как отметить оплату?', 'Откройте бронь в «Расписании» или «Заявках» и нажмите «Оплачено», выберите способ оплаты. Бонусы клиенту начислятся после завершения съёмки.'],
  ['Почему я не могу изменить или удалить старую бронь?', 'Администратор меняет брони только за последние два дня. Для более старых нажмите «Запросить у владельца»: владелец подтвердит во вкладке «Запросы».'],
  ['Как добавить сотрудника?', 'Владелец: «Команда» → «Добавить». Выберите роль, придумайте логин и пароль и отправьте доступ сотруднику.'],
  ['Как получать уведомления?', 'Вкладка «Уведомления»: нажмите «Разрешить» и выберите, какие события присылать. В приложении для Android и Windows они приходят и когда CRM свёрнута.'],
  ['Как скачать выписку в PDF?', '«Финансы» → «Выписка»: выберите период и нажмите «Скачать PDF», в окне печати выберите «Сохранить как PDF».'],
  ['Как поменять цены, фото и объявления?', 'Владелец или SMM: вкладка «Виджет». Изменения сразу видят клиенты на странице брони.'],
]

const supportWa = (S: { supportPhone?: string }) => {
  const p = normPhone(S.supportPhone || '')
  return p.length === 11 ? `https://wa.me/${p}` : STUDIO.wa
}

function context() {
  const me = useStudio.getState().me, page = useUI.getState().page
  const app = nativePlatform()
  return [
    `Кто: ${me?.name ?? '—'} (${me?.login ?? '—'}, ${me ? ROLE_LABEL[me.role] : '—'})`,
    `Раздел: ${page}`,
    `Где: ${app ? `приложение ${app} ${nativeVersion() ?? ''}` : 'браузер'} · ${innerWidth}×${innerHeight}`,
    `Устройство: ${navigator.userAgent}`,
    `Время: ${new Date().toLocaleString('ru-RU')}`,
  ].join('\n')
}

const open = (url: string) => { window.open(url, '_blank', 'noopener') }

export function HelpSheet({ open: isOpen, onClose, onBug }: { open: boolean; onClose: () => void; onBug: () => void }) {
  const S = useStudio(s => s.S)
  const me = useStudio(s => s.me)
  const [q, setQ] = useState<number | null>(0)
  const ask = () => open(`${supportWa(S)}?text=${encodeURIComponent(`Здравствуйте! Нужна помощь с CRM Moloko.\n${me?.name ?? ''}\n\nВопрос: `)}`)
  return (
    <Sheet open={isOpen} onClose={onClose} title="Нужна помощь?">
      <p className="text-[14px] mb-3" style={{ color: 'var(--muted)' }}>Частые вопросы. Не нашли ответ: напишите нам, ответим в WhatsApp.</p>
      <div className="flex flex-col">
        {FAQ.map(([t, a], i) => (
          <div key={t} className="border-b hairline last:border-0">
            <button className="w-full flex items-center justify-between gap-3 py-3 text-left text-[14.5px] font-medium" onClick={() => setQ(q === i ? null : i)} aria-expanded={q === i}>
              {t}<ChevronDown className="size-4 shrink-0 transition-transform" style={{ transform: q === i ? 'rotate(180deg)' : undefined, color: 'var(--muted)' }} />
            </button>
            <AnimatePresence initial={false}>
              {q === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden text-[13.5px] leading-relaxed pb-3" style={{ color: 'var(--ink-2)' }}>{a}</motion.p>}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button className="btn btn-primary h-12" onClick={ask}><MessageCircle className="size-4" />Написать</button>
        <button className="btn btn-line h-12" onClick={() => { onClose(); onBug() }}><Bug className="size-4" />Нашли ошибку?</button>
      </div>
    </Sheet>
  )
}

export function BugSheet({ open: isOpen, onClose }: { open: boolean; onClose: () => void }) {
  const S = useStudio(s => s.S)
  const [what, setWhat] = useState(''), [steps, setSteps] = useState(''), [tech, setTech] = useState(true)
  const text = () => [`🐞 Ошибка в CRM Moloko`, '', `Что случилось: ${what.trim()}`, steps.trim() ? `Что делали перед этим: ${steps.trim()}` : '', tech ? `\n${context()}` : ''].filter(Boolean).join('\n')
  const send = () => { open(`${supportWa(S)}?text=${encodeURIComponent(text())}`); toast('Спасибо! Отправьте сообщение в WhatsApp'); setWhat(''); setSteps(''); onClose() }
  const copy = async () => { try { await navigator.clipboard.writeText(text()); toast('Описание скопировано') } catch { toast('Не удалось скопировать', 'err') } }
  return (
    <Sheet open={isOpen} onClose={onClose} title="Нашли ошибку?">
      <p className="text-[14px] mb-4" style={{ color: 'var(--muted)' }}>Опишите, что пошло не так. Скриншот можно приложить уже в WhatsApp.</p>
      <div className="flex flex-col gap-3">
        <label><span className="label">Что случилось</span><textarea className="field !h-auto py-3 min-h-[96px]" value={what} onChange={e => setWhat(e.target.value)} placeholder="Например: при оплате брони кнопка не нажимается" /></label>
        <label><span className="label">Что делали перед этим <span style={{ color: 'var(--faint)' }}>(необязательно)</span></span><textarea className="field !h-auto py-3 min-h-[72px]" value={steps} onChange={e => setSteps(e.target.value)} placeholder="Открыл бронь, выбрал Kaspi, нажал «Оплачено»" /></label>
        <label className="flex items-start gap-2.5 text-[13px] cursor-pointer"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={tech} onChange={e => setTech(e.target.checked)} /><span>Приложить техническую информацию: раздел, устройство, версия, время. Пароли и данные клиентов не отправляются.</span></label>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 mt-4">
        <button className="btn btn-primary h-12" disabled={what.trim().length < 3} onClick={send}><Send className="size-4" />Отправить в WhatsApp</button>
        <button className="btn btn-line h-12 !px-4" disabled={what.trim().length < 3} onClick={copy} title="Скопировать"><Copy className="size-4" /></button>
      </div>
    </Sheet>
  )
}
