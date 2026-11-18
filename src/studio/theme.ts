import { create } from 'zustand'

export type Mode = 'dark' | 'light' | 'system'
export type Skin = 'moloko' | 'white' | 'grey' | 'velvet' | 'gold' | 'plain'

/** design themes for the CRM; colors live in index.css under [data-skin] */
export const SKINS: { id: Skin; name: string; hint: string; img?: string; dark: [string, string]; light: [string, string] }[] = [
  { id: 'moloko', name: 'Moloko', hint: 'Изумруд на фоне зала BLACK', img: '/img/black.jpg', dark: ['#12100E', '#93C9C3'], light: ['#EFE6D8', '#3A6367'] },
  { id: 'white', name: 'Белый зал', hint: 'Воздушный, с фото зала WHITE', img: '/img/white.jpg', dark: ['#121414', '#A9D8D2'], light: ['#F4F1EB', '#2F6E6A'] },
  { id: 'grey', name: 'Бетон', hint: 'Строгий графит и сталь', img: '/img/grey.jpg', dark: ['#111214', '#B8C6D2'], light: ['#E9EAEB', '#3F5566'] },
  { id: 'velvet', name: 'Бархат', hint: 'Винный акцент, сцена BLACK', img: '/img/black.jpg', dark: ['#140A0B', '#E59AA2'], light: ['#F3E7E4', '#8E2E3A'] },
  { id: 'gold', name: 'Золото', hint: 'Тёплый, с фото зала BEIGE', img: '/img/beige.jpg', dark: ['#13100B', '#E2C287'], light: ['#F2E9D9', '#8A6424'] },
  { id: 'plain', name: 'Минимал', hint: 'Без фото и размытия, быстрее на слабых устройствах', dark: ['#161514', '#93C9C3'], light: ['#F3F0EA', '#3A6367'] },
]

const read = <T extends string>(k: string, ok: readonly string[], def: T): T => {
  try { const v = localStorage.getItem(k); if (v && ok.includes(v)) return v as T } catch { /* */ }
  return def
}
const sysDark = () => matchMedia('(prefers-color-scheme: dark)').matches
const resolved = (m: Mode) => m === 'system' ? (sysDark() ? 'dark' : 'light') : m

function paint(mode: Mode, skin: Skin) {
  const r = document.documentElement, t = resolved(mode)
  r.dataset.theme = t; r.dataset.skin = skin
  const s = SKINS.find(x => x.id === skin) ?? SKINS[0]
  ;(document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null)?.setAttribute('content', (t === 'dark' ? s.dark : s.light)[0])
}
const withTransition = (f: () => void) => {
  const d = document as Document & { startViewTransition?: (f: () => void) => void }
  if (d.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) d.startViewTransition(f); else f()
}

interface T { mode: Mode; skin: Skin; dark: boolean; setMode(m: Mode): void; setSkin(s: Skin): void; toggle(): void }
export const useTheme = create<T>((set, get) => {
  const mode = read<Mode>('moloko.theme', ['dark', 'light', 'system'], 'dark')
  const skin = read<Skin>('moloko.skin', SKINS.map(s => s.id), 'moloko')
  if (typeof window !== 'undefined') matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    const { mode, skin } = get(); if (mode === 'system') { paint(mode, skin); set({ dark: resolved(mode) === 'dark' }) }
  })
  const save = (m: Mode, s: Skin) => { try { localStorage.setItem('moloko.theme', m); localStorage.setItem('moloko.skin', s) } catch { /* */ } }
  const apply = (m: Mode, s: Skin) => withTransition(() => { paint(m, s); save(m, s); set({ mode: m, skin: s, dark: resolved(m) === 'dark' }) })
  return {
    mode, skin, dark: resolved(mode) === 'dark',
    setMode: m => apply(m, get().skin),
    setSkin: s => apply(get().mode, s),
    toggle: () => apply(get().dark ? 'light' : 'dark', get().skin),
  }
})
