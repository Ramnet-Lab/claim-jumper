import type { AppState, LayerKey, LayerState } from '../types'
import type { BasemapKey } from '../config'
import { TWI_RADIUS_MILES } from '../config'
import type { RightClickMode } from '../App'

const LAYER_META: { key: LayerKey; label: string; hint?: string }[] = [
  { key: 'geology', label: 'Geology (intrusions / volcanics)' },
  { key: 'contacts', label: 'Contacts (formation boundaries)' },
  { key: 'magnetic', label: 'Magnetic anomaly' },
  { key: 'land', label: 'Land status (BLM / private)' },
  { key: 'restricted', label: '⚠ Restricted areas (refuge/wilderness)' },
  { key: 'hillshade', label: 'Hillshade / relief', hint: 'slider = strength' },
  { key: 'hiresRelief', label: 'Hi-res hillshade (3DEP)' },
  { key: 'twi', label: 'Wetness heatmap (TWI)' },
  { key: 'alteration', label: 'Alteration (Sentinel-2)' },
  { key: 'activeClaims', label: 'Active claims' },
  { key: 'expiredClaims', label: 'Expired / closed claims' },
  { key: 'faults', label: 'Fault lines (NV Quaternary)' },
  { key: 'mrds', label: 'MRDS mineral sites' },
]

// On-demand layers computed by right-click.
const ONDEMAND: Record<string, RightClickMode> = { twi: 'twi', alteration: 'alteration' }

interface Props {
  state: AppState
  hasTwi: boolean
  hasAlteration: boolean
  computing: boolean
  onBasemap: (b: BasemapKey) => void
  onTerrain: (on: boolean) => void
  onLayer: (key: LayerKey, patch: Partial<LayerState>) => void
  onClearTwi: () => void
  onClearAlteration: () => void
}

export default function LayerPanel({
  state,
  hasTwi,
  hasAlteration,
  computing,
  onBasemap,
  onTerrain,
  onLayer,
  onClearTwi,
  onClearAlteration,
}: Props) {
  const hasOverlay = (k: string) => (k === 'twi' ? hasTwi : hasAlteration)
  const clearOverlay = (k: string) => (k === 'twi' ? onClearTwi() : onClearAlteration())

  return (
    <section className="panel-section">
      <h3>Basemap</h3>
      <div className="seg">
        <button className={state.basemap === 'topo' ? 'active' : ''} onClick={() => onBasemap('topo')}>
          Topo
        </button>
        <button
          className={state.basemap === 'imagery' ? 'active' : ''}
          onClick={() => onBasemap('imagery')}
        >
          Imagery
        </button>
      </div>

      <label className="row-check">
        <input type="checkbox" checked={state.terrain3d} onChange={(e) => onTerrain(e.target.checked)} />
        <span>3D terrain (tilt with right-drag)</span>
      </label>

      <small className="muted block">
        💡 Right-click the map for actions: save a spot, compute wetness/alteration
        ({TWI_RADIUS_MILES}-mi radius), or navigate. {computing && <span className="spin">⏳ computing…</span>}
      </small>

      <h3>Layers</h3>
      {LAYER_META.map(({ key, label, hint }) => {
        const ls = state.layers[key]
        const onDemand = ONDEMAND[key]
        const disabled = Boolean(onDemand) && !hasOverlay(key)
        return (
          <div className="layer-row" key={key}>
            <label className="row-check">
              <input
                type="checkbox"
                checked={ls.visible}
                disabled={disabled}
                onChange={(e) => onLayer(key, { visible: e.target.checked })}
              />
              <span>{label}</span>
              {onDemand && hasOverlay(key) && (
                <button className="link-btn" onClick={() => clearOverlay(key)} title="Remove overlay">
                  ✕
                </button>
              )}
            </label>
            <input
              className="opacity"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ls.opacity}
              disabled={disabled || !ls.visible}
              onChange={(e) => onLayer(key, { opacity: Number(e.target.value) })}
              title={hint ?? 'opacity'}
            />
            {onDemand && !hasOverlay(key) && (
              <small className="muted">right-click map → compute</small>
            )}
          </div>
        )
      })}
    </section>
  )
}
