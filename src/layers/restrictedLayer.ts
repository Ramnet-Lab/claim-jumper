// Restricted / protected areas (PAD-US): refuges, wilderness, WSAs, monuments, etc.
// Drawn as a hatched-look warning zone so you don't drive out to a fence.

import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { IDS } from '../map/baseStyle'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function addRestrictedLayer(map: MlMap, beforeId?: string): void {
  map.addSource(IDS.restrictedSource, { type: 'geojson', data: EMPTY })
  map.addLayer(
    {
      id: IDS.restrictedFill,
      type: 'fill',
      source: IDS.restrictedSource,
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#ff6a00', 'fill-opacity': 0.22 },
    },
    beforeId,
  )
  map.addLayer(
    {
      id: IDS.restrictedLine,
      type: 'line',
      source: IDS.restrictedSource,
      layout: { visibility: 'none' },
      paint: { 'line-color': '#c43c00', 'line-width': 1.8, 'line-dasharray': [3, 2] },
    },
    beforeId,
  )
}

export function setRestricted(map: MlMap, data: FeatureCollection): void {
  ;(map.getSource(IDS.restrictedSource) as GeoJSONSource | undefined)?.setData(data)
}

export const RESTRICTED_FIELDS = 'Unit_Nm,Des_Tp,Pub_Access,Mang_Name,Loc_Ds'
