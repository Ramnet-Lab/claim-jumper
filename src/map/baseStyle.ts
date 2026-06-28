// Builds the initial MapLibre style: USGS topo basemap + Terrarium DEM (for terrain &
// hillshade). All other layers (claims, MRDS, TWI) are added imperatively after load.

import type { StyleSpecification } from 'maplibre-gl'
import { BASEMAPS, TERRARIUM_DEM, type BasemapKey } from '../config'

// Stable source/layer IDs referenced across the app.
export const IDS = {
  basemapSource: 'usgs-basemap',
  basemapLayer: 'usgs-basemap-layer',
  demSource: 'terrarium-dem',
  hillshadeLayer: 'hillshade',
  geologySource: 'nbmg-geology',
  geologyLayer: 'nbmg-geology-layer',
  contactsSource: 'nbmg-contacts',
  contactsLayer: 'nbmg-contacts-layer',
  hiresReliefSource: '3dep-hillshade',
  hiresReliefLayer: '3dep-hillshade-layer',
  alterationSource: 's2-alteration',
  alterationLayer: 's2-alteration-layer',
  magneticSource: 'nbmg-magnetic',
  magneticLayer: 'nbmg-magnetic-layer',
  landSource: 'blm-sma',
  landLayer: 'blm-sma-layer',
  restrictedSource: 'padus-restricted',
  restrictedFill: 'padus-restricted-fill',
  restrictedLine: 'padus-restricted-line',
  faultsSource: 'nbmg-faults',
  faultsLayer: 'nbmg-faults-layer',
  twiSource: 'twi-overlay',
  twiLayer: 'twi-overlay-layer',
  activeClaimsSource: 'active-claims',
  activeClaimsFill: 'active-claims-fill',
  activeClaimsLine: 'active-claims-line',
  expiredClaimsSource: 'expired-claims',
  expiredClaimsFill: 'expired-claims-fill',
  expiredClaimsLine: 'expired-claims-line',
  mrdsSource: 'mrds-sites',
  mrdsLayer: 'mrds-sites-layer',
  expeditionSource: 'expedition',
  expeditionLine: 'expedition-line',
  expeditionDots: 'expedition-dots',
} as const

export function buildBaseStyle(basemap: BasemapKey): StyleSpecification {
  return {
    version: 8,
    // Glyphs needed for any future symbol/text layers (free demotiles glyphs).
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      [IDS.basemapSource]: {
        type: 'raster',
        tiles: [BASEMAPS[basemap]],
        tileSize: 256,
        attribution:
          'USGS The National Map | BLM MLRS | USGS MRDS | Elevation: AWS Terrain Tiles',
        maxzoom: 16,
      },
      [IDS.demSource]: {
        type: 'raster-dem',
        tiles: [TERRARIUM_DEM],
        tileSize: 256,
        encoding: 'terrarium',
        maxzoom: 15,
        attribution: 'Elevation: AWS Terrain Tiles / Mapzen',
      },
    },
    layers: [
      {
        id: IDS.basemapLayer,
        type: 'raster',
        source: IDS.basemapSource,
      },
      {
        // Hillshade renders drainages/relief; starts hidden, toggled via the panel.
        id: IDS.hillshadeLayer,
        type: 'hillshade',
        source: IDS.demSource,
        layout: { visibility: 'none' },
        paint: {
          'hillshade-exaggeration': 0.6,
          'hillshade-shadow-color': '#3a2c1a',
          'hillshade-highlight-color': '#fffaf0',
          'hillshade-accent-color': '#5a4a3a',
        },
      },
    ],
  }
}
