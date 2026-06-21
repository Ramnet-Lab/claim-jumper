import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map as MlMap, Popup, RasterTileSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { buildBaseStyle, IDS } from './baseStyle'
import {
  NEVADA_CENTER,
  NEVADA_DEFAULT_ZOOM,
  BASEMAPS,
  MIN_FETCH_ZOOM,
  BLM_ACTIVE_CLAIMS,
  BLM_EXPIRED_CLAIMS,
  MRDS_SITES,
  NBMG_FAULTS,
  NBMG_CONTACTS,
} from '../config'
import { addClaimsLayers, setActiveClaims, setExpiredClaims, CLAIM_FIELDS } from '../layers/claimsLayers'
import { addMrdsLayer, setMrds, MRDS_FIELDS } from '../layers/mrdsLayer'
import { addLandLayer } from '../layers/landLayer'
import { addGeologyLayer, addMagneticLayer, addHiresReliefLayer } from '../layers/geoContextLayers'
import { addFaultsLayer, setFaults, FAULT_FIELDS } from '../layers/faultsLayer'
import { addContactsLayer, setContacts, CONTACT_FIELDS } from '../layers/contactsLayer'
import { setImageOverlay, clearImageOverlay } from '../layers/imageOverlay'
import { queryEsriBbox, boundsToBbox } from '../data/esriGeojson'
import { mineralWhereClause } from '../data/commodities'
import { queryGeologyAt } from '../data/geology'
import {
  claimPopupHtml,
  mrdsPopupHtml,
  faultPopupHtml,
  geologyPopupHtml,
  contactPopupHtml,
} from '../ui/featurePopup'
import type { AppState } from '../types'
import type { TwiOverlay } from '../config'
import type { Poi } from '../data/pois'
import type { TrackPoint } from '../data/expedition'
import type { FeatureCollection } from 'geojson'

const MRDS_MIN_ZOOM = 7

interface Props {
  state: AppState
  twiOverlay: TwiOverlay | null
  alterationOverlay: TwiOverlay | null
  pois: Poi[]
  computeAt: [number, number] | null
  track: TrackPoint[]
  expeditionActive: boolean
  onContextMenu: (lng: number, lat: number, x: number, y: number) => void
  onPoiClick: (poi: Poi) => void
  onMapReady?: (map: MlMap) => void
  onStatus?: (msg: string) => void
}

