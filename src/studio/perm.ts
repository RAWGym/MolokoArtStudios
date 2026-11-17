import type { Role } from '../lib/types'
import type { Page } from './ui'

export const ROLE_LABEL: Record<Role, string> = { owner: 'Владелец', admin: 'Администратор', accountant: 'Бухгалтер', tech: 'Тех. специалист', smm: 'SMM' }
export const ROLE_HINT: Record<Role, string> = {
  owner: 'Всё, включая деньги, команду, настройки и подтверждение запросов',
  admin: 'Брони, клиенты, бонусы, сертификаты. Старые брони и удаление — через запрос владельцу',
  accountant: 'Финансы, движения денег, выписки, сертификаты; брони только просмотр',
  tech: 'Расписание и закрытие залов на обслуживание',
  smm: 'Витрина виджета: залы, фото, видео, объявления; аналитика',
}
export const ROLES: Role[] = ['owner', 'admin', 'accountant', 'tech', 'smm']

const PAGES: Record<Role, Page[]> = {
  owner: ['overview', 'schedule', 'pipeline', 'clients', 'finance', 'analytics', 'loyalty', 'widget', 'messages', 'prices', 'team', 'requests', 'journal'],
  admin: ['overview', 'schedule', 'pipeline', 'clients', 'requests'],
  accountant: ['overview', 'schedule', 'pipeline', 'clients', 'finance', 'journal'],
  tech: ['schedule'],
  smm: ['schedule', 'widget', 'analytics'],
}
export const pagesFor = (r?: Role | null): Page[] => PAGES[r ?? 'admin'] ?? PAGES.admin
export const canPage = (r: Role | undefined | null, p: Page) => pagesFor(r).includes(p)

type Perm = 'book' | 'block' | 'money' | 'clients.write' | 'bonus' | 'certs' | 'settings' | 'widget' | 'deleteAny' | 'editOld' | 'decide' | 'seeMoney'
const P: Record<Role, Perm[]> = {
  owner: ['book', 'block', 'money', 'clients.write', 'bonus', 'certs', 'settings', 'widget', 'deleteAny', 'editOld', 'decide', 'seeMoney'],
  admin: ['book', 'block', 'clients.write', 'bonus', 'certs'],
  accountant: ['money', 'certs', 'seeMoney'],
  tech: ['block'],
  smm: ['widget'],
}
export const can = (r: Role | undefined | null, p: Perm) => !!r && P[r].includes(p)

/** Admins can change bookings from two days ago onward; older ones need the owner */
export const isOld = (date: string) => {
  const d = new Date(); d.setDate(d.getDate() - 2)
  const lim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return date < lim
}
