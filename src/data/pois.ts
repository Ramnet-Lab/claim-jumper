// Saved points of interest — persisted in localStorage (personal, on-device).

import type { SiteCapture } from './captureSite'

export interface Poi {
  id: string
  lng: number
  lat: number
  name: string
  notes: string
  created: number // epoch ms
  capture?: SiteCapture // auto-captured geology / land owner / claim status
}

const KEY = 'claim-jumper.pois'

export function loadPois(): Poi[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Poi[]) : []
  } catch {
    return []
  }
}

export function savePois(pois: Poi[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pois))
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

/** Simple unique id without external deps (no Math.random reliance issues here). */
export function newPoiId(): string {
  return `poi_${Date.now().toString(36)}_${(performance.now() | 0).toString(36)}`
}

/** Google Maps directions link to a point. */
export function googleMapsDir(lng: number, lat: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`
}
