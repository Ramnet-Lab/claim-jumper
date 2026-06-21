// BLM Surface Management Agency (land status) — a cached raster overlay showing who manages
// the ground (BLM, USFS, Private, etc.). Semi-transparent so the basemap shows through.

import type { Map as MlMap } from 'maplibre-gl'
import { IDS } from '../map/baseStyle'
import { BLM_SMA_TILES } from '../config'

/** Add the land-status raster beneath the claim/fault/MRDS layers. */
export function addLandLayer(map: MlMap, beforeId?: string): void {
  map.addSource(IDS.landSource, {
    type: 'raster',
    tiles: [BLM_SMA_TILES],
    tileSize: 256,
    maxzoom: 16,
    attribution: 'BLM Surface Management Agency (SMA)',
  })
  map.addLayer(
    {
      id: IDS.landLayer,
      type: 'raster',
      source: IDS.landSource,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.45 },
    },
    beforeId,
  )
}

// Standard SMA agency colors for the legend (the cached tiles render these server-side).
export const SMA_LEGEND: { label: string; color: string }[] = [
  { label: 'Private / unknown', color: '#ffffff' },
  { label: 'BLM', color: '#f6e072' },
  { label: 'Forest Service', color: '#add6a6' },
  { label: 'Park Service', color: '#c9a0dc' },
  { label: 'Fish & Wildlife', color: '#f3b56b' },
  { label: 'Tribal', color: '#f2a0a0' },
  { label: 'State / other', color: '#a9d3ec' },
]
