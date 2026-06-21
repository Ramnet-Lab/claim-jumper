// Expedition = a recorded GPS breadcrumb track. Polled every 10s while active and drawn as
// a dotted trace from the start point. Persisted to localStorage so it survives a refresh
// (e.g. the phone screen sleeping) and can resume.

export interface TrackPoint {
  lng: number
  lat: number
  t: number // epoch ms
  acc?: number // accuracy (m)
}

export interface Expedition {
  active: boolean
  startedAt: number | null
  points: TrackPoint[]
}

/** A finished, archived expedition (auto-saved on stop). */
export interface SavedExpedition {
  id: string
  name: string
  startedAt: number
  endedAt: number
  points: TrackPoint[]
}

export const EMPTY_EXPEDITION: Expedition = { active: false, startedAt: null, points: [] }

const KEY = 'claim-jumper.expedition'
const LIST_KEY = 'claim-jumper.expeditions'

export function loadExpeditions(): SavedExpedition[] {
  try {
    const raw = localStorage.getItem(LIST_KEY)
    return raw ? (JSON.parse(raw) as SavedExpedition[]) : []
  } catch {
    return []
  }
}

export function saveExpeditions(list: SavedExpedition[]): void {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function newExpId(): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${performance.now()}`
  return `exp_${rand}`
}

export function defaultExpName(startedAt: number): string {
  return `Expedition · ${new Date(startedAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

/** [[west,south],[east,north]] of a track, or null if empty. */
export function boundsOf(points: TrackPoint[]): [[number, number], [number, number]] | null {
  if (!points.length) return null
  let w = points[0].lng, e = points[0].lng, s = points[0].lat, n = points[0].lat
  for (const p of points) {
    w = Math.min(w, p.lng); e = Math.max(e, p.lng)
    s = Math.min(s, p.lat); n = Math.max(n, p.lat)
  }
  return [[w, s], [e, n]]
}

export function loadExpedition(): Expedition {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Expedition) : EMPTY_EXPEDITION
  } catch {
    return EMPTY_EXPEDITION
  }
}

export function saveExpedition(e: Expedition): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(e))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

const R = 6371000 // earth radius (m)
export function haversine(a: TrackPoint, b: TrackPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const la1 = toRad(a.lat)
  const la2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/** Total track length in meters. */
export function trackMeters(points: TrackPoint[]): number {
  let m = 0
  for (let i = 1; i < points.length; i++) m += haversine(points[i - 1], points[i])
  return m
}

export function formatMiles(meters: number): string {
  return `${(meters / 1609.344).toFixed(2)} mi`
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
