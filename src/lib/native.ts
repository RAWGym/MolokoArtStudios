/** Bridge to the Moloko CRM desktop/Android shells. In a normal browser it falls back to web behaviour. */
interface Bridge {
  saveText?: (name: string, mime: string, text: string) => void
  printHtml?: (html: string, title: string) => void
  platform?: () => string
  version?: () => string
  notifyPermission?: () => string
  requestNotify?: () => void
  notify?: (title: string, body: string, path: string) => void
  checkUpdate?: () => void
}
const bridge = (): Bridge | undefined => (window as unknown as { MolokoNative?: Bridge }).MolokoNative

export const IN_APP = typeof navigator !== 'undefined' && /MolokoCRM/.test(navigator.userAgent)
export const nativePlatform = (): string | null => { try { return bridge()?.platform?.() ?? null } catch { return null } }
export const nativeVersion = (): string | null => { try { return bridge()?.version?.() ?? null } catch { return null } }
export const nativeCheckUpdate = (): boolean => { const b = bridge(); if (!b?.checkUpdate) return false; b.checkUpdate(); return true }

export function saveText(name: string, mime: string, text: string) {
  const b = bridge()
  if (b?.saveText) { b.saveText(name, mime, text); return }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Prints a full HTML document (the PDF statement). Returns false when the caller should use its own iframe print. */
export function printHtml(html: string, title: string): boolean {
  const b = bridge()
  if (b?.printHtml) { b.printHtml(html, title); return true }
  return false
}

export type NotifyPerm = 'granted' | 'denied' | 'default' | 'unsupported'

export function notifyPermission(): NotifyPerm {
  const b = bridge()
  if (b?.notifyPermission) { try { return b.notifyPermission() as NotifyPerm } catch { /* fall through */ } }
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission as NotifyPerm
}

export function requestNotify(): Promise<NotifyPerm> {
  const b = bridge()
  if (b?.requestNotify) {
    return new Promise(res => {
      const done = (e: Event) => { removeEventListener('moloko-native-permission', done); res(((e as CustomEvent).detail as NotifyPerm) || notifyPermission()) }
      addEventListener('moloko-native-permission', done)
      b.requestNotify!()
      setTimeout(() => { removeEventListener('moloko-native-permission', done); res(notifyPermission()) }, 30000)
    })
  }
  if (typeof Notification === 'undefined') return Promise.resolve('unsupported')
  return Notification.requestPermission().then(r => r as NotifyPerm)
}

/** Shows a system notification. `path` is handed back to window.__molokoOpen when the person taps it. */
export function systemNotify(title: string, body: string, path: string, tag?: string): boolean {
  const b = bridge()
  if (b?.notify) { try { b.notify(title, body, path); return true } catch { return false } }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  try {
    const n = new Notification(title, { body, tag, icon: '/icons/studio-192.png', badge: '/icons/studio-192.png' })
    n.onclick = () => { window.focus(); (window as unknown as { __molokoOpen?: (p: string) => void }).__molokoOpen?.(path); n.close() }
    return true
  } catch {
    // Chrome on Android only allows notifications through a service worker
    navigator.serviceWorker?.getRegistration?.().then(r => r?.showNotification(title, { body, tag, icon: '/icons/studio-192.png', data: { path } })).catch(() => {})
    return true
  }
}
