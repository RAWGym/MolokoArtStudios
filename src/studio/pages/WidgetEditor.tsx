import { useRef, useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { Save, ExternalLink, Megaphone, ImagePlus, Film, Plus, Trash2, ChevronDown, GripVertical, Clock, Sparkles, EyeOff, Upload, X } from 'lucide-react'
import { useStudio } from '../store'
import { Card, PageHead } from '../common'
import { ALL_HALLS, EQUIP, type Hall, type Equip } from '../../lib/catalog'
import { Switch, Field, Segmented, toast, cx } from '../../ui/kit'
import { num, pad } from '../../lib/format'
import { uploadMedia } from '../../lib/supabase'
import { can } from '../perm'
import { fail } from '../msg'
import type { Settings } from '../../lib/types'

const TONES: [Settings['announcement']['tone'], string][] = [['gold', '#DDBB7E'], ['accent', '#3A6367'], ['wine', '#7A2430']]

export default function WidgetEditor() {
  const { S, saveSettings, me, bookings } = useStudio()
  const owner = can(me?.role, 'settings')
  const [halls, setHalls] = useState<(Hall & { price: number })[]>(() => (S.catalog?.halls?.length ? S.catalog.halls : ALL_HALLS).map(h => ({ ...h, price: S.halls[h.id] ?? 20000 })))
  const [equip, setEquip] = useState<(Equip & { price: number })[]>(() => (S.catalog?.equip?.length ? S.catalog.equip : EQUIP).map(e => ({ ...e, price: S.equip[e.id] ?? 0 })))
  const [ann, setAnn] = useState(() => ({ ...S.announcement }))
  const [bk, setBk] = useState(() => ({ ...S.booking }))
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [snap] = useState(() => JSON.stringify({ halls, equip, ann, bk }))
  const dirty = JSON.stringify({ halls, equip, ann, bk }) !== snap
  const setHall = (id: string, p: Partial<Hall & { price: number }>) => setHalls(hs => hs.map(h => h.id === id ? { ...h, ...p } : h))

  const addHall = () => {
    const n = halls.length + 1
    let id = 'hall' + n; while (halls.some(h => h.id === id)) id += 'x'
    setHalls([...halls, { id, name: 'НОВЫЙ ЗАЛ', img: '/img/table.jpg', tone: '#B89B7A', line: '', features: [], enabled: false, price: 20000 }])
    setOpen(id)
  }
  const save = async () => {
    if (halls.some(h => !h.name.trim())) { toast('У каждого зала должно быть название', 'err'); return }
    setBusy(true)
    try {
      const cleanH = halls.map(({ price: _p, ...h }) => ({ ...h, name: h.name.trim().toUpperCase(), features: h.features.filter(Boolean) }))
      const cleanE = equip.filter(e => e.n.trim()).map(({ price: _p, ...e }) => ({ ...e, n: e.n.trim() }))
      await saveSettings({
        ...S, catalog: { halls: cleanH, equip: cleanE }, announcement: ann, booking: bk,
        halls: { ...S.halls, ...Object.fromEntries(halls.map(h => [h.id, h.price])) },
        equip: { ...S.equip, ...Object.fromEntries(equip.map(e => [e.id, e.price])) },
      })
      toast('Виджет обновлён — клиенты уже видят изменения')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHead title="Виджет" sub="Как студия выглядит для клиентов: залы, фото и видео, опции, часы записи и объявление."
        actions={<>
          <a className="btn btn-line h-10" href="/" target="_blank" rel="noopener"><ExternalLink className="size-4" />Открыть виджет</a>
          <button className="btn btn-primary h-10" disabled={!dirty || busy} onClick={save}><Save className="size-4" />{busy ? 'Сохраняем…' : 'Опубликовать'}</button>
        </>} />

      <div className="grid grid-cols-[minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3 md:gap-4 items-start">
        <div className="flex flex-col gap-3 md:gap-4">
          <Card title={<span className="flex items-center gap-2">Залы <span className="text-[12px] font-normal" style={{ color: 'var(--muted)' }}>перетащите, чтобы поменять порядок</span></span>} action={<button className="btn btn-line btn-sm" onClick={addHall}><Plus className="size-4" />Зал</button>}>
            <Reorder.Group axis="y" values={halls} onReorder={setHalls} className="flex flex-col gap-2.5">
              {halls.map(h => (
                <Reorder.Item key={h.id} value={h} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-2)' }}>
                  <div className="flex items-center gap-3 p-2.5">
                    <GripVertical className="size-4 shrink-0 cursor-grab active:cursor-grabbing" style={{ color: 'var(--faint)' }} />
                    <div className="relative size-14 rounded-xl overflow-hidden shrink-0">
                      <img src={h.img} alt="" className={cx('w-full h-full object-cover', h.enabled === false && 'grayscale opacity-50')} />
                      {h.video && <span className="absolute right-1 bottom-1 size-5 grid place-items-center rounded-md bg-black/60 text-white"><Film className="size-3" /></span>}
                    </div>
                    <button className="flex-1 min-w-0 text-left" onClick={() => setOpen(open === h.id ? null : h.id)}>
                      <div className="flex items-center gap-2"><span className="font-semibold tracking-[.06em] truncate">{h.name}</span>{h.enabled === false && <span className="pill pill-block"><EyeOff className="size-3" />скрыт</span>}</div>
                      <div className="text-[12.5px] truncate" style={{ color: 'var(--muted)' }}>{num(h.price)} ₸/час · {h.line || 'без описания'}</div>
                    </button>
                    <Switch on={h.enabled !== false} onChange={v => setHall(h.id, { enabled: v })} label="Показывать в виджете" />
                    <button className="icon-btn !size-9" onClick={() => setOpen(open === h.id ? null : h.id)} aria-label="Редактировать"><ChevronDown className={cx('size-4 transition-transform', open === h.id && 'rotate-180')} /></button>
                  </div>
                  <AnimatePresence initial={false}>
                    {open === h.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .3, ease: [.16, 1, .3, 1] }} className="overflow-hidden">
                        <HallEditor h={h} set={p => setHall(h.id, p)} owner={owner} used={bookings.some(b => b.hall === h.id)} onRemove={() => { setHalls(halls.filter(x => x.id !== h.id)); setOpen(null) }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </Card>

          <Card title="Опции и оборудование" action={owner && <button className="btn btn-line btn-sm" onClick={() => setEquip([...equip, { id: 'opt' + Date.now().toString(36), n: '', d: '', price: 1000 }])}><Plus className="size-4" />Опция</button>}>
            <div className="flex flex-col gap-2">
              {equip.map((e, i) => (
                <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_auto] gap-2 items-center rounded-2xl sm:rounded-none p-2 sm:p-0 bg-[var(--card-3)] sm:bg-transparent">
                  <input className="field !h-11 col-span-2 sm:col-span-1" value={e.n} placeholder="Название" onChange={x => setEquip(equip.map((y, j) => j === i ? { ...y, n: x.target.value } : y))} />
                  <input className="field !h-11 hidden sm:block" value={e.d ?? ''} placeholder="Пояснение" onChange={x => setEquip(equip.map((y, j) => j === i ? { ...y, d: x.target.value } : y))} />
                  <div className="relative"><input className="field !h-11 num pr-12 sm:!w-[120px]" inputMode="numeric" disabled={!owner} value={e.price ? num(e.price) : ''} placeholder="0" onChange={x => setEquip(equip.map((y, j) => j === i ? { ...y, price: +x.target.value.replace(/\D/g, '') || 0 } : y))} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] pointer-events-none" style={{ color: 'var(--muted)' }}>₸/ч</span></div>
                  {owner && <button className="icon-btn !size-10" onClick={() => setEquip(equip.filter((_, j) => j !== i))} aria-label="Удалить опцию"><Trash2 className="size-4" /></button>}
                </div>
              ))}
            </div>
            {!owner && <div className="text-[12.5px] mt-3" style={{ color: 'var(--muted)' }}>Цены меняет владелец.</div>}
          </Card>
        </div>

        <div className="flex flex-col gap-3 md:gap-4 2xl:sticky 2xl:top-24">
          <Card title={<span className="flex items-center gap-2"><Megaphone className="size-4" />Объявление</span>} action={<Switch on={ann.enabled} onChange={v => setAnn({ ...ann, enabled: v })} label="Показывать объявление" />}>
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${TONES.find(t => t[0] === ann.tone)?.[1]}, color-mix(in oklab, ${TONES.find(t => t[0] === ann.tone)?.[1]} 60%, #000))`, color: ann.tone === 'gold' ? '#2a1d08' : '#FFF9ED', opacity: ann.enabled ? 1 : .55 }}>
                <div className="text-[11px] tracking-[.16em] uppercase opacity-75">Так увидят клиенты</div>
                <div className="font-display text-[17px] mt-1">{ann.title || 'Заголовок объявления'}</div>
                <div className="text-[13.5px] mt-1 opacity-90 whitespace-pre-wrap">{ann.text || 'Например: в декабре в BEIGE стоит новогодний декор, бронируйте заранее!'}</div>
              </div>
              <Field label="Заголовок"><input className="field" value={ann.title} maxLength={60} onChange={e => setAnn({ ...ann, title: e.target.value })} placeholder="Новогодний декор уже в студии ✨" /></Field>
              <Field label="Текст"><textarea className="field" rows={3} maxLength={280} value={ann.text} onChange={e => setAnn({ ...ann, text: e.target.value })} /></Field>
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 items-end">
                <Field label="Цвет"><Segmented value={ann.tone} onChange={v => setAnn({ ...ann, tone: v })} items={TONES.map(([k, c]) => [k, <span className="size-3.5 rounded-full block" style={{ background: c }} />])} /></Field>
                <Field label="Показывать до"><input type="date" className="field" value={ann.until ?? ''} onChange={e => setAnn({ ...ann, until: e.target.value || undefined })} /></Field>
              </div>
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Clock className="size-4" />Когда можно записаться</span>}>
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
              <HourSel label="Первый час записи" v={bk.open} set={v => setBk({ ...bk, open: v })} />
              <HourSel label="Студия закрывается" v={bk.close} set={v => setBk({ ...bk, close: v })} max={24} />
              <NumIn label="Мин. часов" v={bk.minHours} set={v => setBk({ ...bk, minHours: Math.max(1, Math.min(12, v)) })} />
              <NumIn label="Макс. часов" v={bk.maxHours} set={v => setBk({ ...bk, maxHours: Math.max(bk.minHours, Math.min(24, v)) })} />
              <NumIn label="Дней вперёд" v={bk.daysAhead} set={v => setBk({ ...bk, daysAhead: Math.max(7, Math.min(180, v)) })} />
              <NumIn label="Не раньше чем за, ч" v={bk.leadHours} set={v => setBk({ ...bk, leadHours: Math.max(0, Math.min(72, v)) })} />
              <HourSel label="Ночной тариф с" v={bk.nightFrom} set={v => setBk({ ...bk, nightFrom: v })} disabled={!owner} />
              <HourSel label="Ночной тариф до" v={bk.nightTo} set={v => setBk({ ...bk, nightTo: v })} disabled={!owner} />
            </div>
            <div className="text-[12.5px] mt-3" style={{ color: 'var(--muted)' }}>{bk.close >= 24 ? 'Студия работает круглосуточно, съёмка может переходить за полночь.' : `Съёмка должна закончиться до ${pad(bk.close)}:00.`}</div>
          </Card>
        </div>
      </div>
      {dirty && (
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+92px)] md:bottom-6 glass !rounded-full flex items-center gap-3 pl-5 pr-1.5 py-1.5" style={{ boxShadow: 'var(--shadow)' }}>
          <span className="text-[13.5px] flex items-center gap-2"><Sparkles className="size-4" style={{ color: 'var(--gold)' }} />Есть неопубликованные изменения</span>
          <button className="btn btn-primary btn-sm h-10" disabled={busy} onClick={save}>Опубликовать</button>
        </motion.div>
      )}
    </>
  )
}

