export type Status = 'new' | 'paid' | 'done' | 'cancelled' | 'block'

export interface Fine { name: string; amount: number; at: string; by?: string }

export interface Booking {
  id: string
  hall: string
  date: string            // YYYY-MM-DD
  start: number           // hour 0..23
  hours: number
  status: Status
  name: string
  phone: string
  phoneNorm: string
  total: number
  bonusUsed: number
  source: string
  demo: boolean
  createdAt: string
  updatedAt?: string
  createdBy?: string | null
  // extra
  guests?: number
  equip?: string[]
  makeup?: boolean
  confetti?: boolean
  pet?: boolean
  kind?: string
  comment?: string
  fines?: Fine[]
  penalty?: number
  payMethod?: string
  paidAt?: string
  paidBy?: string
  doneAt?: string
  cancelledAt?: string
  cancelledBy?: string
  reason?: string
  [k: string]: unknown
}

export interface LoyaltyLevel { id: string; name: string; pct: number; from: number }
export interface Settings {
  halls: Record<string, number>
  night: number
  guest: number
  freeGuests: number
  confetti: number
  equip: Record<string, number>
  loyalty: { enabled: boolean; basis: 'hours' | 'spent'; levels: LoyaltyLevel[]; maxRedeemPct: number; welcome: number }
}

export interface Staff { userId: string; login: string; name: string; role: 'owner' | 'admin'; disabled: boolean; createdAt: string }

export interface ClientRow { phone: string; name: string; note: string; tags: string[]; birthday: string | null; blocked: boolean; createdAt: string }
export interface BonusTx { id: string; phone: string; amount: number; kind: 'accrual' | 'redeem' | 'manual' | 'welcome'; bookingId: string | null; note: string; createdAt: string; createdBy: string | null }
export interface AuditRow { id: number; at: string; actor: string | null; action: string; bookingId: string | null; summary: string }
