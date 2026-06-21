import { useCallback, useEffect, useRef, useState } from 'react'
import type { Map as MlMap } from 'maplibre-gl'

import MapView from './map/MapView'
import LayerPanel from './ui/LayerPanel'
import MineralFilter from './ui/MineralFilter'
import SearchBox from './ui/SearchBox'
import Legend from './ui/Legend'
import ContextMenu, { type MenuState } from './ui/ContextMenu'
import PoiForm from './ui/PoiForm'
import PoiPanel from './ui/PoiPanel'
import ExpeditionButton from './ui/ExpeditionButton'
import ExpeditionPanel from './ui/ExpeditionPanel'
import {
  loadExpedition,
  saveExpedition,
  loadExpeditions,
  saveExpeditions,
  newExpId,
  defaultExpName,
  boundsOf,
  type Expedition,
  type SavedExpedition,
} from './data/expedition'
import { DEFAULT_STATE } from './types'
import type { AppState, LayerKey, LayerState } from './types'
import type { BasemapKey, TwiOverlay } from './config'
import { NEVADA_BOUNDS, TWI_IMAGE, TWI_RADIUS_MILES, ALTERATION_RADIUS_MILES } from './config'
import { ALL_MINERAL_LABELS } from './data/commodities'
import { requestTwi, requestAlteration } from './data/twiClient'
import { loadPois, savePois, newPoiId, type Poi } from './data/pois'
import { deleteImagesForPoi } from './data/poiImages'
import { captureSite } from './data/captureSite'
import {
  fetchExpeditions,
  putExpedition,
  deleteExpeditionRemote,
  fetchPois,
  putPoi,
  deletePoiRemote,
} from './data/sync'

export type RightClickMode = 'twi' | 'alteration'

