import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, BellRing, CalendarPlus, Clock, Wallet, Ban, MoveRight, Inbox, UserPlus, Banknote, Check, Trash2, Volume2, Moon, Smartphone, Monitor, Download, RefreshCw, Globe } from 'lucide-react'
import { useStudio } from '../store'
import { Card, PageHead } from '../common'
import { Switch, Segmented, Empty, toast, cx } from '../../ui/kit'
import { relTime, pad, dLabel, ymd } from '../../lib/format'
import { notifyPermission, requestNotify, systemNotify, nativePlatform, nativeVersion, nativeCheckUpdate, type NotifyPerm } from '../../lib/native'
import { fetchLatest, type AppsLatest } from '../../lib/apps'
import { useNotify, kindsFor, openPath, type NType } from '../notify'

const ICON: Record<NType, typeof Bell> = { site: CalendarPlus, booking: CalendarPlus, remind: Clock, paid: Wallet, cancel: Ban, moved: MoveRight, request: Inbox, client: UserPlus, money: Banknote }
const TONE: Record<NType, string> = { site: 'var(--accent)', booking: 'var(--info)', remind: 'var(--gold)', paid: 'var(--good)', cancel: 'var(--bad)', moved: 'var(--warn)', request: 'var(--info)', client: 'var(--accent)', money: 'var(--good)' }
const LEADS = [15, 30, 60, 120, 180]
const leadLabel = (m: number) => m < 60 ? `${m} мин` : `${m / 60} ч`

