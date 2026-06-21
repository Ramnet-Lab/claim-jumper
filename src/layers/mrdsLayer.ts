// Adds the USGS MRDS mineral-site point layer, colored by development status.

import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { IDS } from '../map/baseStyle'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

// DEV_STAT -> color. Producers/past producers are the proven ground.
const DEV_STAT_COLORS: Record<string, string> = {
  Producer: '#d62728',
  'Past Producer': '#ff7f0e',
  Prospect: '#1f77b4',
  Occurrence: '#7f7f7f',
  Plant: '#9467bd',
  Unknown: '#bcbd22',
}

export function addMrdsLayer(map: MlMap): void {
  map.addSource(IDS.mrdsSource, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: IDS.mrdsLayer,
    type: 'circle',
    source: IDS.mrdsSource,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 6, 16, 9],
      'circle-color': [
        'match',
        ['get', 'DEV_STAT'],
        'Producer', DEV_STAT_COLORS.Producer,
        'Past Producer', DEV_STAT_COLORS['Past Producer'],
        'Prospect', DEV_STAT_COLORS.Prospect,
        'Occurrence', DEV_STAT_COLORS.Occurrence,
        'Plant', DEV_STAT_COLORS.Plant,
        /* default */ DEV_STAT_COLORS.Unknown,
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-opacity': 0.9,
    },
  })
}

export function setMrds(map: MlMap, data: FeatureCollection): void {
  ;(map.getSource(IDS.mrdsSource) as GeoJSONSource | undefined)?.setData(data)
}

export { DEV_STAT_COLORS }
export const MRDS_FIELDS = 'SITE_NAME,DEV_STAT,CODE_LIST,URL,DEP_ID'