const INITIAL: AppState = { ...DEFAULT_STATE, minerals: ALL_MINERAL_LABELS }

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL)
  const [status, setStatus] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [twiOverlay, setTwiOverlay] = useState<TwiOverlay | null>(TWI_IMAGE)
  const [alterationOverlay, setAlterationOverlay] = useState<TwiOverlay | null>(null)
  const [computeAt, setComputeAt] = useState<[number, number] | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [pois, setPois] = useState<Poi[]>(() => loadPois())
  const [poiDraft, setPoiDraft] = useState<{ poi: Poi; isNew: boolean } | null>(null)
  const [poiPanelOpen, setPoiPanelOpen] = useState(false)
  const [expedition, setExpedition] = useState<Expedition>(() => loadExpedition())
  const [expeditions, setExpeditions] = useState<SavedExpedition[]>(() => loadExpeditions())
  const [viewedExpId, setViewedExpId] = useState<string | null>(null)
  const [expPanelOpen, setExpPanelOpen] = useState(false)
  const mapRef = useRef<MlMap | null>(null)
  const computeAbortRef = useRef<AbortController | null>(null)

  const setBasemap = (basemap: BasemapKey) => setState((s) => ({ ...s, basemap }))
  const setTerrain = (terrain3d: boolean) => setState((s) => ({ ...s, terrain3d }))
  const setMinerals = (minerals: string[]) => setState((s) => ({ ...s, minerals }))
  const setLayer = (key: LayerKey, patch: Partial<LayerState>) =>
    setState((s) => ({
      ...s,
      layers: { ...s.layers, [key]: { ...s.layers[key], ...patch } },
    }))

  // Compute wetness or alteration in a radius around a point (from the context menu).
  const handleCompute = useCallback(async (mode: RightClickMode, lng: number, lat: number) => {
    computeAbortRef.current?.abort()
    const ac = new AbortController()
    computeAbortRef.current = ac
    const label = mode === 'twi' ? 'wetness' : 'alteration'
    const layerKey: LayerKey = mode === 'twi' ? 'twi' : 'alteration'
    const radius = mode === 'twi' ? TWI_RADIUS_MILES : ALTERATION_RADIUS_MILES
    setComputeAt([lng, lat])
    setStatus(`Computing ${label} (${radius} mi radius)… ~10–40s`)
    const resp =
      mode === 'twi'
        ? await requestTwi(lng, lat, radius, ac.signal)
        : await requestAlteration(lng, lat, radius, ac.signal)
    if (resp.ok) {
      if (mode === 'twi') setTwiOverlay(resp.result)
      else setAlterationOverlay(resp.result)
      setState((s) => ({
        ...s,
        layers: { ...s.layers, [layerKey]: { ...s.layers[layerKey], visible: true } },
      }))
      const extra =
        resp.result.coverage_pct != null
          ? ` · ${resp.result.coverage_pct}% cover, ${resp.result.scenes} scene(s)`
          : ''
      setStatus(`${label[0].toUpperCase() + label.slice(1)} computed in ${resp.result.seconds}s${extra}`)
      setTimeout(() => setStatus((cur) => (cur.includes('computed in') ? '' : cur)), 5000)
    } else if (resp.error !== 'cancelled') {
      setStatus(`${label}: ${resp.error}`)
    }
    setComputeAt(null)
  }, [])

  const handleClearTwi = useCallback(() => {
    setTwiOverlay(null)
    setStatus('')
  }, [])
  const handleClearAlteration = useCallback(() => {
    setAlterationOverlay(null)
    setStatus('')
  }, [])

  // --- POIs (persisted to localStorage) ---
  const persistPois = (next: Poi[]) => {
    setPois(next)
    savePois(next)
  }
  const handleSavePoi = (poi: Poi) => {
    const exists = pois.some((p) => p.id === poi.id)
    persistPois(exists ? pois.map((p) => (p.id === poi.id ? poi : p)) : [...pois, poi])
    void putPoi(poi) // sync to server (cross-device)
    setPoiDraft(null)
  }
  const handleDeletePoi = (id: string) => {
    persistPois(pois.filter((p) => p.id !== id))
    void deletePoiRemote(id)
    void deleteImagesForPoi(id) // drop its photos from IndexedDB too
    setPoiDraft(null)
  }
  const handleCancelPoi = () => {
    // a brand-new POI was never persisted — discard any photos attached during this session
    if (poiDraft?.isNew) void deleteImagesForPoi(poiDraft.poi.id)
    setPoiDraft(null)
  }
  const startNewPoi = (lng: number, lat: number) => {
    const poi: Poi = { id: newPoiId(), lng, lat, name: '', notes: '', created: Date.now() }
    setPoiDraft({ poi, isNew: true })
    // auto-capture geology / land owner / claim, then fold into the draft
    captureSite(lng, lat).then((capture) =>
      setPoiDraft((d) => (d && d.poi.id === poi.id ? { ...d, poi: { ...d.poi, capture } } : d)),
    )
  }
  const flyToPoi = (poi: Poi) => {
    mapRef.current?.flyTo({ center: [poi.lng, poi.lat], zoom: 14, duration: 1200 })
    setPoiPanelOpen(false)
  }

  // --- Expedition GPS tracking (persisted, polled every 10s while active) ---
  useEffect(() => {
    saveExpedition(expedition)
  }, [expedition])

  useEffect(() => {
    if (!expedition.active) return
    if (!('geolocation' in navigator)) {
      setStatus('GPS not available in this browser')
      return
    }
    let cancelled = false
    let wakeLock: WakeLockSentinel | null = null
    const poll = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return
          const { longitude, latitude, accuracy } = pos.coords
          setExpedition((e) =>
            e.active
              ? { ...e, points: [...e.points, { lng: longitude, lat: latitude, t: Date.now(), acc: accuracy }] }
              : e,
          )
        },
        (err) => {
          if (!cancelled) setStatus(`GPS: ${err.message} (needs HTTPS + location permission)`)
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 5000 },
      )
    }
    poll() // immediate first fix
    const id = setInterval(poll, 10000)
    // keep the screen awake during an expedition (best-effort)
    navigator.wakeLock?.request('screen').then(
      (lock) => (wakeLock = lock),
      () => {},
    )
    return () => {
      cancelled = true
      clearInterval(id)
      wakeLock?.release().catch(() => {})
    }
  }, [expedition.active])

  useEffect(() => {
    saveExpeditions(expeditions)
  }, [expeditions])

  // Pull shared data from the server on load + when the tab regains focus, so saved
  // expeditions & POIs follow you across devices. localStorage stays a fast/offline cache.
  useEffect(() => {
    const pull = () => {
      fetchExpeditions().then((list) => {
        if (list) {
          setExpeditions(list)
          saveExpeditions(list)
        }
      })
      fetchPois().then((list) => {
        if (list) {
          setPois(list)
          savePois(list)
        }
      })
    }
    pull()
    window.addEventListener('focus', pull)
    return () => window.removeEventListener('focus', pull)
  }, [])

  const startExpedition = () => {
    setViewedExpId(null)
    setExpedition({ active: true, startedAt: Date.now(), points: [] })
  }
  // Stop = auto-archive the trace into the saved list, then keep it shown.
  const stopExpedition = () => {
    if (expedition.active && expedition.startedAt && expedition.points.length > 0) {
      const saved: SavedExpedition = {
        id: newExpId(),
        name: defaultExpName(expedition.startedAt),
        startedAt: expedition.startedAt,
        endedAt: Date.now(),
        points: expedition.points,
      }
      setExpeditions((list) => [...list, saved])
      void putExpedition(saved) // sync to server (cross-device)
    }
    setExpedition((e) => ({ ...e, active: false }))
  }
  const showExpedition = (exp: SavedExpedition) => {
    setViewedExpId(exp.id)
    const b = boundsOf(exp.points)
    if (b) mapRef.current?.fitBounds(b, { padding: 70, maxZoom: 15, duration: 800 })
    setExpPanelOpen(false)
  }
  const renameExpedition = (id: string, name: string) => {
    setExpeditions((list) => {
      const next = list.map((e) => (e.id === id ? { ...e, name } : e))
      const updated = next.find((e) => e.id === id)
      if (updated) void putExpedition(updated)
      return next
    })
  }
  const deleteExpedition = (id: string) => {
    setExpeditions((list) => list.filter((e) => e.id !== id))
    void deleteExpeditionRemote(id)
    if (viewedExpId === id) setViewedExpId(null)
  }

  // What the map draws: a viewed saved trace, else the current/just-finished one.
  const viewedExp = viewedExpId ? expeditions.find((e) => e.id === viewedExpId) : null
  const shownTrack = viewedExp ? viewedExp.points : expedition.points

  // Free OpenStreetMap (Nominatim) geocoding, biased to Nevada/US.
  const handleSearch = useCallback(async (query: string): Promise<boolean> => {
    const [w, s, e, n] = NEVADA_BOUNDS
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'us',
      viewbox: `${w},${n},${e},${s}`,
    })
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'en' },
      })
      const hits = (await res.json()) as { lat: string; lon: string }[]
      if (!hits.length) return false
      const { lat, lon } = hits[0]
      mapRef.current?.flyTo({ center: [Number(lon), Number(lat)], zoom: 12, duration: 1500 })
      return true
    } catch {
      return false
    }
  }, [])

  return (
    <div className="app">
      <MapView
        state={state}
        twiOverlay={twiOverlay}
        alterationOverlay={alterationOverlay}
        pois={pois}
        computeAt={computeAt}
        track={shownTrack}
        expeditionActive={expedition.active}
        onContextMenu={(lng, lat, x, y) => setMenu({ lng, lat, x, y })}
        onPoiClick={(poi) => setPoiDraft({ poi, isNew: false })}
        onMapReady={(m) => (mapRef.current = m)}
        onStatus={setStatus}
      />

      <header className="topbar">
        <button className="panel-toggle" onClick={() => setPanelOpen((o) => !o)} title="Toggle panel">
          ☰
        </button>
        <div className="brand">⛏️ Claim Jumper</div>
        <SearchBox onSearch={handleSearch} />
        {status && <div className="status">{status}</div>}
        <ExpeditionButton
          expedition={expedition}
          savedCount={expeditions.length}
          onStart={startExpedition}
          onStop={stopExpedition}
          onOpenList={() => setExpPanelOpen(true)}
        />
        <button className="spots-btn" onClick={() => setPoiPanelOpen(true)} title="Saved spots">
          📍 Spots {pois.length > 0 && <span className="spots-count">{pois.length}</span>}
        </button>
      </header>

      {panelOpen && (
        <aside className="panel">
          <p className="tagline">Nevada gold &amp; mineral prospecting — open data, no keys.</p>
          <LayerPanel
            state={state}
            hasTwi={Boolean(twiOverlay)}
            hasAlteration={Boolean(alterationOverlay)}
            computing={Boolean(computeAt)}
            onBasemap={setBasemap}
            onTerrain={setTerrain}
            onLayer={setLayer}
            onClearTwi={handleClearTwi}
            onClearAlteration={handleClearAlteration}
          />
          <MineralFilter selected={state.minerals} onChange={setMinerals} />
          <Legend />
          <p className="disclaimer">
            Advisory data only. Land-status &amp; claim boundaries are generalized (not a legal
            survey or parcel map) and private inholdings may be missing or imprecise. Always
            confirm ownership and access with the BLM and county records before entering land,
            prospecting, or staking — don&apos;t rely on this to avoid trespassing.
          </p>
        </aside>
      )}

      <ContextMenu
        menu={menu}
        onClose={() => setMenu(null)}
        onSavePoi={() => menu && startNewPoi(menu.lng, menu.lat)}
        onComputeWetness={() => menu && handleCompute('twi', menu.lng, menu.lat)}
        onComputeAlteration={() => menu && handleCompute('alteration', menu.lng, menu.lat)}
      />

      <PoiForm
        poi={poiDraft?.poi ?? null}
        isNew={poiDraft?.isNew ?? true}
        onSave={handleSavePoi}
        onDelete={handleDeletePoi}
        onCancel={handleCancelPoi}
      />

      <PoiPanel
        open={poiPanelOpen}
        pois={pois}
        onClose={() => setPoiPanelOpen(false)}
        onFlyTo={flyToPoi}
        onEdit={(poi) => setPoiDraft({ poi, isNew: false })}
        onDelete={handleDeletePoi}
      />

      <ExpeditionPanel
        open={expPanelOpen}
        expeditions={expeditions}
        viewedId={viewedExpId}
        onClose={() => setExpPanelOpen(false)}
        onShow={showExpedition}
        onRename={renameExpedition}
        onDelete={deleteExpedition}
      />
    </div>
  )
}
