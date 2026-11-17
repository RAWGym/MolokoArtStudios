import { useState } from 'react'
import { UserPlus, KeyRound, Power, Crown, ShieldCheck, Database, Trash2, Sparkles, Eye, EyeOff } from 'lucide-react'
import { useStudio } from '../store'
import { Card, PageHead } from '../common'
import { Sheet, Field, Avatar, Segmented, toast, cx } from '../../ui/kit'
import { relTime } from '../../lib/format'
import { fail } from '../msg'
import type { Staff } from '../../lib/types'

export default function Team() {
  const { staff, me, bookings, staffCreate, staffDisable, staffPassword, seedDemo, clearDemo } = useStudio()
  const [add, setAdd] = useState(false)
  const [pw, setPw] = useState<Staff | null>(null)
  const [busy, setBusy] = useState(false)
  const demo = bookings.filter(b => b.demo).length

  const toggle = async (s: Staff) => {
    try { await staffDisable(s.userId, !s.disabled); toast(s.disabled ? `${s.name}: доступ включён` : `${s.name}: доступ отключён`) } catch (e) { fail(e) }
  }

  return (
    <>
      <PageHead title="Команда" sub="Администраторы видят расписание, заявки и клиентов. Деньги, аналитика, прайс и бонусная программа — только у владельцев."
        actions={<button className="btn btn-primary h-10" onClick={() => setAdd(true)}><UserPlus className="size-4" />Добавить</button>} />

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {staff.map((s, i) => (
          <Card key={s.userId} delay={i * .04}>
            <div className={cx('flex items-center gap-3', s.disabled && 'opacity-50')}>
              <Avatar name={s.name} size={48} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] truncate">{s.name}{s.userId === me?.userId && <span className="text-[12px] font-normal" style={{ color: 'var(--muted)' }}> · это вы</span>}</div>
                <div className="text-[13px] num" style={{ color: 'var(--muted)' }}>{s.login}</div>
              </div>
              <span className="pill" style={s.role === 'owner' ? { color: 'var(--gold)', background: 'var(--gold-soft)' } : { color: 'var(--accent)', background: 'var(--accent-soft)' }}>{s.role === 'owner' ? <Crown className="size-3" /> : <ShieldCheck className="size-3" />}{s.role === 'owner' ? 'Владелец' : 'Админ'}</span>
            </div>
            <div className="text-[12px] mt-3" style={{ color: 'var(--faint)' }}>{s.disabled ? 'Доступ отключён' : 'Активен'} · добавлен {relTime(s.createdAt)}</div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-line btn-sm flex-1" onClick={() => setPw(s)}><KeyRound className="size-4" />Пароль</button>
              {s.userId !== me?.userId && <button className="btn btn-line btn-sm flex-1" style={{ color: s.disabled ? 'var(--good)' : 'var(--bad)' }} onClick={() => toggle(s)}><Power className="size-4" />{s.disabled ? 'Включить' : 'Отключить'}</button>}
            </div>
          </Card>
        ))}
      </div>

      <Card title={<span className="flex items-center gap-2"><Database className="size-4" />Демо-данные</span>} className="mt-4 md:mt-6 max-w-2xl" delay={.2}>
        <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>Заполните CRM примерами броней за последний месяц, чтобы посмотреть графики и отчёты. Демо-брони помечены и удаляются одной кнопкой, настоящие данные не трогаются.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn btn-line" disabled={busy} onClick={async () => { setBusy(true); try { const n = await seedDemo(); toast(`Добавлено демо-броней: ${n}`) } catch (e) { fail(e) } finally { setBusy(false) } }}><Sparkles className="size-4" />{busy ? 'Заполняем…' : 'Добавить демо'}</button>
          {demo > 0 && <button className="btn btn-line" style={{ color: 'var(--bad)' }} disabled={busy} onClick={async () => { if (!confirm(`Удалить ${demo} демо-броней?`)) return; setBusy(true); try { const n = await clearDemo(); toast(`Удалено демо-броней: ${n}`) } catch (e) { fail(e) } finally { setBusy(false) } }}><Trash2 className="size-4" />Удалить демо · {demo}</button>}
        </div>
      </Card>

      <AddSheet open={add} onClose={() => setAdd(false)} onCreate={staffCreate} />
      <PwSheet who={pw} onClose={() => setPw(null)} onSave={staffPassword} />
    </>
  )
}

function AddSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (p: { login: string; name: string; password: string; role: 'owner' | 'admin' }) => Promise<void> }) {
  const [name, setName] = useState(''), [login, setLogin] = useState(''), [password, setPassword] = useState(''), [role, setRole] = useState<'admin' | 'owner'>('admin')
  const [busy, setBusy] = useState(false)
  const gen = () => setPassword(Array.from(crypto.getRandomValues(new Uint8Array(8)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''))
  const ok = name.trim() && /^[a-z0-9._-]{3,32}$/.test(login) && password.length >= 6
  const submit = async () => {
    setBusy(true)
    try {
      await onCreate({ login, name: name.trim(), password, role })
      try { await navigator.clipboard.writeText(`Moloko CRM\n${location.origin}/studio\nЛогин: ${login}\nПароль: ${password}`) } catch { /* clipboard unavailable */ }
      toast(`${name.trim()} добавлен(а). Данные для входа скопированы`)
      setName(''); setLogin(''); setPassword(''); setRole('admin'); onClose()
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Новый сотрудник">
      <div className="flex flex-col gap-4 pt-1">
        <Segmented value={role} onChange={setRole} items={[['admin', 'Администратор'], ['owner', 'Владелец']]} className="self-start" />
        <Field label="Имя"><input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Дана" /></Field>
        <Field label="Логин" hint="латиница, цифры, точка или дефис"><input className="field" value={login} onChange={e => setLogin(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} autoCapitalize="off" placeholder="dana" /></Field>
        <Field label="Пароль" hint="минимум 6 символов"><div className="flex gap-2"><input className="field num" value={password} onChange={e => setPassword(e.target.value)} /><button type="button" className="btn btn-line shrink-0" onClick={gen}>Сгенерировать</button></div></Field>
        <button className="btn btn-primary h-12" disabled={!ok || busy} onClick={submit}>{busy ? 'Создаём…' : 'Добавить и скопировать доступ'}</button>
      </div>
    </Sheet>
  )
}

function PwSheet({ who, onClose, onSave }: { who: Staff | null; onClose: () => void; onSave: (id: string, pw: string) => Promise<void> }) {
  const [pw, setPw] = useState(''), [show, setShow] = useState(false), [busy, setBusy] = useState(false)
  return (
    <Sheet open={!!who} onClose={onClose} title={`Новый пароль · ${who?.name ?? ''}`}>
      <div className="flex flex-col gap-4 pt-1">
        <Field label="Пароль" hint="Сотрудник войдёт с ним на всех устройствах"><div className="relative"><input className="field pr-12" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 size-9 grid place-items-center" onClick={() => setShow(!show)} aria-label="Показать">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></Field>
        <button className="btn btn-primary h-12" disabled={pw.length < 6 || busy} onClick={async () => { if (!who) return; setBusy(true); try { await onSave(who.userId, pw); toast('Пароль изменён'); setPw(''); onClose() } catch (e) { fail(e) } finally { setBusy(false) } }}>Сохранить пароль</button>
      </div>
    </Sheet>
  )
}
