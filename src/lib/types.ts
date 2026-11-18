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
  groupId?: string | null
  listTotal?: number
  discount?: number
  ref?: string | null
  account?: string | null
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
  catalog?: { halls: import('./catalog').Hall[]; equip: import('./catalog').Equip[] }
  booking: { open: number; close: number; minHours: number; maxHours: number; daysAhead: number; leadHours: number; nightFrom: number; nightTo: number }
  announcement: { enabled: boolean; title: string; text: string; tone: 'gold' | 'accent' | 'wine'; until?: string }
  referral: { enabled: boolean; friendPct: number; referrerPct: number }
  reviewUrl: string
  templates: { contact: string; remind: string; thanks: string; invite: string }
}

export type Role = 'owner' | 'admin' | 'accountant' | 'tech' | 'smm'
export interface Staff { userId: string; login: string; name: string; role: Role; disabled: boolean; createdAt: string }

export interface ClientRow { phone: string; name: string; note: string; tags: string[]; birthday: string | null; blocked: boolean; createdAt: string; refCode?: string | null; refBy?: string | null }
export interface BonusTx { id: string; phone: string; amount: number; kind: 'accrual' | 'redeem' | 'manual' | 'welcome' | 'referral'; bookingId: string | null; note: string; createdAt: string; createdBy: string | null }
export interface AuditRow { id: number; at: string; actor: string | null; action: string; bookingId: string | null; summary: string }

export interface MoneyRow { id: string; date: string; kind: 'income' | 'expense'; category: string; amount: number; method: string; note: string; bookingId: string | null; certId: string | null; demo: boolean; createdAt: string; createdBy: string | null }
export interface CertUse { at: string; amount: number; hours: number; bookingId?: string | null; by?: string | null }
export interface Cert { id: string; code: string; kind: 'certificate' | 'pass'; title: string; phone: string; name: string; amount: number; hours: number; price: number; uses: CertUse[]; status: 'active' | 'used' | 'expired' | 'void'; expires: string | null; note: string; createdAt: string; createdBy: string | null }
export interface RequestRow { id: string; bookingId: string | null; kind: 'delete' | 'edit' | 'cancel' | 'refund' | 'other'; payload: Record<string, unknown>; note: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string; createdBy: string; decidedAt: string | null; decidedBy: string | null; answer: string }
