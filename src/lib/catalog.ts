import type { Booking, Settings, LoyaltyLevel } from './types'

export type HallId = 'white' | 'beige' | 'grey' | 'black'
export interface Hall { id: HallId; name: string; img: string; tone: string; line: string; features: string[] }

export const HALLS: Hall[] = [
  { id: 'white', name: 'WHITE', img: '/img/white.jpg', tone: '#E9E2D6', line: 'Светлые драпировки, жемчужная люстра и мягкий дневной свет из больших окон.', features: ['Окна в пол', 'Циклорама', 'Диван-честерфилд'] },
  { id: 'beige', name: 'BEIGE', img: '/img/beige.jpg', tone: '#B89B7A', line: 'Библиотека с аркой, бархатный диван и тёплый свет. Сейчас стоит новогодний декор.', features: ['Арка-библиотека', 'Бархат', 'Тёплый свет'] },
  { id: 'grey', name: 'GREY', img: '/img/grey.jpg', tone: '#8E8E8A', line: 'Бетонные стены, хрустальная люстра и графичный свет. Конфетти здесь запрещено.', features: ['Бетон', 'Хрусталь', 'Графика'] },
  { id: 'black', name: 'BLACK', img: '/img/black.jpg', tone: '#6B1E26', line: 'Красная сцена: бархатный занавес, хрустальные люстры и канделябры.', features: ['Бархатный занавес', 'Канделябры', 'Сцена'] },
]
export const hallById = (id: string) => HALLS.find(h => h.id === id) ?? HALLS[0]

export const EQUIP = [
  { id: 'light', n: 'Доп. источник света', d: '2 уже входят в аренду' },
  { id: 'smoke', n: 'Генератор дыма' },
  { id: 'snow', n: 'Генератор снега', d: 'Уборка включена' },
  { id: 'proj', n: 'Проектор' },
  { id: 'laser', n: 'Лазер' },
  { id: 'gobo_j', n: 'Гобо-насадка Jinbei' },
  { id: 'gobo_a', n: 'Гобо-насадка Aputure' },
  { id: 'jedi', n: 'Джедай-лампа RGB' },
  { id: 'rgb', n: 'Проекторная лампа RGB', d: '16 цветов' },
  { id: 'tripod', n: 'Штатив для камеры или телефона' },
] as const

export const FINES: [string, number][] = [
  ['Несогласованные хлопушки', 20000], ['Нарушение правил студии', 10000], ['Загрязнение под покраску', 10000],
  ['Бумажный фон, 1 м', 10000], ['Загрязнение циклорамы', 5000], ['Раскатка фона по полу > 1 м', 5000], ['Уборка конфетти', 5000],
]

export const KINDS = ['Портрет', 'Семейная', 'Love story', 'Контент для бренда', 'Беременность', 'Детская', 'Видео / reels', 'Другое']
export const SOURCES = ['Виджет', 'WhatsApp', 'Instagram', '2ГИС', 'Звонок', 'Реферал', 'Повторный']
export const PAY_METHODS = [['kaspi', 'Kaspi'], ['cash', 'Наличные'], ['card', 'Карта'], ['transfer', 'Перевод']] as const

export const STUDIO = {
  phone: '+7 701 155 55 71',
  wa: 'https://wa.me/77011555571',
  ig: 'https://www.instagram.com/moloko.artstudios/',
  address: 'Торайгырова 21/1, ЖК Sholpan City, 1 этаж',
  gis: 'https://2gis.kz/almaty/search/%D0%A2%D0%BE%D1%80%D0%B0%D0%B9%D0%B3%D1%8B%D1%80%D0%BE%D0%B2%D0%B0%2021%2F1',
}

export const DEFAULT_LEVELS: LoyaltyLevel[] = [
  { id: 'milk', name: 'Milk', pct: 3, from: 0 },
  { id: 'cream', name: 'Cream', pct: 5, from: 20 },
  { id: 'gold', name: 'Gold', pct: 8, from: 60 },
]

export const DEFAULT_SETTINGS: Settings = {
  halls: { white: 15000, beige: 20000, grey: 20000, black: 20000 },
  night: 2000, guest: 1000, freeGuests: 6, confetti: 5000,
  equip: { light: 1500, smoke: 2000, snow: 10000, proj: 2000, laser: 2000, gobo_j: 1000, gobo_a: 2000, jedi: 1000, rgb: 1000, tripod: 1000 },
  loyalty: { enabled: true, basis: 'hours', levels: DEFAULT_LEVELS, maxRedeemPct: 30, welcome: 0 },
}

export function mergeSettings(raw: any): Settings {
  const d = structuredClone(DEFAULT_SETTINGS)
  if (!raw || typeof raw !== 'object') return d
  const out: Settings = { ...d, ...raw, halls: { ...d.halls, ...(raw.halls || {}) }, equip: { ...d.equip, ...(raw.equip || {}) } }
  const l = raw.loyalty || {}
  out.loyalty = { ...d.loyalty, ...l, levels: Array.isArray(l.levels) && l.levels.length ? l.levels : d.loyalty.levels }
  return out
}

export const isNight = (h: number) => h >= 21 || h < 9

export interface QuoteInput { hall: string; start: number; hours: number; guests?: number; equip?: string[]; confetti?: boolean; makeup?: boolean }
export function quote(b: QuoteInput, S: Settings) {
  const lines: [string, number][] = []
  if (!b.hall || !b.hours) return { lines, total: 0 }
  const p = S.halls[b.hall as HallId] ?? 0
  lines.push([`Зал ${hallById(b.hall).name} · ${b.hours} ч`, p * b.hours])
  let nights = 0
  for (let k = 0; k < b.hours; k++) if (isNight((b.start + k) % 24)) nights++
  if (nights) lines.push([`Ночные часы · ${nights} ч`, nights * S.night])
  const extra = Math.max(0, (b.guests ?? 0) - S.freeGuests)
  if (extra) lines.push([`Гости сверх ${S.freeGuests} · ${extra} чел.`, extra * b.hours * S.guest])
  for (const id of b.equip ?? []) {
    const e = EQUIP.find(x => x.id === id)
    if (e) lines.push([`${e.n} · ${b.hours} ч`, (S.equip[id] ?? 0) * b.hours])
  }
  if (b.confetti) lines.push(['Уборка конфетти', S.confetti])
  if (b.makeup) lines.push(['Гримёрка за час до съёмки', 0])
  return { lines, total: lines.reduce((s, l) => s + l[1], 0) }
}

/** Cancellation penalty: <72h — 50%, <24h — 100% */
export function penalty(b: Pick<Booking, 'date' | 'start'>) {
  const st = new Date(b.date + 'T00:00:00'); st.setHours(b.start, 0, 0, 0)
  const h = (st.getTime() - Date.now()) / 36e5
  return { pct: h < 24 ? 100 : h < 72 ? 50 : 0, h }
}

export function levelFor(value: number, S: Settings): LoyaltyLevel {
  const lv = [...S.loyalty.levels].sort((a, b) => a.from - b.from)
  let best = lv[0] ?? DEFAULT_LEVELS[0]
  for (const l of lv) if (value >= l.from) best = l
  return best
}
export function nextLevel(value: number, S: Settings): LoyaltyLevel | null {
  return [...S.loyalty.levels].sort((a, b) => a.from - b.from).find(l => l.from > value) ?? null
}