export default function Notifications() {
  const me = useStudio(s => s.me)
  const { items, prefs, setPrefs, setType, read, readAll, clear } = useNotify()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [perm, setPerm] = useState<NotifyPerm>(notifyPermission)
  useEffect(() => { const t = setInterval(() => setPerm(notifyPermission()), 3000); return () => clearInterval(t) }, [])
  const unread = items.filter(i => !i.read).length
  const list = tab === 'unread' ? items.filter(i => !i.read) : items
  const groups = useMemo(() => {
    const m = new Map<string, typeof list>()
    for (const i of list) { const d = ymd(new Date(i.at)); m.set(d, [...(m.get(d) ?? []), i]) }
    return [...m.entries()]
  }, [list])
  const kinds = kindsFor(me?.role)

  const allow = async () => {
    const r = await requestNotify(); setPerm(r)
    toast(r === 'granted' ? 'Системные уведомления разрешены' : r === 'unsupported' ? 'Это устройство не поддерживает уведомления' : 'Разрешение не выдано. Включите уведомления для сайта в настройках браузера.', r === 'granted' ? 'ok' : 'info')
  }
  const test = () => {
    const ok = systemNotify('Moloko CRM', 'Так будут выглядеть уведомления', 'p:notify', 'test')
    toast(ok ? 'Тестовое уведомление отправлено' : 'Сначала разрешите уведомления', ok ? 'ok' : 'info')
  }

  return (
    <div>
      <PageHead title="Уведомления" sub={unread ? `${unread} непрочитанных` : 'Все прочитаны'}
        actions={<>
          <button className="btn btn-line h-10" disabled={!unread} onClick={readAll}><Check className="size-4" />Прочитать все</button>
          <button className="btn btn-ghost h-10" disabled={!items.length} onClick={() => { if (confirm('Очистить ленту уведомлений на этом устройстве?')) clear() }}><Trash2 className="size-4" /><span className="hidden sm:inline">Очистить</span></button>
        </>} />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] gap-3 md:gap-4 items-start">
        <Card title="Лента" action={<Segmented value={tab} onChange={setTab} items={[['all', 'Все'], ['unread', `Новые${unread ? ` · ${unread}` : ''}`]]} />} pad={false}>
          {list.length === 0 ? <div className="p-6"><Empty icon={<Bell className="size-6" />} title={tab === 'unread' ? 'Нет непрочитанных' : 'Пока тихо'} text="Здесь появятся новые заявки, оплаты, отмены, переносы и напоминания о съёмках." /></div> : (
            <div className="pb-2">
              {groups.map(([d, arr]) => (
                <div key={d}>
                  <div className="eyebrow px-5 pt-4 pb-1.5">{d === ymd(new Date()) ? 'Сегодня' : dLabel(d)}</div>
                  <AnimatePresence initial={false}>
                    {arr.map((i, k) => {
                      const I = ICON[i.type] ?? Bell
                      return (
                        <motion.button key={i.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ delay: Math.min(k, 8) * .03 }}
                          onClick={() => { read(i.id); openPath(i.open) }}
                          className="w-full text-left flex items-start gap-3 px-5 py-3 hover:bg-[var(--card-2)] transition-colors">
                          <span className="size-10 shrink-0 rounded-2xl grid place-items-center" style={{ background: `color-mix(in oklab, ${TONE[i.type]} 16%, transparent)`, color: TONE[i.type] }}><I className="size-[18px]" /></span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2"><b className={cx('text-[14px] truncate', i.read && 'font-medium')}>{i.title}</b>{!i.read && <span className="size-2 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />}</span>
                            <span className="block text-[13px] leading-snug mt-0.5" style={{ color: 'var(--muted)' }}>{i.body}</span>
                          </span>
                          <span className="text-[11.5px] whitespace-nowrap num pt-0.5" style={{ color: 'var(--muted)' }} title={relTime(i.at)}>{pad(new Date(i.at).getHours())}:{pad(new Date(i.at).getMinutes())}</span>
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-3 md:gap-4">
          <Card title="Доставка" delay={.05}>
            <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: perm === 'granted' ? 'var(--accent-soft)' : 'var(--card-2)' }}>
              {perm === 'granted' ? <BellRing className="size-5 shrink-0" style={{ color: 'var(--accent)' }} /> : <BellOff className="size-5 shrink-0" style={{ color: 'var(--muted)' }} />}
              <div className="flex-1 min-w-0 text-[13.5px] leading-snug">
                <b>{perm === 'granted' ? 'Системные уведомления разрешены' : perm === 'denied' ? 'Уведомления запрещены' : perm === 'unsupported' ? 'Устройство не поддерживает' : 'Нужно разрешение'}</b>
                <div style={{ color: 'var(--muted)' }}>{perm === 'denied' ? 'Разрешите их в настройках браузера или телефона для этого сайта' : 'Приходят, когда CRM открыта или свёрнута'}</div>
              </div>
              {perm === 'granted' ? <button className="btn btn-line h-9 !px-3 text-[13px]" onClick={test}>Проверить</button> : perm !== 'unsupported' && <button className="btn btn-primary h-9 !px-3 text-[13px]" onClick={allow}>Разрешить</button>}
            </div>
            <Row icon={Bell} label="Всплывающие уведомления" hint="Когда CRM свёрнута или открыта другая вкладка"><Switch on={prefs.system} onChange={v => setPrefs({ system: v })} /></Row>
            <Row icon={Volume2} label="Звук" hint="Короткий сигнал при новом событии"><Switch on={prefs.sound} onChange={v => setPrefs({ sound: v })} /></Row>
            <Row icon={Moon} label="Тихие часы" hint={prefs.quiet ? `Без звука и всплывающих с ${pad(prefs.quietFrom)}:00 до ${pad(prefs.quietTo)}:00, лента пополняется` : 'Ночью без звука и всплывающих'}><Switch on={prefs.quiet} onChange={v => setPrefs({ quiet: v })} /></Row>
            {prefs.quiet && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <select className="field" value={prefs.quietFrom} onChange={e => setPrefs({ quietFrom: +e.target.value })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>с {pad(h)}:00</option>)}</select>
                <select className="field" value={prefs.quietTo} onChange={e => setPrefs({ quietTo: +e.target.value })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>до {pad(h)}:00</option>)}</select>
              </div>
            )}
          </Card>

          <Card title="Что присылать" delay={.1}>
            <div className="flex flex-col">
              {kinds.map(k => {
                const I = ICON[k.id]
                return (
                  <div key={k.id}>
                    <Row icon={I} tone={TONE[k.id]} label={k.label} hint={k.hint}><Switch on={prefs.types[k.id]} onChange={v => setType(k.id, v)} label={k.label} /></Row>
                    {k.id === 'remind' && prefs.types.remind && (
                      <div className="flex flex-wrap gap-1.5 pl-11 pb-2">
                        {LEADS.map(m => <button key={m} className="chip !h-8 !text-[12.5px]" aria-pressed={prefs.remindMin === m} onClick={() => setPrefs({ remindMin: m })}>за {leadLabel(m)}</button>)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>Настройки сохраняются на этом устройстве. Свои действия в уведомления не попадают.</div>
          </Card>

          <AppsCard />
        </div>
      </div>
    </div>
  )
}

function Row({ icon: I, label, hint, children, tone }: { icon: typeof Bell; label: string; hint?: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b hairline last:border-0">
      <I className="size-[18px] shrink-0" style={{ color: tone ?? 'var(--muted)' }} />
      <div className="flex-1 min-w-0"><div className="text-[14px] font-medium">{label}</div>{hint && <div className="text-[12.5px] leading-snug" style={{ color: 'var(--muted)' }}>{hint}</div>}</div>
      {children}
    </div>
  )
}

function AppsCard() {
  const [L, setL] = useState<AppsLatest | null>(null)
  useEffect(() => { fetchLatest().then(setL).catch(() => setL(null)) }, [])
  const plat = nativePlatform(), ver = nativeVersion()
  const apps = [
    { id: 'android', icon: Smartphone, title: 'Android', sub: 'Телефон и планшет', a: L?.android },
    { id: 'windows', icon: Monitor, title: 'Windows', sub: 'Компьютер и ноутбук', a: L?.windows },
  ] as const
  return (
    <Card title="Приложения CRM" delay={.15}>
      {plat && <div className="rounded-2xl p-3 mb-3 flex items-center gap-3 text-[13.5px]" style={{ background: 'var(--card-2)' }}>
        <RefreshCw className="size-4 shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="flex-1 min-w-0">Это приложение, версия <b className="num">{ver ?? '—'}</b>. Обновляется само.</span>
        <button className="btn btn-line h-9 !px-3 text-[13px]" onClick={() => nativeCheckUpdate()}>Проверить</button>
      </div>}
      <div className="flex flex-col gap-2">
        {apps.map(x => (
          <a key={x.id} href={x.a?.url} aria-disabled={!x.a} onClick={e => { if (!x.a) { e.preventDefault(); toast('Сборка ещё готовится', 'info') } }}
            className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-[var(--card-2)]" style={{ boxShadow: '0 0 0 1px var(--line)' }}>
            <span className="size-10 rounded-2xl grid place-items-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><x.icon className="size-5" /></span>
            <span className="flex-1 min-w-0"><b className="text-[14px]">{x.title}</b><span className="block text-[12.5px]" style={{ color: 'var(--muted)' }}>{x.sub}{x.a ? ` · ${x.a.version}` : ''}</span></span>
            <Download className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
          </a>
        ))}
        <div className="flex items-start gap-2 text-[12px] mt-1" style={{ color: 'var(--muted)' }}><Globe className="size-3.5 shrink-0 mt-0.5" />Открывают только CRM, без страницы брони. Обновления ставятся сами.</div>
      </div>
    </Card>
  )
}
