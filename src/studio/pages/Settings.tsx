import { motion } from 'framer-motion'
import { Check, Moon, Sun, MonitorSmartphone, Bell, LifeBuoy, Download } from 'lucide-react'
import { Card, PageHead } from '../common'
import { Segmented, cx } from '../../ui/kit'
import { useTheme, SKINS, type Mode } from '../theme'
import { useUI } from '../ui'

export default function Settings() {
  const { mode, skin, dark, setMode, setSkin } = useTheme()
  const go = useUI(s => s.go)
  return (
    <div>
      <PageHead title="Настройки" sub="Оформление сохраняется на этом устройстве" />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] gap-3 md:gap-4 items-start">
        <Card title="Тема оформления" action={
          <Segmented<Mode> value={mode} onChange={setMode} items={[['dark', <span key="d" className="inline-flex items-center gap-1.5"><Moon className="size-3.5" />Тёмная</span>], ['light', <span key="l" className="inline-flex items-center gap-1.5"><Sun className="size-3.5" />Светлая</span>], ['system', <span key="s" className="inline-flex items-center gap-1.5"><MonitorSmartphone className="size-3.5" />Авто</span>]]} />
        }>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
            {SKINS.map((s, i) => {
              const [bg, ac] = dark ? s.dark : s.light
              const on = skin === s.id
              return (
                <motion.button key={s.id} onClick={() => setSkin(s.id)} aria-pressed={on}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .04 }}
                  className={cx('text-left rounded-[20px] p-1.5 transition-all', on ? 'ring-2 ring-[var(--accent)]' : 'hover:bg-[var(--card-2)]')}>
                  {/* mini preview of the CRM in this theme */}
                  <div className="relative aspect-[4/3] rounded-[15px] overflow-hidden" style={{ background: bg }}>
                    {s.img && <img src={s.img} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-[6px] opacity-60" />}
                    <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${bg} 55%, transparent), color-mix(in oklab, ${bg} 85%, transparent))` }} />
                    <div className="absolute left-2 top-2 bottom-2 w-[18%] rounded-lg" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.6)' }}>
                      <div className="mx-1.5 mt-2 h-1.5 rounded-full" style={{ background: ac }} />
                      {[0, 1, 2].map(k => <div key={k} className="mx-1.5 mt-1.5 h-1 rounded-full" style={{ background: dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)' }} />)}
                    </div>
                    <div className="absolute left-[26%] right-2 top-2 h-[38%] rounded-lg p-1.5" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.6)' }}>
                      <div className="h-1.5 w-1/2 rounded-full" style={{ background: dark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.25)' }} />
                      <div className="mt-1.5 h-3 w-8 rounded-full" style={{ background: ac }} />
                    </div>
                    <div className="absolute left-[26%] right-2 bottom-2 h-[40%] rounded-lg flex items-end gap-1 p-1.5" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.6)' }}>
                      {[40, 70, 55, 90, 65].map((h, k) => <div key={k} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: k === 3 ? ac : `color-mix(in oklab, ${ac} 40%, transparent)` }} />)}
                    </div>
                    {on && <span className="absolute top-1.5 right-1.5 size-6 rounded-full grid place-items-center" style={{ background: ac, color: bg }}><Check className="size-3.5" /></span>}
                  </div>
                  <div className="px-1.5 pt-2 pb-1">
                    <div className="text-[14px] font-semibold">{s.name}</div>
                    <div className="text-[12px] leading-snug" style={{ color: 'var(--muted)' }}>{s.hint}</div>
                  </div>
                </motion.button>
              )
            })}
          </div>
          <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>«Авто» переключает светлую и тёмную тему вместе с телефоном или компьютером. Страница брони для клиентов не меняется.</p>
        </Card>

        <Card title="Ещё" delay={.05}>
          <div className="flex flex-col">
            {([[Bell, 'Уведомления', 'Что присылать, звук, тихие часы', () => go('notify')]] as const).map(([I, l, h, run]) => (
              <button key={l} onClick={run} className="flex items-center gap-3 py-3 text-left border-b hairline last:border-0 hover:opacity-80">
                <I className="size-[18px] shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="flex-1 min-w-0"><span className="block text-[14px] font-medium">{l}</span><span className="block text-[12.5px]" style={{ color: 'var(--muted)' }}>{h}</span></span>
              </button>
            ))}
            <div className="flex items-center gap-3 py-3 text-[12.5px]" style={{ color: 'var(--muted)' }}><LifeBuoy className="size-[18px] shrink-0" />Помощь и сообщение об ошибке: кнопки внизу меню.</div>
            <div className="flex items-center gap-3 py-3 text-[12.5px]" style={{ color: 'var(--muted)' }}><Download className="size-[18px] shrink-0" />Приложения для Android и Windows: «Скачать приложение» в меню.</div>
          </div>
        </Card>
      </div>
    </div>
  )
}
