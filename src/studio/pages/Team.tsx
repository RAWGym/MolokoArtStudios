import { useState } from 'react'
import { UserPlus, KeyRound, Power, Crown, ShieldCheck, Database, Trash2, Sparkles, Eye, EyeOff } from 'lucide-react'
import { useStudio } from '../store'
import { Card, PageHead } from '../common'
import { Sheet, Field, Avatar, toast, cx } from '../../ui/kit'
import { relTime } from '../../lib/format'
import { fail } from '../msg'
import type { Staff, Role } from '../../lib/types'
import { ROLES, ROLE_LABEL, ROLE_HINT } from '../perm'

export default function Team() {
  const { staff, me, bookings, staffCreate, staffDisable, staffPassword, staffRole, seedDemo, clearDemo } = useStudio()
  const [add, setAdd] = useState(false)
  const [pw, setPw] = useState<Staff | null>(null)
  const [busy, setBusy] = useState(false)
  const demo = bookings.filter(b => b.demo).length

  const toggle = async (s: Staff) => {
    try { await staffDisable(s.userId, !s.disabled); toast(s.disabled ? `${s.name}: доступ включён` : `${s.name}: доступ отключён`) } catch (e) { fail(e) }
  }

  const changeRole = async (s: Staff, role: Role) => {
    if (role === s.role) return
    try { await staffRole(s.userId, role); toast(`${s.name}: теперь ${ROLE_LABEL[role].toLowerCase()}`) } catch (e) { fail(e) }
  }

  return (
    <>
      <PageHead title="Команда" sub="У каждой роли свои вкладки и права. Удаление и правка старых броней у администратора идут через запрос владельцу."
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
              <span className="pill" style={s.role === 'owner' ? { color: 'var(--gold)', background: 'var(--gold-soft)' } : { color: 'var(--accent)', background: 'var(--accent-soft)' }}>{s.role === 'owner' ? <Crown className="size-3" /> : <ShieldCheck className="size-3" />}{ROLE_LABEL[s.role] ?? s.role}</span>
            </div>
            <div className="text-[12.5px] mt-3 leading-snug" style={{ color: 'var(--muted)' }}>{ROLE_HINT[s.role]}</div>
            <div className="text-[12px] mt-2" style={{ color: 'var(--faint)' }}>{s.disabled ? 'Доступ отключён' : 'Активен'} · добавлен {relTime(s.createdAt)}</div>
            {s.userId !== me?.userId && <select className="field !h-10 mt-3 !text-[13.5px]" value={s.role} onChange={e => changeRole(s, e.target.value as Role)} aria-label="Роль">{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>}
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

function AddSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (p: { login: string; name: string; password: string; role: Role }) => Promise<void> }) {
  const [name, setName] = useState(''), [login, setLogin] = useState(''), [password, setPassword] = useState(''), [role, setRole] = useState<Role>('admin')
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
        <div><span className="label">Роль</span>
          <div className="grid sm:grid-cols-2 gap-2">{ROLES.map(r => (
            <button key={r} type="button" onClick={() => setRole(r)} className={cx('text-left rounded-2xl p-3 border transition-colors', role === r ? 'border-[var(--accent)]' : 'hairline')} style={{ background: role === r ? 'var(--accent-soft)' : 'var(--card-2)' }}>
              <div className="font-semibold text-[14px]">{ROLE_LABEL[r]}</div><div className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{ROLE_HINT[r]}</div>
            </button>))}</div>
        </div>
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
