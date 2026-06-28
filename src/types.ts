import type { BasemapKey } from './config'

export type LayerKey =
  | 'geology'
  | 'contacts'
  | 'magnetic'
  | 'land'
  | 'restricted'
  | 'hillshade'
  | 'hiresRelief'
  | 'twi'
  | 'alteration'
  | 'activeClaims'
  | 'expiredClaims'
  | 'faults'
  | 'mrds'

export interface LayerState {
  visible: boolean
  opacity: number // 0..1
}

export interface AppState {
  basemap: BasemapKey
  terrain3d: boolean
  layers: Record<LayerKey, LayerState>
  minerals: string[] // selected mineral group labels
}

export const DEFAULT_STATE: AppState = {
  basemap: 'topo',
  terrain3d: false,
  layers: {
    geology: { visible: false, opacity: 0.55 },
    contacts: { visible: false, opacity: 0.9 },
    magnetic: { visible: false, opacity: 0.6 },
    land: { visible: false, opacity: 0.45 },
    restricted: { visible: false, opacity: 0.4 },
    hillshade: { visible: true, opacity: 0.6 },
    hiresRelief: { visible: false, opacity: 0.8 },
    twi: { visible: false, opacity: 0.7 },
    alteration: { visible: false, opacity: 0.8 },
    activeClaims: { visible: true, opacity: 1 },
    expiredClaims: { visible: false, opacity: 1 },
    faults: { visible: false, opacity: 0.9 },
    mrds: { visible: true, opacity: 0.9 },
  },
  minerals: [], // filled with all labels at init
}
