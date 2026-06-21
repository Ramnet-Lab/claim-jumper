// Central config: every external endpoint + map defaults live here.
// No API keys anywhere — all sources are free, public, key-free.

export const NEVADA_CENTER: [number, number] = [-116.8, 39.3] // lng, lat
export const NEVADA_DEFAULT_ZOOM = 6
// Approx bounding box of Nevada [west, south, east, north]
export const NEVADA_BOUNDS: [number, number, number, number] = [-120.2, 35.0, -113.9, 42.1]

// --- Basemaps (USGS National Map — free, no key) ---
export const BASEMAPS = {
  topo: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
  imagery:
    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
} as const
export type BasemapKey = keyof typeof BASEMAPS

// --- Terrain / hillshade (AWS Terrarium DEM — free, no key) ---
export const TERRARIUM_DEM =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

// --- BLM mining claims (MLRS, public ArcGIS REST — query as GeoJSON) ---
export const BLM_ACTIVE_CLAIMS =
  'https://gis.blm.gov/nlsdb/rest/services/HUB/BLM_Natl_MLRS_Mining_Claims_Not_Closed/FeatureServer/0'
export const BLM_EXPIRED_CLAIMS =
  'https://gis.blm.gov/nlsdb/rest/services/HUB/BLM_Natl_MLRS_Mining_Claims_Closed/FeatureServer/0'

// --- USGS MRDS mineral sites (compact version, public ArcGIS REST) ---
export const MRDS_SITES =
  'https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Mineral_Resources_Data_System_MRDS_Compact_Version/FeatureServer/0'

// --- BLM Surface Management Agency (land status) — cached tiles incl. Private/Unknown.
// Shows who manages the ground: BLM (yellow), USFS (green), Private (white), etc. — so you
// can avoid trespassing on private land. Web-Mercator tile cache, served as raster XYZ.
export const BLM_SMA_TILES =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_with_PriUnk/MapServer/tile/{z}/{y}/{x}'
// SMA MapServer base — used to identify the land-managing agency at a point.
export const BLM_SMA_SERVICE =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_with_PriUnk/MapServer'

// --- Nevada Quaternary faults (NBMG / Nevada Bureau of Mines & Geology) — GeoJSON lines ---
export const NBMG_FAULTS =
  'https://gisweb.unr.edu/nbmg/rest/services/Geology/Faults/MapServer/1'

// --- NBMG Nevada 1:500k bedrock geology (intrusions/volcanics) — dynamic export raster.
// {bbox-epsg-3857} is filled per-tile by MapLibre. Shows rock units incl. granite ("Kgr")
// and volcanic bodies whose contacts host ore.
export const NBMG_GEOLOGY_EXPORT =
  'https://gisweb.unr.edu/nbmg/rest/services/Geology/NV_500k_Geology/MapServer/export' +
  '?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&dpi=96' +
  '&format=png32&transparent=true&f=image'

// Geologic Units sublayer (id 3) — point-query for click-to-identify popups.
export const NBMG_GEOLOGY_UNITS =
  'https://gisweb.unr.edu/nbmg/rest/services/Geology/NV_500k_Geology/MapServer/3'
// Contacts sublayer (id 1) — crisp formation-boundary lines (where veins localize).
export const NBMG_CONTACTS =
  'https://gisweb.unr.edu/nbmg/rest/services/Geology/NV_500k_Geology/MapServer/1'

// --- USGS 3DEP high-res multidirectional hillshade (1–10 m) — dynamic export raster.
// Sharper than the global terrain tiles: reveals vein ridges, lineaments, old workings.
export const HILLSHADE_3DEP_EXPORT =
  'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage' +
  '?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png' +
  '&renderingRule=%7B%22rasterFunction%22%3A%22Hillshade%20Multidirectional%22%7D&f=image'

// --- NBMG aeromagnetic anomaly (cached tiles) — buried intrusions/structure under cover ---
export const NBMG_MAGNETIC_TILES =
  'https://gisweb.unr.edu/nbmg/rest/services/Geology/MagneticAnomoly/MapServer/tile/{z}/{y}/{x}'

// --- TWI / flow-accumulation wetness overlay ---
// Computed ON DEMAND: right-click the map to compute wetness in TWI_RADIUS_MILES around
// the point (POST to TWI_API, served by pipeline/server.py). TWI_IMAGE below is an optional
// seed overlay shown on first load (here: the prebuilt Round Mountain area).
export const TWI_API = '/api/twi'
export const ALTERATION_API = '/api/alteration'
export const TWI_RADIUS_MILES = 5
// Alteration covers a wider aperture (mosaicked across granules) — bigger area per click.
export const ALTERATION_RADIUS_MILES = 12

// coordinates = image corners [top-left, top-right, bottom-right, bottom-left] as [lng,lat]
export type ImageCoords = [[number, number], [number, number], [number, number], [number, number]]
export interface TwiOverlay {
  url: string
  coordinates: ImageCoords
}
// No default overlay — compute one anywhere by right-clicking the map. (You can pin a
// prebuilt seed here if you generate one with pipeline/compute_twi.py.)
export const TWI_IMAGE: TwiOverlay | null = null

// Only fetch claim/MRDS features once zoomed in enough (services cap at 2000 features).
export const MIN_FETCH_ZOOM = 10
