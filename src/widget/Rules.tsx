import { Sheet } from '../ui/kit'
import type { Settings } from '../lib/types'
import { money } from '../lib/format'
import { t } from './i18n'

export function RulesSheet({ open, onClose, onAgree, S }: { open: boolean; onClose: () => void; onAgree: () => void; S: Settings }) {
  const rules: [string, string][] = [
    [t('Предоплата 100%'), t('Бронь закрепляется только после оплаты.')],
    [t('Отмена и перенос'), t('Менее чем за 72 часа — удержание 50%, менее чем за 24 часа — 100%.')],
    [t('Студийный час — 55 минут'), t('5 минут администратор готовит зал. Минимум аренды — 1 час.')],
    [t('Время аренды'), t('Начало — забронированное время, окончание — выход из зала.')],
    [t('До {n} человек', { n: S.freeGuests }), t('Включая фотографа и детей. Далее {p}/ч за каждого.', { p: money(S.guest) })],
    [t('Конфетти и хлопушки'), t('Только по согласованию, уборка {p}. В зале GREY запрещены, штраф 20 000 ₸.', { p: money(S.confetti) })],
    [t('Запрещено'), t('Курение, открытый огонь, нетрезвое состояние, съёмка запрещённого законом контента.')],
    [t('Звук'), t('Студия не специализируется на звукозаписи, полной тишины не гарантируем.')],
  ]
  return (
    <Sheet open={open} onClose={onClose} title={t('Правила студии')}>
      <div className="flex flex-col">
        {rules.map(([t, d]) => (
          <div key={t} className="py-3 border-b hairline last:border-0">
            <div className="text-[15px] font-medium">{t}</div>
            <div className="text-[13.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{d}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary w-full mt-5" onClick={onAgree}>{t('Согласен')}</button>
    </Sheet>
  )
}