export default function MapView({
  state,
  twiOverlay,
  alterationOverlay,
  pois,
  computeAt,
  track,
  expeditionActive,
  onContextMenu,
  onPoiClick,
  onMapReady,
  onStatus,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const twiRef = useRef(twiOverlay)
  twiRef.current = twiOverlay
  const onContextMenuRef = useRef(onContextMenu)
  onContextMenuRef.current = onContextMenu
  const onPoiClickRef = useRef(onPoiClick)
  onPoiClickRef.current = onPoiClick
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const poiMarkersRef = useRef<maplibregl.Marker[]>([])
  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null)
  const startMarkerRef = useRef<maplibregl.Marker | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const readyRef = useRef(false)
  const [ready, setReady] = useState(false)

  // --- create map once ---
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBaseStyle(state.basemap),
      center: NEVADA_CENTER,
      zoom: NEVADA_DEFAULT_ZOOM,
      maxPitch: 75,
      hash: true, // sync map position to URL (#zoom/lat/lng) for shareable links
      attributionControl: { compact: true },
    })
    mapRef.current = map
    ;(window as unknown as { __map?: MlMap }).__map = map // debug handle (console access)
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left')
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left')
    // "Show my location" — live GPS dot + heading, follows you when active.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
    })
    map.addControl(geolocate, 'top-right')
    geolocateRef.current = geolocate

    map.on('load', () => {
      addClaimsLayers(map)
      addMrdsLayer(map)
      // geology + magnetic + hi-res relief context rasters sit at the bottom;
      // land status sits under the claim/fault vectors; contacts/faults under MRDS points
      addLandLayer(map, IDS.activeClaimsFill)
      addMagneticLayer(map, IDS.landLayer)
      addHiresReliefLayer(map, IDS.landLayer)
      addGeologyLayer(map, IDS.landLayer)
      addFaultsLayer(map, IDS.mrdsLayer)
      addContactsLayer(map, IDS.faultsLayer)
      addExpeditionLayers(map)
      if (twiRef.current)
        setImageOverlay(map, IDS.twiSource, IDS.twiLayer, twiRef.current, IDS.activeClaimsFill)
      wirePopups(map, () => stateRef.current)
      applyAllState(map, stateRef.current)
      readyRef.current = true
      setReady(true)
      onMapReady?.(map)
      fetchData()
    })

    map.on('moveend', fetchData)

    // Right-click → open the context menu (save POI / compute / navigate).
    map.on('contextmenu', (e) => {
      const oe = e.originalEvent
      onContextMenuRef.current(e.lngLat.lng, e.lngLat.lat, oe.clientX, oe.clientY)
    })

    return () => {
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- react to state changes ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    applyAllState(map, state)
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // --- react to a new/cleared TWI overlay ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (twiOverlay) {
      setImageOverlay(map, IDS.twiSource, IDS.twiLayer, twiOverlay, IDS.activeClaimsFill)
      applyAllState(map, stateRef.current)
    } else {
      clearImageOverlay(map, IDS.twiSource, IDS.twiLayer)
    }
  }, [twiOverlay])

  // --- react to a new/cleared alteration overlay ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (alterationOverlay) {
      setImageOverlay(
        map,
        IDS.alterationSource,
        IDS.alterationLayer,
        alterationOverlay,
        IDS.activeClaimsFill,
      )
      applyAllState(map, stateRef.current)
    } else {
      clearImageOverlay(map, IDS.alterationSource, IDS.alterationLayer)
    }
  }, [alterationOverlay])

  // --- pulsing marker at the point currently being computed ---
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (computeAt) dropComputeMarker(map, markerRef, computeAt)
    else {
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [computeAt])

  // --- saved POI markers (click to view/edit) ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    poiMarkersRef.current.forEach((m) => m.remove())
    poiMarkersRef.current = pois.map((poi) => {
      const el = document.createElement('div')
      el.className = 'poi-marker'
      el.title = poi.name
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        onPoiClickRef.current(poi)
      })
      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map)
    })
  }, [pois, ready])

  // --- expedition breadcrumb trace + start marker ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const src = map.getSource(IDS.expeditionSource) as maplibregl.GeoJSONSource | undefined
    src?.setData(buildTrackFC(track))
    // start marker (green) at the first fix
    if (track.length) {
      const start: [number, number] = [track[0].lng, track[0].lat]
      if (startMarkerRef.current) startMarkerRef.current.setLngLat(start)
      else {
        const el = document.createElement('div')
        el.className = 'expedition-start'
        el.title = 'Expedition start'
        startMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(start).addTo(map)
      }
    } else {
      startMarkerRef.current?.remove()
      startMarkerRef.current = null
    }
  }, [track, ready])

  // --- when an expedition starts, switch on the live-location dot + follow ---
  useEffect(() => {
    if (expeditionActive && ready && geolocateRef.current) {
      try {
        geolocateRef.current.trigger()
      } catch {
        /* geolocation needs HTTPS + permission; handled by status elsewhere */
      }
    }
  }, [expeditionActive, ready])

  // --- fetch claims + MRDS for current viewport ---
  function fetchData() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const s = stateRef.current
    const zoom = map.getZoom()
    const bbox = boundsToBbox(map.getBounds())

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const { signal } = ac

    const jobs: Promise<void>[] = []

    if (s.layers.activeClaims.visible && zoom >= MIN_FETCH_ZOOM) {
      jobs.push(
        queryEsriBbox(BLM_ACTIVE_CLAIMS, { bbox, outFields: CLAIM_FIELDS, signal })
          .then((fc) => setActiveClaims(map, fc))
          .catch(swallow),
      )
    } else {
      setActiveClaims(map, { type: 'FeatureCollection', features: [] })
    }

    if (s.layers.expiredClaims.visible && zoom >= MIN_FETCH_ZOOM) {
      jobs.push(
        queryEsriBbox(BLM_EXPIRED_CLAIMS, { bbox, outFields: CLAIM_FIELDS, signal })
          .then((fc) => setExpiredClaims(map, fc))
          .catch(swallow),
      )
    } else {
      setExpiredClaims(map, { type: 'FeatureCollection', features: [] })
    }

    if (s.layers.mrds.visible && zoom >= MRDS_MIN_ZOOM) {
      jobs.push(
        queryEsriBbox(MRDS_SITES, {
          bbox,
          outFields: MRDS_FIELDS,
          where: mineralWhereClause(s.minerals),
          signal,
        })
          .then((fc) => setMrds(map, fc))
          .catch(swallow),
      )
    } else {
      setMrds(map, { type: 'FeatureCollection', features: [] })
    }

    if (s.layers.faults.visible && zoom >= MRDS_MIN_ZOOM) {
      jobs.push(
        queryEsriBbox(NBMG_FAULTS, { bbox, outFields: FAULT_FIELDS, signal })
          .then((fc) => setFaults(map, fc))
          .catch(swallow),
      )
    } else {
      setFaults(map, { type: 'FeatureCollection', features: [] })
    }

    if (s.layers.contacts.visible && zoom >= MRDS_MIN_ZOOM) {
      jobs.push(
        queryEsriBbox(NBMG_CONTACTS, { bbox, outFields: CONTACT_FIELDS, signal })
          .then((fc) => setContacts(map, fc))
          .catch(swallow),
      )
    } else {
      setContacts(map, { type: 'FeatureCollection', features: [] })
    }

    // Stable zoom hint only — no transient "loading" flash on every pan/zoom.
    if (!jobs.length && zoom < MIN_FETCH_ZOOM) {
      onStatus?.(`Zoom in to load claims (≥ z${MIN_FETCH_ZOOM})`)
    } else if (zoom >= MIN_FETCH_ZOOM) {
      onStatus?.('')
    }
  }

  return <div ref={containerRef} className="map-root" />
}

