import { create } from 'zustand'
import type { Booking } from '../lib/types'
import { store } from '../lib/format'

export type Page = 'overview' | 'schedule' | 'pipeline' | 'clients' | 'finance' | 'analytics' | 'loyalty' | 'widget' | 'messages' | 'prices' | 'team' | 'requests' | 'journal'
export const OWNER_PAGES: Page[] = ['finance', 'analytics', 'loyalty', 'widget', 'messages', 'prices', 'team', 'requests', 'journal']

export type FormPrefill = Partial<Booking> & { mode?: 'booking' | 'block' }

interface UI {
  page: Page
  bookingId: string | null
  clientPhone: string | null
  form: { open: boolean; editId: string | null; prefill: FormPrefill }
  palette: boolean
  more: boolean
  scheduleDate: string | null
  go(p: Page): void
  openBooking(id: string | null): void
  openClient(phone: string | null): void
  newBooking(prefill?: FormPrefill): void
  editBooking(id: string): void
  closeForm(): void
  setPalette(v: boolean): void
  setMore(v: boolean): void
  showDay(date: string): void
}

const initial = (location.hash.slice(1) || store.get<Page>('moloko.page') || 'overview') as Page

export const useUI = create<UI>((set) => ({
  page: initial,
  bookingId: null, clientPhone: null,
  form: { open: false, editId: null, prefill: {} },
  palette: false, more: false, scheduleDate: null,
  go: p => { set({ page: p, more: false }); store.set('moloko.page', p); history.replaceState(null, '', '#' + p); window.scrollTo({ top: 0 }) },
  openBooking: id => set({ bookingId: id }),
  openClient: phone => set({ clientPhone: phone }),
  newBooking: (prefill = {}) => set({ form: { open: true, editId: null, prefill }, bookingId: null }),
  editBooking: id => set({ form: { open: true, editId: id, prefill: {} }, bookingId: null }),
  closeForm: () => set(s => ({ form: { ...s.form, open: false } })),
  setPalette: v => set({ palette: v }),
  setMore: v => set({ more: v }),
  showDay: date => { set({ scheduleDate: date, page: 'schedule', more: false }); history.replaceState(null, '', '#schedule') },
}))
