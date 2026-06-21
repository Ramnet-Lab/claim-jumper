// Nevada Quaternary faults (NBMG) as line features, colored by fault age.

import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { IDS } from '../map/baseStyle'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function addFaultsLayer(map: MlMap, beforeId?: string): void {
  map.addSource(IDS.faultsSource, { type: 'geojson', data: EMPTY })
  map.addLayer(
    {
      id: IDS.faultsLayer,
      type: 'line',
      source: IDS.faultsSource,
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#9b30ff', // distinct purple — not confused with red claim outlines
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.2, 12, 2.6, 16, 4],
        'line-opacity': 0.95,
      },
    },
    beforeId,
  )
}

export function setFaults(map: MlMap, data: FeatureCollection): void {
  ;(map.getSource(IDS.faultsSource) as GeoJSONSource | undefined)?.setData(data)
}

export const FAULT_FIELDS = 'Name,Age,Type,SlipRate,Source'
