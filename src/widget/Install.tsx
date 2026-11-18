import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Share, SquarePlus, MoreVertical, Download, Check } from 'lucide-react'
import { Sheet, Segmented, Logo } from '../ui/kit'
import { t, useLang } from './i18n'

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: BIPEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach(f => f()) })
  addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()) })
}

export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => { const f = () => force(x => x + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  const standalone = typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
  return {
    installed: standalone,
    canPrompt: !!deferred,
    async prompt() { if (!deferred) return false; await deferred.prompt(); const r = await deferred.userChoice; deferred = null; force(x => x + 1); return r.outcome === 'accepted' },
  }
}
export type InstallApi = ReturnType<typeof useInstall>

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function InstallSheet({ open, onClose, install, title = t('Приложение Moloko'), sub = t('Без App Store — ставится прямо с сайта за 10 секунд') }: { open: boolean; onClose: () => void; install: InstallApi; title?: string; sub?: string }) {
  const [os, setOs] = useState<'ios' | 'android'>(() => (typeof navigator !== 'undefined' && !isIOS() && /Android/i.test(navigator.userAgent) ? 'android' : 'ios'))
  const kk = useLang(s => s.lang) === 'kk'
  const steps = kk ? (os === 'ios'
    ? [[<>Бұл бетті <K>Safari</K> арқылы ашыңыз</>], [<>Экранның төменгі жағындағы <K><Share className="size-3.5" />Бөлісу</K> батырмасын басыңыз</>], [<><K><SquarePlus className="size-3.5" />Басты экранға қосу</K> таңдаңыз</>], [<><K>Қосу</K> басыңыз, дайын</>]]
    : [[<>Бетті <K>Chrome</K> арқылы ашыңыз</>], [<>Жоғарғы оң жақ бұрыштағы <K><MoreVertical className="size-3.5" /></K> басыңыз</>], [<><K><Download className="size-3.5" />Қолданбаны орнату</K> таңдаңыз</>], [<>Растаңыз, белгіше экранда пайда болады</>]])
  : os === 'ios'
    ? [[<>Откройте эту страницу в <K>Safari</K></>], [<>Нажмите <K><Share className="size-3.5" />Поделиться</K> внизу экрана</>], [<>Выберите <K><SquarePlus className="size-3.5" />На экран «Домой»</K></>], [<>Нажмите <K>Добавить</K> — готово</>]]
    : [[<>Откройте страницу в <K>Chrome</K></>], [<>Нажмите <K><MoreVertical className="size-3.5" /></K> в правом верхнем углу</>], [<>Выберите <K><Download className="size-3.5" />Установить приложение</K></>], [<>Подтвердите — иконка появится на экране</>]]
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex items-center gap-4 pt-1">
        <span className="size-16 rounded-[18px] grid place-items-center shrink-0 shadow-lg" style={{ background: '#0D4042' }}><Logo className="w-12" circle="transparent" inner="#FFF9ED" ink="#FFF9ED" sub={false} /></span>
        <div><div className="font-display text-[21px] leading-tight">{title}</div><div className="text-[13.5px] mt-1" style={{ color: 'var(--muted)' }}>{sub}</div></div>
      </div>
      {install.canPrompt ? (
        <button className="btn btn-primary w-full mt-6 h-[52px]" onClick={async () => { if (await install.prompt()) onClose() }}><Download className="size-4" />{t('Установить')}</button>
      ) : (
        <>
          <Segmented className="mt-6" value={os} onChange={setOs} items={[['ios', 'iPhone'], ['android', 'Android']]} />
          <ol className="mt-5 flex flex-col gap-3">
            {steps.map((s, i) => (
              <motion.li key={os + i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .06 }} className="flex items-center gap-3 text-[14.5px]">
                <span className="size-8 rounded-full grid place-items-center shrink-0 text-[13px] font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{i + 1}</span>
                <span className="leading-snug">{s[0]}</span>
              </motion.li>
            ))}
          </ol>
        </>
      )}
      <ul className="mt-6 grid grid-cols-1 gap-2 text-[13.5px]" style={{ color: 'var(--ink-2)' }}>
        {['Открывается как приложение, без адресной строки', 'Бонусы и последняя бронь всегда под рукой', 'Работает даже при слабом интернете'].map(x => <li key={x} className="flex items-center gap-2"><Check className="size-4 shrink-0" style={{ color: 'var(--accent)' }} />{t(x)}</li>)}
      </ul>
      <button className="btn btn-ghost w-full mt-6" onClick={onClose}>{t('Готово')}</button>
    </Sheet>
  )
}

function K({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-[13px] align-middle" style={{ background: 'var(--card-2)' }}>{children}</span>
}
