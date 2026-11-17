import { Sheet } from '../ui/kit'
import type { Settings } from '../lib/types'
import { money } from '../lib/format'

export function RulesSheet({ open, onClose, onAgree, S }: { open: boolean; onClose: () => void; onAgree: () => void; S: Settings }) {
  const rules: [string, string][] = [
    ['Предоплата 100%', 'Бронь закрепляется только после оплаты.'],
    ['Отмена и перенос', 'Менее чем за 72 часа — удержание 50%, менее чем за 24 часа — 100%.'],
    ['Студийный час — 55 минут', '5 минут администратор готовит зал. Минимум аренды — 1 час.'],
    ['Время аренды', 'Начало — забронированное время, окончание — выход из зала.'],
    [`До ${S.freeGuests} человек`, `Включая фотографа и детей. Далее ${money(S.guest)}/ч за каждого.`],
    ['Конфетти и хлопушки', `Только по согласованию, уборка ${money(S.confetti)}. В зале GREY запрещены, штраф 20 000 ₸.`],
    ['Запрещено', 'Курение, открытый огонь, нетрезвое состояние, съёмка запрещённого законом контента.'],
    ['Звук', 'Студия не специализируется на звукозаписи, полной тишины не гарантируем.'],
  ]
  return (
    <Sheet open={open} onClose={onClose} title="Правила студии">
      <div className="flex flex-col">
        {rules.map(([t, d]) => (
          <div key={t} className="py-3 border-b hairline last:border-0">
            <div className="text-[15px] font-medium">{t}</div>
            <div className="text-[13.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{d}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary w-full mt-5" onClick={onAgree}>Согласен</button>
    </Sheet>
  )
}
