// Generic ArcGIS REST FeatureServer -> GeoJSON fetcher with bbox filtering + paging.
// Shared by the BLM claim layers and the MRDS layer. No SDK, just fetch().

import type { FeatureCollection } from 'geojson'

export interface BboxQueryOptions {
  /** [west, south, east, north] in lng/lat (EPSG:4326). */
  bbox: [number, number, number, number]
  /** SQL-ish where clause; defaults to '1=1'. */
  where?: string
  /** Comma-separated field list or '*'. */
  outFields?: string
  /** Max features to pull across pages (safety cap). */
  maxFeatures?: number
  /** AbortSignal so stale viewport queries can be cancelled. */
  signal?: AbortSignal
}

const PAGE_SIZE = 2000 // these services cap at 2000 per request

/**
 * Query an ArcGIS FeatureServer layer by bounding box and return GeoJSON.
 * Pages through results until exhausted or maxFeatures reached.
 */
export async function queryEsriBbox(
  serviceUrl: string,
  opts: BboxQueryOptions,
): Promise<FeatureCollection> {
  const { bbox, where = '1=1', outFields = '*', maxFeatures = 6000, signal } = opts

  const collected: FeatureCollection = { type: 'FeatureCollection', features: [] }
  let offset = 0

  while (collected.features.length < maxFeatures) {
    const params = new URLSearchParams({
      f: 'geojson',
      where,
      outFields,
      geometry: bbox.join(','),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      returnGeometry: 'true',
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
    })

    const res = await fetch(`${serviceUrl}/query?${params.toString()}`, { signal })
    if (!res.ok) throw new Error(`Esri query failed (${res.status}) for ${serviceUrl}`)
    const page = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }

    const feats = page.features ?? []
    collected.features.push(...feats)

    // Stop when the service returns a short page (no more data).
    if (feats.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return collected
}

/** Build a bbox tuple from a MapLibre LngLatBounds. */
export function boundsToBbox(b: {
  getWest(): number
  getSouth(): number
  getEast(): number
  getNorth(): number
}): [number, number, number, number] {
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
}
