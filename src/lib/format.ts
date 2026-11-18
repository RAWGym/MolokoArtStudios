export const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const today = () => ymd(new Date())

const nf = new Intl.NumberFormat('ru-RU')
export const money = (n: number) => `${nf.format(Math.round(n || 0))} ₸`
export const num = (n: number) => nf.format(Math.round(n || 0))
export const compact = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} млн` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n))

export const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
export const DOW_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
export const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const MON_S = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const MON_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

/* language for the client widget (CRM stays Russian): the arrays above are swapped in place */
export type Lang = 'ru' | 'kk'
let LANG: Lang = 'ru'
const RU = { DOW: [...DOW], DOW_FULL: [...DOW_FULL], MON: [...MON], MON_S: [...MON_S], MON_NOM: [...MON_NOM] }
const KK = {
  DOW: ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сб'],
  DOW_FULL: ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'],
  MON: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
  MON_S: ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел'],
  MON_NOM: ['Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан'],
}
export const fmtLang = () => LANG
export function setFmtLang(l: Lang) {
  LANG = l
  const src = l === 'kk' ? KK : RU
  DOW.splice(0, 7, ...src.DOW); DOW_FULL.splice(0, 7, ...src.DOW_FULL)
  MON.splice(0, 12, ...src.MON); MON_S.splice(0, 12, ...src.MON_S); MON_NOM.splice(0, 12, ...src.MON_NOM)
}

export function dLabel(s: string, withDow = true) {
  const d = parseYmd(s)
  const t = today(), tm = ymd(addDays(new Date(), 1)), ye = ymd(addDays(new Date(), -1))
  const kk = LANG === 'kk'
  const head = s === t ? (kk ? 'Бүгін' : 'Сегодня') : s === tm ? (kk ? 'Ертең' : 'Завтра') : s === ye ? (kk ? 'Кеше' : 'Вчера') : withDow ? cap(DOW_FULL[d.getDay()]) : ''
  return (head ? head + ', ' : '') + d.getDate() + ' ' + MON[d.getMonth()]
}
export const dShort = (s: string) => { const d = parseYmd(s); return `${d.getDate()} ${MON_S[d.getMonth()]}` }
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const timeRange = (start: number, hours: number) => `${pad(start)}:00–${pad((start + hours - 1) % 24)}:55`
export const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100, b = a % 10
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many
}
export const hoursLabel = (n: number) => LANG === 'kk' ? `${n} сағат` : `${n} ${plural(n, 'час', 'часа', 'часов')}`

export function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  const kk = LANG === 'kk'
  if (s < 60) return kk ? 'жаңа ғана' : 'только что'
  if (s < 3600) return `${Math.floor(s / 60)} ${kk ? 'мин бұрын' : 'мин назад'}`
  if (s < 86400) return `${Math.floor(s / 3600)} ${kk ? 'сағ бұрын' : 'ч назад'}`
  const d = new Date(iso)
  return `${d.getDate()} ${MON_S[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const normPhone = (p: string) => {
  const d = (p || '').replace(/\D/g, '')
  if (/^8\d{10}$/.test(d)) return '7' + d.slice(1)
  if (/^\d{10}$/.test(d)) return '7' + d
  return d
}
/** +7 701 155 55 71 */
export function fmtPhone(p: string) {
  const d = normPhone(p)
  if (d.length === 11 && d[0] === '7') return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`
  return p
}
/** Live mask for an input: +7 (701) 155-55-71 */
export function maskPhone(v: string) {
  let d = v.replace(/\D/g, '')
  if (d.startsWith('8')) d = '7' + d.slice(1)
  if (!d.startsWith('7')) d = '7' + d
  d = d.slice(0, 11)
  const p = d.slice(1)
  let out = '+7'
  if (p.length) out += ' (' + p.slice(0, 3)
  if (p.length >= 3) out += ')'
  if (p.length > 3) out += ' ' + p.slice(3, 6)
  if (p.length > 6) out += '-' + p.slice(6, 8)
  if (p.length > 8) out += '-' + p.slice(8, 10)
  return out
}
export const waLink = (phone: string, text?: string) => `https://wa.me/${normPhone(phone)}${text ? '?text=' + encodeURIComponent(text) : ''}`

export const initials = (name: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'

export const store = {
  get<T = unknown>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null } catch { return null } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } },
  del(k: string) { try { localStorage.removeItem(k) } catch { /* noop */ } },
}
