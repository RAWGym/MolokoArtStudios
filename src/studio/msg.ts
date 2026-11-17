import { errCode } from '../lib/supabase'
import { toast } from '../ui/kit'

const TEXT: Record<string, string> = {
  slot_taken: 'Это время в зале уже занято',
  bad_phone: 'Проверьте номер телефона',
  bad_name: 'Укажите имя клиента',
  bad_time: 'Проверьте время брони',
  no_confetti_in_grey: 'В зале GREY конфетти запрещено',
  forbidden: 'Недостаточно прав',
  login_taken: 'Такой логин уже занят',
  weak_password: 'Пароль слишком короткий (минимум 6 символов)',
  bad_login: 'Логин: латиница, цифры, точка или дефис, от 3 символов',
  self: 'Нельзя отключить самого себя',
  network: 'Нет связи с сервером. Проверьте интернет.',
}
export const errText = (e: unknown) => TEXT[errCode(e)] ?? 'Не получилось сохранить. Попробуйте ещё раз.'
export const fail = (e: unknown) => { console.error(e); toast(errText(e), 'err') }
