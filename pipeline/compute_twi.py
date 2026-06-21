#!/usr/bin/env python3
"""
compute_twi.py — Topographic Wetness Index (TWI) overlay generator for Claim Jumper.

Given a bounding box in Nevada, this:
  1. Downloads the USGS 3DEP DEM for that box (free, no key) as a projected GeoTIFF.
  2. Fills depressions, computes D-infinity specific contributing area + slope, then
     TWI = ln(SCA / tan(slope))  via WhiteboxTools.
  3. Colorizes TWI (high = wet/low collection points = hot) to an RGBA PNG.
  4. Prints a config snippet (TWI_IMAGE corners in lng/lat) to paste into src/config.ts.

High TWI = where water — and heavy placer gold — tends to concentrate (drainages, washes,
gulch bottoms). It is a terrain heuristic, not a guarantee of gold.

Usage:
  python compute_twi.py --bbox -117.10 38.65 -117.00 38.75 --name round-mountain
  # bbox order: WEST SOUTH EAST NORTH  (lng/lat, EPSG:4326)

Output goes to ../public/twi/<name>/ so the dev server can serve it.
"""
from __future__ import annotations

import argparse
import os
import sys
import math
import time
import tempfile

import numpy as np
import requests
import rasterio
from rasterio.warp import transform_bounds
import matplotlib
matplotlib.use("Agg")
import matplotlib.colors as mcolors
from PIL import Image

from whitebox import WhiteboxTools

# USGS 3DEP dynamic elevation image service (free, no API key).
DEM_SERVICE = (
    "https://elevation.nationalmap.gov/arcgis/rest/services/"
    "3DEPElevation/ImageServer/exportImage"
)


def download_dem(bbox4326, out_path, epsg, max_size):
    """Fetch a projected float32 DEM GeoTIFF for the bbox from USGS 3DEP."""
    w, s, e, n = bbox4326
    # Project the bbox to the target CRS to size the raster in meters.
    pw, ps, pe, pn = transform_bounds("EPSG:4326", f"EPSG:{epsg}", w, s, e, n)
    width_m, height_m = pe - pw, pn - ps
    aspect = width_m / height_m
    if aspect >= 1:
        out_w = min(max_size, 4000)
        out_h = max(1, round(out_w / aspect))
    else:
        out_h = min(max_size, 4000)
        out_w = max(1, round(out_h * aspect))

    params = {
        "bbox": f"{w},{s},{e},{n}",
        "bboxSR": "4326",
        "imageSR": str(epsg),
        "size": f"{out_w},{out_h}",
        "format": "tiff",
        "pixelType": "F32",
        "noData": "-9999",
        "interpolation": "RSP_BilinearInterpolation",
        "f": "image",
    }
    print(f"  Requesting DEM {out_w}x{out_h}px (EPSG:{epsg}) from 3DEP…")
    last_err = None
    for attempt in range(1, 5):
        try:
            r = requests.get(DEM_SERVICE, params=params, timeout=240)
            r.raise_for_status()
            if r.headers.get("content-type", "").startswith("application/json"):
                sys.exit(f"3DEP returned an error: {r.text[:400]}")
            with open(out_path, "wb") as f:
                f.write(r.content)
            print(f"  Saved DEM -> {out_path} ({len(r.content)//1024} KB)")
            return
        except (requests.HTTPError, requests.ConnectionError, requests.Timeout) as ex:
            last_err = ex
            wait = 4 * attempt
            print(f"  ⚠ attempt {attempt} failed ({ex.__class__.__name__}); retrying in {wait}s…")
            time.sleep(wait)
    sys.exit(f"3DEP DEM download failed after retries: {last_err}\n"
             f"Try a smaller --bbox or lower --max-size.")


def compute_twi(dem_path, twi_path, workdir):
    wbt = WhiteboxTools()
    wbt.set_working_dir(workdir)
    wbt.set_verbose_mode(False)

    filled = os.path.join(workdir, "_filled.tif")
    sca = os.path.join(workdir, "_sca.tif")
    slope = os.path.join(workdir, "_slope.tif")

    print("  Filling depressions…")
    wbt.fill_depressions(dem_path, filled)
    print("  D-infinity specific contributing area…")
    wbt.d_inf_flow_accumulation(filled, sca, out_type="Specific Contributing Area")
    print("  Slope…")
    wbt.slope(filled, slope, units="degrees")
    print("  Wetness index…")
    wbt.wetness_index(sca, slope, twi_path)


