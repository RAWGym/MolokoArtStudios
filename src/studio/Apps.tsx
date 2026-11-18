import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Smartphone, Monitor, Download, Globe, RefreshCw, ShieldCheck } from 'lucide-react'
import { Sheet, toast } from '../ui/kit'
import { APPS_BASE, fetchLatest, type AppsLatest } from '../lib/apps'
import { nativePlatform, nativeVersion, nativeCheckUpdate } from '../lib/native'

const STABLE = { android: `${APPS_BASE}/android/MolokoCRM.apk`, windows: `${APPS_BASE}/windows/MolokoCRM-Setup.exe` }
const mb = (n?: number) => n ? `${(n / 1048576).toFixed(1).replace('.', ',')} МБ` : ''
const guessOs = () => /Android/i.test(navigator.userAgent) ? 'android' : /Windows/i.test(navigator.userAgent) ? 'windows' : null

/** Download buttons for the CRM apps (and update check when already inside one) */
export function AppsList({ compact = false }: { compact?: boolean }) {
  const [L, setL] = useState<AppsLatest | null | undefined>(undefined)
  useEffect(() => { fetchLatest().then(setL).catch(() => setL(null)) }, [])
  const plat = nativePlatform(), ver = nativeVersion(), os = guessOs()
  const apps = [
    { id: 'android' as const, icon: Smartphone, title: 'Android', sub: 'Телефон и планшет', how: 'Откройте файл и разрешите установку из неизвестных источников', a: L?.android },
    { id: 'windows' as const, icon: Monitor, title: 'Windows', sub: 'Компьютер и ноутбук', how: 'Если появится SmartScreen: «Подробнее» → «Выполнить в любом случае»', a: L?.windows },
  ].sort((x, y) => (y.id === os ? 1 : 0) - (x.id === os ? 1 : 0))
  const ready = L !== null
  return (
    <div className="flex flex-col gap-2">
      {plat && <div className="rounded-2xl p-3 flex items-center gap-3 text-[13.5px]" style={{ background: 'var(--card-2)' }}>
        <RefreshCw className="size-4 shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="flex-1 min-w-0">Вы в приложении, версия <b className="num">{ver ?? '—'}</b>. Обновляется само.</span>
        <button className="btn btn-line h-9 !px-3 text-[13px]" onClick={() => nativeCheckUpdate()}>Проверить</button>
      </div>}
      {apps.map((x, i) => (
        <motion.a key={x.id} href={STABLE[x.id]} download initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
          onClick={e => { if (!ready) { e.preventDefault(); toast('Сборка ещё готовится, загляните через пару минут', 'info') } else toast('Скачивание началось') }}
          className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-[var(--card-2)]" style={{ boxShadow: `0 0 0 1px ${x.id === os ? 'var(--accent)' : 'var(--line)'}` }}>
          <span className="size-11 rounded-2xl grid place-items-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><x.icon className="size-5" /></span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2"><b className="text-[14.5px]">{x.title}</b>{x.id === os && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>это устройство</span>}</span>
            <span className="block text-[12.5px]" style={{ color: 'var(--muted)' }}>{x.sub}{x.a ? ` · v${x.a.version} · ${mb(x.a.size)}` : ''}</span>
            {!compact && <span className="block text-[12px] leading-snug mt-1" style={{ color: 'var(--faint)' }}>{x.how}</span>}
          </span>
          <span className="btn btn-primary h-9 !px-3 text-[13px] shrink-0"><Download className="size-4" /><span className="hidden sm:inline">Скачать</span></span>
        </motion.a>
      ))}
      <div className="flex items-start gap-2 text-[12px] mt-1" style={{ color: 'var(--muted)' }}><Globe className="size-3.5 shrink-0 mt-0.5" />Открывают только CRM, без страницы брони. Новые версии ставятся сами.</div>
      {!compact && <div className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--muted)' }}><ShieldCheck className="size-3.5 shrink-0 mt-0.5" />Вход тем же логином и паролем, что и на сайте.</div>}
    </div>
  )
}

export function AppsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Приложение Moloko CRM">
      <p className="text-[14px] mb-4" style={{ color: 'var(--muted)' }}>Отдельное приложение для команды: уведомления о заявках, работа в фоне и автообновление.</p>
      {open && <AppsList />}
    </Sheet>
  )
}
