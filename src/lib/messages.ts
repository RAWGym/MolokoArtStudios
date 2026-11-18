import type { Booking, Settings } from './types'
import { hallById, STUDIO } from './catalog'
import { dLabel, timeRange, money, waLink } from './format'

export type TemplateKey = keyof Settings['templates']
export const TEMPLATE_META: Record<TemplateKey, { title: string; when: string }> = {
  contact: { title: 'Связаться с клиентом', when: 'Кнопка в новой брони: подтвердить детали и спросить, куда выставить счёт' },
  remind: { title: 'Напоминание', when: 'Кнопка в оплаченной брони, удобно отправить накануне съёмки' },
  thanks: { title: 'Благодарность и отзыв', when: 'Кнопка после завершения съёмки' },
  invite: { title: 'Пригласительное', when: 'Для фотографа: он пересылает своим клиентам ссылку с залом, временем и картой' },
}
export const VARS: [string, string][] = [
  ['{имя}', 'имя клиента'], ['{брони}', 'список залов, дат и времени'], ['{сумма}', 'стоимость'], ['{к_оплате}', 'к оплате с учётом бонусов'],
  ['{адрес}', 'адрес студии'], ['{приглашение}', 'ссылка на пригласительное'], ['{отзыв}', 'ссылка для отзыва'],
  ['{реф_ссылка}', 'реферальная ссылка клиента'], ['{скидка_друга}', 'скидка друга, %'],
]

export const origin = () => (typeof location !== 'undefined' ? location.origin : 'https://moloko-art-silk.vercel.app')
export const inviteUrl = (id: string) => `${origin()}/i/${id}`
export const refUrl = (code?: string | null) => code ? `${origin()}/?ref=${code}` : origin()

export function bookingLines(items: Pick<Booking, 'hall' | 'date' | 'start' | 'hours'>[]) {
  return [...items].sort((a, b) => a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1)
    .map(b => `• ${dLabel(b.date)} · зал ${hallById(b.hall).name} · ${timeRange(b.start, b.hours)}`).join('\n')
}

export function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{([а-яё_a-z]+)\}/gi, (m, k) => vars[k.toLowerCase()] ?? m)
}

export function messageFor(key: TemplateKey, S: Settings, group: Booking[], refCode?: string | null) {
  const b = group[0]
  const total = group.reduce((s, x) => s + x.total, 0), bonus = group.reduce((s, x) => s + (x.bonusUsed || 0), 0)
  return fill(S.templates[key] || '', {
    'имя': (b?.name || '').split(' ')[0],
    'брони': bookingLines(group),
    'сумма': money(total),
    'к_оплате': money(total - bonus),
    'адрес': `${STUDIO.address}, Алматы`,
    'приглашение': b ? inviteUrl(b.id) : '',
    'отзыв': S.reviewUrl || STUDIO.gis,
    'реф_ссылка': refUrl(refCode),
    'скидка_друга': String(S.referral?.friendPct ?? 5),
  })
}

export const waMessage = (phone: string, text: string) => waLink(phone, text)
/** WhatsApp share without a fixed recipient (photographer picks the chat) */
export const waShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
