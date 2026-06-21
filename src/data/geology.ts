// Point identify against the NBMG geologic-units layer — "what is this colored unit?"

import { NBMG_GEOLOGY_UNITS } from '../config'

export interface GeologyUnit {
  symbol: string // e.g. "Kgr"
  name: string // e.g. "GRANITIC ROCKS"
  age: string // geologicHistory
  lithology: string
  description: string
  unitType: string
}

/** Returns the geologic unit at a lng/lat, or null if none / on error. */
export async function queryGeologyAt(
  lng: number,
  lat: number,
  signal?: AbortSignal,
): Promise<GeologyUnit | null> {
  const params = new URLSearchParams({
    f: 'json',
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'genericSymbolizer,name,description,lithology,geologicHistory,geologicUnitType',
    returnGeometry: 'false',
    resultRecordCount: '1',
  })
  try {
    const res = await fetch(`${NBMG_GEOLOGY_UNITS}/query?${params}`, { signal })
    if (!res.ok) return null
    const data = await res.json()
    const a = data?.features?.[0]?.attributes
    if (!a) return null
    return {
      symbol: a.genericSymbolizer ?? '',
      name: a.name ?? 'Unknown unit',
      age: a.geologicHistory ?? '',
      lithology: a.lithology ?? '',
      description: a.description ?? '',
      unitType: a.geologicUnitType ?? '',
    }
  } catch {
    return null
  }
}
