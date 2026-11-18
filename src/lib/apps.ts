import { SUPABASE_URL } from './supabase'

/** Installers and the update manifest live in a public Supabase Storage bucket, filled by the GitHub build. */
export const APPS_BASE = `${SUPABASE_URL}/storage/v1/object/public/moloko-apps`
export interface AppBuild { version: string; code: number; url: string; size?: number }
export interface AppsLatest { version: string; code: number; date: string; notes?: string; android?: AppBuild; windows?: AppBuild }

export async function fetchLatest(): Promise<AppsLatest> {
  const r = await fetch(`${APPS_BASE}/latest.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}