function swallow(err: unknown) {
  if ((err as { name?: string })?.name === 'AbortError') return
  console.warn('feature fetch failed:', err)
}

// --- apply the full app state to the map imperatively ---
function applyAllState(map: MlMap, s: AppState) {
  // basemap
  const src = map.getSource(IDS.basemapSource) as RasterTileSource | undefined
  src?.setTiles([BASEMAPS[s.basemap]])

  // terrain
  if (s.terrain3d) map.setTerrain({ source: IDS.demSource, exaggeration: 1.4 })
  else map.setTerrain(null)

  // geology + magnetic context rasters
  if (map.getLayer(IDS.geologyLayer)) {
    vis(map, IDS.geologyLayer, s.layers.geology.visible)
    map.setPaintProperty(IDS.geologyLayer, 'raster-opacity', s.layers.geology.opacity)
  }
  if (map.getLayer(IDS.magneticLayer)) {
    vis(map, IDS.magneticLayer, s.layers.magnetic.visible)
    map.setPaintProperty(IDS.magneticLayer, 'raster-opacity', s.layers.magnetic.opacity)
  }
  if (map.getLayer(IDS.hiresReliefLayer)) {
    vis(map, IDS.hiresReliefLayer, s.layers.hiresRelief.visible)
    map.setPaintProperty(IDS.hiresReliefLayer, 'raster-opacity', s.layers.hiresRelief.opacity)
  }
  if (map.getLayer(IDS.contactsLayer)) {
    vis(map, IDS.contactsLayer, s.layers.contacts.visible)
    map.setPaintProperty(IDS.contactsLayer, 'line-opacity', s.layers.contacts.opacity)
  }
  if (map.getLayer(IDS.alterationLayer)) {
    vis(map, IDS.alterationLayer, s.layers.alteration.visible)
    map.setPaintProperty(IDS.alterationLayer, 'raster-opacity', s.layers.alteration.opacity)
  }

  // land status (BLM SMA raster)
  if (map.getLayer(IDS.landLayer)) {
    vis(map, IDS.landLayer, s.layers.land.visible)
    map.setPaintProperty(IDS.landLayer, 'raster-opacity', s.layers.land.opacity)
  }

  // faults (NBMG lines)
  if (map.getLayer(IDS.faultsLayer)) {
    vis(map, IDS.faultsLayer, s.layers.faults.visible)
    map.setPaintProperty(IDS.faultsLayer, 'line-opacity', s.layers.faults.opacity)
  }

  // hillshade (opacity slider drives exaggeration strength)
  vis(map, IDS.hillshadeLayer, s.layers.hillshade.visible)
  if (map.getLayer(IDS.hillshadeLayer))
    map.setPaintProperty(IDS.hillshadeLayer, 'hillshade-exaggeration', s.layers.hillshade.opacity)

  // TWI overlay (may not exist until a raster is generated)
  if (map.getLayer(IDS.twiLayer)) {
    vis(map, IDS.twiLayer, s.layers.twi.visible)
    map.setPaintProperty(IDS.twiLayer, 'raster-opacity', s.layers.twi.opacity)
  }

  // active claims
  for (const id of [IDS.activeClaimsFill, IDS.activeClaimsLine])
    vis(map, id, s.layers.activeClaims.visible)
  map.setPaintProperty(IDS.activeClaimsFill, 'fill-opacity', s.layers.activeClaims.opacity * 0.25)
  map.setPaintProperty(IDS.activeClaimsLine, 'line-opacity', s.layers.activeClaims.opacity)

  // expired claims
  for (const id of [IDS.expiredClaimsFill, IDS.expiredClaimsLine])
    vis(map, id, s.layers.expiredClaims.visible)
  map.setPaintProperty(IDS.expiredClaimsFill, 'fill-opacity', s.layers.expiredClaims.opacity * 0.2)
  map.setPaintProperty(IDS.expiredClaimsLine, 'line-opacity', s.layers.expiredClaims.opacity)

  // MRDS
  vis(map, IDS.mrdsLayer, s.layers.mrds.visible)
  map.setPaintProperty(IDS.mrdsLayer, 'circle-opacity', s.layers.mrds.opacity)
}

