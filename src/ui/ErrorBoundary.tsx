import { Component, type ReactNode } from 'react'

/** Instead of a blank white page: a calm screen with a reload button (also reloads itself once after a new deploy). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error) {
    // an old tab asking for files of the previous release: reload once to pick up the new one
    if (/dynamically imported module|Failed to fetch|Importing a module script failed|ChunkLoadError/i.test(err.message) && !sessionStorage.getItem('moloko.reloaded')) {
      try { sessionStorage.setItem('moloko.reloaded', '1') } catch { /* private mode */ }
      location.reload()
    }
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <div className="max-w-sm">
          <div className="font-display text-[26px] leading-tight">Что-то пошло не так</div>
          <p className="mt-2 text-[14.5px]" style={{ color: 'var(--muted)' }}>Страница не загрузилась до конца. Обновите её, обычно этого достаточно.</p>
          <button className="btn btn-primary h-12 mt-5 px-6" onClick={() => { try { sessionStorage.removeItem('moloko.reloaded') } catch { /* */ } location.reload() }}>Обновить страницу</button>
        </div>
      </div>
    )
  }
}
