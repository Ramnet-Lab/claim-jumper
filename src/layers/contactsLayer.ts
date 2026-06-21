// Geologic contacts — crisp formation-boundary lines from the NBMG geologic map.
// Veins and ore shoots commonly localize along these boundaries (+ faults).

import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { IDS } from '../map/baseStyle'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function addContactsLayer(map: MlMap, beforeId?: string): void {
  map.addSource(IDS.contactsSource, { type: 'geojson', data: EMPTY })
  map.addLayer(
    {
      id: IDS.contactsLayer,
      type: 'line',
      source: IDS.contactsSource,
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#2b2218', // dark brown — geologic-map convention for contacts
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 1.4, 16, 2.4],
        'line-opacity': 0.85,
      },
    },
    beforeId,
  )
}

export function setContacts(map: MlMap, data: FeatureCollection): void {
  ;(map.getSource(IDS.contactsSource) as GeoJSONSource | undefined)?.setData(data)
}

export const CONTACT_FIELDS = 'contactType,genericSymbolizer,source'
