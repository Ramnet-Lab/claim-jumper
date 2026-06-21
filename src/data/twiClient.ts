// Client for the on-demand compute backends (pipeline/server.py via Vite proxy):
// TWI wetness and Sentinel-2 alteration. Both share the same request/response shape.

import { TWI_API, ALTERATION_API, type ImageCoords } from '../config'

export interface ComputeResult {
  url: string
  coordinates: ImageCoords
  center: [number, number]
  radius_miles: number
  seconds: number
  // alteration only:
  datetime?: string
  cloud?: number
  scene?: string
  scenes?: number
  coverage_pct?: number
}

export type ComputeResponse =
  | { ok: true; result: ComputeResult }
  | { ok: false; error: string }

async function postCompute(
  endpoint: string,
  lng: number,
  lat: number,
  radiusMiles: number,
  signal?: AbortSignal,
): Promise<ComputeResponse> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lng, lat, radius_miles: radiusMiles }),
      signal,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 502 || res.status === 504)
        return { ok: false, error: 'compute backend not running — start pipeline/server.py' }
      return { ok: false, error: body?.error ?? `compute failed (${res.status})` }
    }
    return { ok: true, result: body as ComputeResult }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError')
      return { ok: false, error: 'cancelled' }
    return { ok: false, error: 'compute backend not reachable — start pipeline/server.py' }
  }
}

/** Wetness (TWI) overlay for a radius around a clicked point. */
export const requestTwi = (lng: number, lat: number, r: number, s?: AbortSignal) =>
  postCompute(TWI_API, lng, lat, r, s)

/** Sentinel-2 alteration overlay for a radius around a clicked point. */
export const requestAlteration = (lng: number, lat: number, r: number, s?: AbortSignal) =>
  postCompute(ALTERATION_API, lng, lat, r, s)
