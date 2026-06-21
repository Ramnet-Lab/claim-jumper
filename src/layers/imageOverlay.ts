// Generic georeferenced-image overlay (used by both the wetness and alteration overlays).
// Adds/updates/removes a MapLibre image source + raster layer for a {url, coordinates}.

import type { Map as MlMap, ImageSource } from 'maplibre-gl'
import type { TwiOverlay } from '../config'

export function setImageOverlay(
  map: MlMap,
  sourceId: string,
  layerId: string,
  overlay: TwiOverlay,
  beforeId?: string,
  opacity = 0.75,
): void {
  const existing = map.getSource(sourceId) as ImageSource | undefined
  if (existing) {
    existing.updateImage({ url: overlay.url, coordinates: overlay.coordinates })
    return
  }
  map.addSource(sourceId, {
    type: 'image',
    url: overlay.url,
    coordinates: overlay.coordinates,
  })
  map.addLayer(
    {
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: { 'raster-opacity': opacity, 'raster-fade-duration': 300 },
    },
    beforeId && map.getLayer(beforeId) ? beforeId : undefined,
  )
}

export function clearImageOverlay(map: MlMap, sourceId: string, layerId: string): void {
  if (map.getLayer(layerId)) map.removeLayer(layerId)
  if (map.getSource(sourceId)) map.removeSource(sourceId)
}
