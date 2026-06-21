# TWI / wetness-heatmap pipeline

Computes the **topographic wetness index** — the "where does water (and heavy placer gold)
collect" heatmap — from free USGS 3DEP elevation. Two ways to use it:

1. **`server.py`** — the live backend the app calls when you **right-click the map**
   (computes a radius around the clicked point). This is the main path.
2. **`compute_twi.py`** — a CLI to batch-generate a fixed-bbox overlay (used for the
   prebuilt Round Mountain seed).

## Setup

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

(WhiteboxTools downloads its native binary on first run — give it a minute.)

## Run the backend (right-click compute)

```bash
python server.py          # http://127.0.0.1:8011
```

Leave it running alongside `npm run dev`; Vite proxies `/api` to it. Now right-click any
point in the app to compute wetness in a 5-mile radius. Computes are serialized (one at a
time) so rapid right-clicks queue safely.

## Or: batch CLI for a fixed area

```bash
# bbox order: WEST SOUTH EAST NORTH  (lng/lat)
python compute_twi.py --bbox -117.10 38.65 -117.00 38.75 --name round-mountain
```

Options:
- `--name`   area slug → output goes to `../public/twi/<name>/twi.png`
- `--epsg`   projected CRS for correct slope (default `32611` = UTM 11N; far-west NV `32610`)
- `--max-size`  max DEM dimension in pixels (default 2500; raise for sharper, slower output)
- `--cmap`   matplotlib colormap (default `turbo`; high TWI = hot)

## Wire it into the app

The script prints a ready-to-paste `TWI_IMAGE` block. Drop it into
[`src/config.ts`](../src/config.ts), then toggle **Wetness heatmap (TWI)** on in the layer
panel. The PNG is served statically from `public/twi/...` by Vite.

## How it works

`fill_depressions` → `d_inf_flow_accumulation` (specific contributing area) → `slope` →
`wetness_index` = `ln(SCA / tan(slope))`. High values = flat, low-lying, high-drainage cells
— gulch bottoms, washes, and stream confluences where placers form.

> Heuristic only. TWI highlights collection terrain; it does not detect gold. Always
> confirm land status and claims with the BLM before prospecting.
