import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Toasts } from './ui/kit'

const Widget = lazy(() => import('./widget/Widget'))
const Studio = lazy(() => import('./studio/Studio'))
const Invite = lazy(() => import('./widget/Invite'))

const isStudio = /^\/studio/.test(location.pathname)
const invite = location.pathname.match(/^\/i\/([0-9a-f-]{36})\/?$/i)?.[1]

function Boot() {
  return <div className="min-h-dvh grid place-items-center"><div className="size-10 rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent)] animate-spin" /></div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<Boot />}>{isStudio ? <Studio /> : invite ? <Invite id={invite} /> : <Widget />}</Suspense>
    <Toasts />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