def colorize(twi_path, png_path, cmap_name="turbo", lo_pct=2, hi_pct=98):
    """Render TWI to an RGBA PNG; high TWI = hot, transparent where nodata."""
    with rasterio.open(twi_path) as ds:
        arr = ds.read(1).astype("float32")
        nodata = ds.nodata
        bounds = ds.bounds
        crs = ds.crs

    mask = np.isfinite(arr)
    if nodata is not None:
        mask &= arr != nodata
    vals = arr[mask]
    if vals.size == 0:
        sys.exit("TWI raster is empty — check the DEM download.")

    lo, hi = np.percentile(vals, [lo_pct, hi_pct])
    norm = mcolors.Normalize(vmin=lo, vmax=hi, clip=True)
    cmap = matplotlib.colormaps[cmap_name]
    rgba = cmap(norm(arr))  # HxWx4 floats 0..1
    rgba[..., 3] = np.where(mask, 0.85, 0.0)  # alpha: hide nodata
    img = (rgba * 255).astype("uint8")
    Image.fromarray(img, "RGBA").save(png_path)
    print(f"  Wrote overlay PNG -> {png_path}")

    # corners in lng/lat for the MapLibre image source
    w, s, e, n = transform_bounds(crs, "EPSG:4326", *bounds)
    return [[w, n], [e, n], [e, s], [w, s]]  # TL, TR, BR, BL


def epsg_for_lng(lng: float) -> int:
    """Pick a UTM zone (NAD83/WGS84 north) appropriate for a Nevada longitude."""
    if lng < -120:
        return 32610  # UTM 10N (far-west NV)
    if lng < -114:
        return 32611  # UTM 11N (most of NV)
    return 32612      # UTM 12N (east edge)


def bbox_from_point(lng: float, lat: float, radius_miles: float):
    """Square bbox of +/- radius around a point, returned as (W, S, E, N) lng/lat."""
    r_m = radius_miles * 1609.344
    dlat = r_m / 111_320.0
    dlng = r_m / (111_320.0 * max(0.05, math.cos(math.radians(lat))))
    return (lng - dlng, lat - dlat, lng + dlng, lat + dlat)


def generate_twi(bbox, png_path, epsg=None, max_size=1400, cmap="turbo"):
    """Full pipeline: 3DEP DEM -> TWI -> colorized PNG. Returns corner coords (lng/lat)."""
    w, s, e, n = bbox
    if not (w < e and s < n):
        raise ValueError("bbox must be (W, S, E, N) with west<east and south<north")
    if epsg is None:
        epsg = epsg_for_lng((w + e) / 2)
    os.makedirs(os.path.dirname(os.path.abspath(png_path)), exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        dem = os.path.join(work, "dem.tif")
        twi = os.path.join(work, "twi.tif")
        print(f"[1/3] Downloading 3DEP DEM…")
        download_dem((w, s, e, n), dem, epsg, max_size)
        print(f"[2/3] Computing TWI…")
        compute_twi(dem, twi, work)
        if not os.path.exists(twi):
            raise RuntimeError("WhiteboxTools did not produce a TWI raster (compute interrupted?)")
        print(f"[3/3] Colorizing…")
        corners = colorize(twi, png_path, cmap)
    return corners


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bbox", nargs=4, type=float, required=True,
                    metavar=("WEST", "SOUTH", "EAST", "NORTH"),
                    help="Bounding box in lng/lat (EPSG:4326)")
    ap.add_argument("--name", required=True, help="Area slug, e.g. round-mountain")
    ap.add_argument("--epsg", type=int, default=32611,
                    help="Projected CRS for slope (default UTM 11N = 32611; west NV use 32610)")
    ap.add_argument("--max-size", type=int, default=2500, help="Max DEM dimension in px")
    ap.add_argument("--cmap", default="turbo", help="matplotlib colormap (default turbo)")
    args = ap.parse_args()

    w, s, e, n = args.bbox
    if not (w < e and s < n):
        sys.exit("bbox must be WEST SOUTH EAST NORTH with west<east and south<north")
    if abs(e - w) > 1.0 or abs(n - s) > 1.0:
        print("  ⚠ Large box (>~70 km). This may be slow / heavy; consider tiling smaller.")

    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "twi", args.name)
    png_path = os.path.join(out_dir, "twi.png")
    corners = generate_twi((w, s, e, n), png_path, args.epsg, args.max_size, args.cmap)

    rel = f"/twi/{args.name}/twi.png"
    print("\n✅ Done. Paste this into src/config.ts (replacing TWI_IMAGE):\n")
    print("export const TWI_IMAGE: { url: string; coordinates: ImageCoords } | null = {")
    print(f"  url: '{rel}',")
    print(f"  coordinates: [")
    for c in corners:
        print(f"    [{c[0]:.6f}, {c[1]:.6f}],")
    print("  ],")
    print("}")
    print("\nThen enable the 'Wetness heatmap (TWI)' layer in the panel.\n")


if __name__ == "__main__":
    main()
