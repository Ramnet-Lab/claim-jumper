// Geologic context rasters: NBMG bedrock geology (dynamic export) + aeromagnetic anomaly
// (cached tiles). Both reveal intrusions/structure that point to non-obvious mineralization.

import type { Map as MlMap } from 'maplibre-gl'
import { IDS } from '../map/baseStyle'
import { NBMG_GEOLOGY_EXPORT, NBMG_MAGNETIC_TILES, HILLSHADE_3DEP_EXPORT } from '../config'

/** Bedrock geology overlay (semi-transparent) — granite/volcanic units + contacts. */
export function addGeologyLayer(map: MlMap, beforeId?: string): void {
  map.addSource(IDS.geologySource, {
    type: 'raster',
    tiles: [NBMG_GEOLOGY_EXPORT], // {bbox-epsg-3857} filled per tile
    tileSize: 256,
    maxzoom: 16,
    attribution: 'Geology: NBMG Nevada 1:500k',
  })
  map.addLayer(
    {
      id: IDS.geologyLayer,
      type: 'raster',
      source: IDS.geologySource,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.55 },
    },
    beforeId,
  )
}

/** High-res 3DEP multidirectional hillshade — vein ridges, lineaments, old workings. */
export function addHiresReliefLayer(map: MlMap, beforeId?: string): void {
  map.addSource(IDS.hiresReliefSource, {
    type: 'raster',
    tiles: [HILLSHADE_3DEP_EXPORT], // {bbox-epsg-3857} filled per tile
    tileSize: 256,
    maxzoom: 16,
    attribution: 'Hillshade: USGS 3DEP',
  })
  map.addLayer(
    {
      id: IDS.hiresReliefLayer,
      type: 'raster',
      source: IDS.hiresReliefSource,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.8 },
    },
    beforeId,
  )
}

/** Aeromagnetic anomaly overlay — magnetic highs = buried intrusions/magnetite. */
export function addMagneticLayer(map: MlMap, beforeId?: string): void {
  map.addSource(IDS.magneticSource, {
    type: 'raster',
    tiles: [NBMG_MAGNETIC_TILES],
    tileSize: 256,
    maxzoom: 13,
    attribution: 'Aeromagnetic: NBMG',
  })
  map.addLayer(
    {
      id: IDS.magneticLayer,
      type: 'raster',
      source: IDS.magneticSource,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.6 },
    },
    beforeId,
  )
}
