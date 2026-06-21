# ⛏️ Claim Jumper

A **Nevada gold &amp; mineral prospecting map** — an integrated, browser-based field tool that
stacks geology, geophysics, satellite alteration, terrain analysis, land ownership, and
mining-claim data so you can find non-obvious targets and the open ground to chase them on.

Built entirely on **free, public data** with **no API keys**. Open-source map engine
(**MapLibre GL JS**), a small **Python/Flask** backend for the on-demand geospatial
computes, and it all ships as **one Docker container**.

> ⚠️ **Advisory tool, not legal authority.** Always confirm land status, claims, and access
> with the BLM / Forest Service / county before prospecting. See [Disclaimer](#-disclaimer).

---

## Features

**Find the target**
- **Geology** (NBMG Nevada 1:500k) — colored bedrock units; spot granite/volcanic
  intrusions and their contacts, where ore forms. **Click any unit** to identify its code
  (e.g. `Kgr`), name, age, and rock type.
- **Contacts** — crisp formation-boundary lines pulled from the geologic map (veins
  localize along contacts + faults).
- **Fault lines** (NBMG Quaternary faults) — click for name, age, type, slip rate.
- **Magnetic anomaly** (NBMG aeromagnetic) — intrusions/structures buried under cover.
- **Hydrothermal alteration** (Sentinel-2, on-demand) — right-click to compute iron-oxide /
  gossan + clay band-ratios that mark where mineralizing fluids passed. Mosaicked across
  tiles so it never clips.
- **Wetness heatmap / TWI** (USGS 3DEP, on-demand) — flow-accumulation map of the drainages
  and gulch bottoms where placer gold concentrates.
- **Hi-res hillshade** (USGS 3DEP, 1–10 m) — sharp relief that reveals vein ridges,
  lineaments, and old prospect workings.
- **MRDS mineral sites** (USGS) — colored by status; **filter by mineral** (gold, silver,
  opal, turquoise, …); popups link to the full USGS report.

**Know the ground**
- **Land status** (BLM Surface Management Agency) — BLM / Forest Service / **Private** /
  etc., so you don't trespass.
- **Active claims** &amp; **expired/closed claims** (BLM MLRS) — what's staked vs. open ground.
- **Right-click readout** — instant land owner + claim status + rock unit at any point.

**Work it**
- **Right-click menu** — save a point of interest, compute wetness/alteration, or navigate
  (opens Google Maps directions).
- **Field-notebook POIs** — name, notes, **uploaded photos**, and **auto-captured site
  context** (rock unit, land owner, claim status). The **📍 Spots** panel lists every spot
  with thumbnails — fly to, edit, add/remove photos, navigate, delete. Stored on-device
  (localStorage + IndexedDB).
- Per-layer visibility + opacity, topo/imagery basemaps, 3D terrain, place search.

---

## Run it (Docker — recommended)

Everything (UI + compute API) is one container. Needs only Docker + outbound internet.

```bash
git clone https://github.com/Ramnet-Lab/claim-jumper.git
cd claim-jumper
docker compose up -d --build      # builds the image, starts on http://localhost:8765
```

…or without compose:

```bash
docker build -t cliam-jumper:latest .
docker run -d --name cliam-jumper --restart unless-stopped -p 8765:8011 cliam-jumper:latest
```

Open **http://localhost:8765**. Change the host port by editing `docker-compose.yml` (or the
`-p` flag). To update after pulling changes, re-run `docker compose up -d --build`.

The container is **stateless** — your POIs/photos live in your browser, and overlays are
recomputed on demand, so no volumes are required.

---

## Run it (local dev)

Two processes: the Vite dev server (UI, hot reload) and the Flask backend (computes).

```bash
# 1) frontend
npm install
npm run dev                       # http://localhost:5173

# 2) compute backend (second terminal)
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py                  # http://127.0.0.1:8011 (Vite proxies /api → here)
```

The frontend runs without the backend — you just can't compute wetness/alteration overlays
until it's started. (WhiteboxTools downloads its native binary on first compute.)

---

## How it works

| Layer | Source | Access |
|---|---|---|
| Basemap | USGS National Map (Topo / Imagery) | raster XYZ |
| Terrain / hillshade | AWS Terrain Tiles (Terrarium) | `raster-dem` |
| Hi-res hillshade | USGS 3DEP multidirectional | dynamic export raster |
| Geology / Contacts | NBMG Nevada 1:500k geologic map | raster + GeoJSON, click-identify |
| Magnetic anomaly | NBMG aeromagnetic | cached raster tiles |
| Wetness (TWI) | USGS 3DEP → backend | on-demand image overlay |
| Alteration | Sentinel-2 L2A (AWS/Element84 STAC) → backend | on-demand mosaic overlay |
| Land status | BLM Surface Management Agency | raster tiles + identify |
| Active / expired claims | BLM MLRS mining claims | REST → GeoJSON by viewport |
| Fault lines | NBMG Quaternary faults | REST → GeoJSON by viewport |
| MRDS sites | USGS MRDS (compact) | REST → GeoJSON, mineral filter |
| Place search | OpenStreetMap Nominatim | geocode → flyTo |

All endpoints live in [`src/config.ts`](src/config.ts). The two on-demand computes
(`/api/twi`, `/api/alteration`) run server-side in [`pipeline/`](pipeline/) using rasterio,
WhiteboxTools, and shapely.

### Project layout

```
src/
  config.ts            all endpoints + defaults (no keys)
  map/                 MapLibre orchestrator, base style, layer/source IDs
  layers/              claims, MRDS, faults, contacts, geology/magnetic/hillshade, overlays
  data/                Esri→GeoJSON fetcher, commodities, geology identify, site capture,
                       POIs + image store (IndexedDB), compute client
  ui/                  LayerPanel, MineralFilter, SearchBox, Legend, ContextMenu,
                       PoiForm, PoiPanel, popups
pipeline/
  server.py            Flask: serves the built app + /api/twi + /api/alteration
  compute_twi.py       3DEP DEM → flow-accumulation TWI
  alteration.py        Sentinel-2 → iron-oxide/clay band-ratio mosaic
Dockerfile             multi-stage: node build → python runtime (single image)
docker-compose.yml     one-command run
```

---

## ⚠️ Disclaimer

Claim, land-status, and mineral data are **advisory** and **generalized** — BLM claim and
SMA boundaries are not a legal survey or parcel map, private inholdings may be missing, and
MRDS is historical (USGS stopped systematic updates ~2011). Geologic and alteration layers
flag *zones*, not verified mineralization. **Always confirm ownership, claims, mineral-entry
status, and access** with the BLM, Forest Service, and county records before entering land,
prospecting, panning, or staking. Recreational panning rules vary by agency and location —
when in doubt, call the local field/ranger office. You are responsible for your own
compliance and safety.

## License

[MIT](LICENSE) — data remains subject to the terms of its respective providers (USGS, BLM,
NBMG, ESA/Copernicus, OpenStreetMap).
