// Adds BLM mining-claim layers (active + expired) and updates their data.
// Active = potentially staked ground; Expired/closed = potentially open ground.

import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { IDS } from '../map/baseStyle'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function addClaimsLayers(map: MlMap): void {
  // --- Active (not closed) ---
  map.addSource(IDS.activeClaimsSource, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: IDS.activeClaimsFill,
    type: 'fill',
    source: IDS.activeClaimsSource,
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#e23b3b', 'fill-opacity': 0.18 },
  })
  map.addLayer({
    id: IDS.activeClaimsLine,
    type: 'line',
    source: IDS.activeClaimsSource,
    layout: { visibility: 'none' },
    paint: { 'line-color': '#c01616', 'line-width': 1.4 },
  })

  // --- Expired / closed --- (dashed, muted: "open ground" signal)
  map.addSource(IDS.expiredClaimsSource, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: IDS.expiredClaimsFill,
    type: 'fill',
    source: IDS.expiredClaimsSource,
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#2e8b57', 'fill-opacity': 0.14 },
  })
  map.addLayer({
    id: IDS.expiredClaimsLine,
    type: 'line',
    source: IDS.expiredClaimsSource,
    layout: { visibility: 'none' },
    paint: { 'line-color': '#1f6b40', 'line-width': 1.1, 'line-dasharray': [2, 1.5] },
  })
}

export function setActiveClaims(map: MlMap, data: FeatureCollection): void {
  ;(map.getSource(IDS.activeClaimsSource) as GeoJSONSource | undefined)?.setData(data)
}
export function setExpiredClaims(map: MlMap, data: FeatureCollection): void {
  ;(map.getSource(IDS.expiredClaimsSource) as GeoJSONSource | undefined)?.setData(data)
}

// Fields we request + render in popups.
export const CLAIM_FIELDS = 'CSE_NAME,CSE_NR,CSE_TYPE_NR,CSE_DISP,RCRD_ACRS'
