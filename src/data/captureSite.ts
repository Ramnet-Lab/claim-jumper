// Auto-capture what the map "knows" at a point — rock unit, land owner, and claim status
// — so a saved POI records its geologic/legal context without manual lookup.

import { BLM_ACTIVE_CLAIMS, BLM_SMA_SERVICE } from '../config'
import { queryGeologyAt } from './geology'

export interface SiteCapture {
  geology?: string
  land?: string
  claim?: string
  capturedAt: number
}

async function landOwnerAt(lng: number, lat: number): Promise<string | undefined> {
  // ArcGIS identify needs a map extent + image display; a tiny window around the point works.
  const d = 0.02
  const params = new URLSearchParams({
    f: 'json',
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    tolerance: '2',
    layers: 'all',
    mapExtent: `${lng - d},${lat - d},${lng + d},${lat + d}`,
    imageDisplay: '100,100,96',
    returnGeometry: 'false',
  })
  const res = await fetch(`${BLM_SMA_SERVICE}/identify?${params}`)
  if (!res.ok) return undefined
  const data = await res.json()
  const a = data?.results?.[0]?.attributes
  return a?.ADMIN_UNIT_NAME || a?.ADMIN_AGENCY_CODE || undefined
}

async function claimAt(lng: number, lat: number): Promise<string | undefined> {
  const params = new URLSearchParams({
    f: 'json',
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'CSE_NAME,CSE_NR',
    returnGeometry: 'false',
    resultRecordCount: '1',
  })
  const res = await fetch(`${BLM_ACTIVE_CLAIMS}/query?${params}`)
  if (!res.ok) return undefined
  const data = await res.json()
  const a = data?.features?.[0]?.attributes
  return a ? `On active claim: ${a.CSE_NAME} (${a.CSE_NR})` : 'Open ground (no active claim)'
}

/** Best-effort: run all three lookups in parallel; missing/failed ones are simply omitted. */
export async function captureSite(lng: number, lat: number): Promise<SiteCapture> {
  const [geo, land, claim] = await Promise.allSettled([
    queryGeologyAt(lng, lat),
    landOwnerAt(lng, lat),
    claimAt(lng, lat),
  ])
  const cap: SiteCapture = { capturedAt: Date.now() }
  if (geo.status === 'fulfilled' && geo.value) {
    const u = geo.value
    cap.geology = `${u.name}${u.symbol ? ` (${u.symbol})` : ''}${u.age ? ` · ${u.age}` : ''}`
  }
  if (land.status === 'fulfilled' && land.value) cap.land = land.value
  if (claim.status === 'fulfilled' && claim.value) cap.claim = claim.value
  return cap
}