function HallEditor({ h, set, owner, used, onRemove }: { h: Hall & { price: number }; set: (p: Partial<Hall & { price: number }>) => void; owner: boolean; used: boolean; onRemove: () => void }) {
  const [up, setUp] = useState<'img' | 'video' | null>(null)
  const imgIn = useRef<HTMLInputElement>(null), vidIn = useRef<HTMLInputElement>(null)
  const upload = async (f: File | undefined, kind: 'img' | 'video') => {
    if (!f) return
    if (f.size > 50 * 1024 * 1024) { toast('Файл больше 50 МБ — сожмите его, пожалуйста', 'err'); return }
    setUp(kind)
    try { const url = await uploadMedia(f, kind === 'img' ? 'halls' : 'video'); set(kind === 'img' ? { img: url } : { video: url }); toast(kind === 'img' ? 'Фото загружено' : 'Видео загружено') }
    catch (e) { fail(e) } finally { setUp(null) }
  }
  return (
    <div className="px-3 pb-3 pt-1 grid md:grid-cols-[220px_1fr] gap-4">
      <div className="flex flex-col gap-2">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden" style={{ background: 'var(--card-3)' }}>
          {h.video ? <video src={h.video} poster={h.img} className="w-full h-full object-cover" muted loop autoPlay playsInline /> : <img src={h.img} alt="" className="w-full h-full object-cover" />}
          {up && <div className="absolute inset-0 grid place-items-center bg-black/50 text-white text-[13px]"><Upload className="size-5 animate-bounce" />Загружаем…</div>}
        </div>
        <input ref={imgIn} type="file" accept="image/*" hidden onChange={e => upload(e.target.files?.[0], 'img')} />
        <input ref={vidIn} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={e => upload(e.target.files?.[0], 'video')} />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-line btn-sm" disabled={!!up} onClick={() => imgIn.current?.click()}><ImagePlus className="size-4" />Фото</button>
          <button className="btn btn-line btn-sm" disabled={!!up} onClick={() => vidIn.current?.click()}><Film className="size-4" />Видео</button>
        </div>
        {h.video && <button className="text-[12px] flex items-center gap-1 justify-center" style={{ color: 'var(--muted)' }} onClick={() => set({ video: undefined })}><X className="size-3" />убрать видео</button>}
        <div className="text-[11.5px] text-center" style={{ color: 'var(--faint)' }}>Фото вертикальное, от 1080 px. Видео до 50 МБ, 10–20 секунд без звука.</div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
          <Field label="Название"><input className="field uppercase tracking-[.06em]" value={h.name} onChange={e => set({ name: e.target.value })} /></Field>
          <Field label="Цена за час"><input className="field num" inputMode="numeric" disabled={!owner} value={num(h.price)} onChange={e => set({ price: +e.target.value.replace(/\D/g, '') || 0 })} /></Field>
        </div>
        <Field label="Описание"><textarea className="field" rows={2} maxLength={180} value={h.line} onChange={e => set({ line: e.target.value })} /></Field>
        <Field label="Особенности" hint="через запятую, покажутся плашками"><input className="field" value={h.features.join(', ')} onChange={e => set({ features: e.target.value.split(',').map(x => x.trimStart()) })} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-3 rounded-2xl p-3" style={{ background: 'var(--card-3)' }}><span className="text-[14px]">Конфетти запрещено</span><Switch on={!!h.noConfetti} onChange={v => set({ noConfetti: v })} /></label>
          <label className="flex items-center justify-between gap-3 rounded-2xl p-3" style={{ background: 'var(--card-3)' }}><span className="text-[14px]">Цвет зала</span><input type="color" value={h.tone} onChange={e => set({ tone: e.target.value })} className="size-9 rounded-lg bg-transparent cursor-pointer" /></label>
        </div>
        <Field label="Ссылка на фото" hint="если фото уже лежит где-то в интернете"><input className="field !text-[13px]" value={h.img} onChange={e => set({ img: e.target.value })} /></Field>
        {owner && <div className="flex justify-end">
          {used ? <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>По залу есть брони — его можно скрыть, но не удалить.</span>
            : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={onRemove}><Trash2 className="size-4" />Удалить зал</button>}
        </div>}
      </div>
    </div>
  )
}

function HourSel({ label, v, set, max = 23, disabled }: { label: string; v: number; set: (v: number) => void; max?: number; disabled?: boolean }) {
  return <Field label={label}><select className="field" disabled={disabled} value={v} onChange={e => set(+e.target.value)}>{Array.from({ length: max + 1 }, (_, h) => <option key={h} value={h}>{h === 24 ? 'круглосуточно' : `${pad(h)}:00`}</option>)}</select></Field>
}
function NumIn({ label, v, set }: { label: string; v: number; set: (v: number) => void }) {
  return <Field label={label}><input className="field num" inputMode="numeric" value={v} onChange={e => set(+e.target.value.replace(/\D/g, '') || 0)} /></Field>
}