function vis(map: MlMap, layerId: string, visible: boolean) {
  if (map.getLayer(layerId))
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
}

// Expedition trace: a connecting line + a dot at each 10s GPS ping, drawn on top.
function addExpeditionLayers(map: MlMap) {
  map.addSource(IDS.expeditionSource, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: IDS.expeditionLine,
    type: 'line',
    source: IDS.expeditionSource,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#19e3ff', 'line-width': 2.5, 'line-opacity': 0.6 },
  })
  map.addLayer({
    id: IDS.expeditionDots,
    type: 'circle',
    source: IDS.expeditionSource,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 3.4,
      'circle-color': '#19e3ff',
      'circle-stroke-color': '#06343b',
      'circle-stroke-width': 1,
    },
  })
}

function buildTrackFC(track: TrackPoint[]): FeatureCollection {
  const coords = track.map((p) => [p.lng, p.lat])
  return {
    type: 'FeatureCollection',
    features: [
      ...(coords.length > 1
        ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } }]
        : []),
      ...track.map((p) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      })),
    ],
  }
}

// Pulsing marker shown at the clicked point while wetness computes.
function dropComputeMarker(
  map: MlMap,
  ref: { current: maplibregl.Marker | null },
  lngLat: [number, number],
) {
  ref.current?.remove()
  const el = document.createElement('div')
  el.className = 'twi-marker'
  ref.current = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map)
}

// --- popups ---
function wirePopups(map: MlMap, getState: () => AppState) {
  const popup = new Popup({ closeButton: true, maxWidth: '320px' })

  const bind = (
    layerId: string,
    html: (props: Record<string, unknown>) => string,
  ) => {
    map.on('click', layerId, (e) => {
      const f = e.features?.[0]
      if (!f) return
      popup.setLngLat(e.lngLat).setHTML(html(f.properties as Record<string, unknown>)).addTo(map)
    })
    map.on('mouseenter', layerId, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layerId, () => (map.getCanvas().style.cursor = ''))
  }

  bind(IDS.activeClaimsFill, (p) => claimPopupHtml(p, 'Active'))
  bind(IDS.expiredClaimsFill, (p) => claimPopupHtml(p, 'Expired'))
  bind(IDS.faultsLayer, (p) => faultPopupHtml(p))
  bind(IDS.contactsLayer, (p) => contactPopupHtml(p))
  bind(IDS.mrdsLayer, (p) => mrdsPopupHtml(p))

  // Geology raster isn't a queryable vector layer — identify by point query on click,
  // but only when no vector feature was clicked (those own the popup).
  const vectorLayers = [
    IDS.mrdsLayer,
    IDS.faultsLayer,
    IDS.contactsLayer,
    IDS.activeClaimsFill,
    IDS.expiredClaimsFill,
  ]
  map.on('click', async (e) => {
    if (!getState().layers.geology.visible) return
    const present = vectorLayers.filter((id) => map.getLayer(id))
    if (map.queryRenderedFeatures(e.point, { layers: present }).length) return
    const unit = await queryGeologyAt(e.lngLat.lng, e.lngLat.lat)
    if (unit) popup.setLngLat(e.lngLat).setHTML(geologyPopupHtml(unit)).addTo(map)
  })
}
