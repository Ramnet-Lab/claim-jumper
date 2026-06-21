#!/usr/bin/env python3
"""
alteration.py — Sentinel-2 hydrothermal-alteration overlay for Claim Jumper.

Given a point + radius, gathers low-cloud Sentinel-2 L2A scenes (free, AWS Open Data via the
Element84 Earth Search STAC) and MOSAICS them onto one grid covering the whole area — so the
overlay never gets clipped at a granule edge. Then computes band ratios that highlight
mineralization signatures:

  R = B4 / B2   (red/blue)    -> iron oxide / gossan  (rust over oxidizing sulfides)
  G = B11 / B12 (SWIR ratio)  -> clay / OH / carbonate alteration
  B = B11 / B4                -> ferrous / mafic

Iron-stained ground reads red/orange, clay alteration reads green — marking where fluids
moved (i.e. where veins/alteration are) even with no obvious outcrop.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import requests
import rasterio
from rasterio.warp import transform_bounds
from rasterio.transform import from_origin
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from PIL import Image

from compute_twi import epsg_for_lng

STAC_SEARCH = "https://earth-search.aws.element84.com/v1/search"
TARGET_MAX_PX = 1400  # cap output dimension; pixel size scales with the area
MAX_TILES = 8         # mosaic across up to this many distinct MGRS tiles


def _tile_id(f):
    p = f.get("properties", {})
    tid = p.get("grid:code") or p.get("s2:mgrs_tile")
    if tid:
        return tid
    parts = f.get("id", "").split("_")
    return parts[1] if len(parts) > 1 else f.get("id", "")


def search_scenes(bbox):
    """Return one low-cloud scene PER distinct MGRS tile intersecting the bbox.

    Adjacent tiles are what fill a large aperture — picking the least-cloudy scene per tile
    (rather than the globally least-cloudy scenes, which are often the same tile on many
    dates) gives full geographic coverage to mosaic.
    """
    body = {
        "collections": ["sentinel-2-l2a"],
        "bbox": list(bbox),
        "limit": 100,
        "datetime": "2022-01-01T00:00:00Z/2026-12-31T00:00:00Z",
        "query": {"eo:cloud_cover": {"lt": 30}},
    }
    r = requests.post(STAC_SEARCH, json=body, timeout=60)
    r.raise_for_status()
    feats = r.json().get("features", [])
    if not feats:  # relax cloud filter
        body.pop("query")
        r = requests.post(STAC_SEARCH, json=body, timeout=60)
        r.raise_for_status()
        feats = r.json().get("features", [])
    if not feats:
        raise RuntimeError("No Sentinel-2 scenes found for this area")

    cloud = lambda f: f["properties"].get("eo:cloud_cover", 100)
    feats.sort(key=cloud)
    best_per_tile = {}
    for f in feats:  # first hit per tile is least-cloudy (sorted)
        best_per_tile.setdefault(_tile_id(f), f)
    tiles = sorted(best_per_tile.values(), key=cloud)
    return tiles[:MAX_TILES]


def _target_grid(bbox, epsg):
    """Build a destination grid (CRS, transform, width, height, bounds) covering the bbox."""
    w, s, e, n = transform_bounds("EPSG:4326", f"EPSG:{epsg}", *bbox)
    span = max(e - w, n - s)
    px = max(10.0, span / TARGET_MAX_PX)  # never finer than 10 m (S-2 native)
    width = max(1, round((e - w) / px))
    height = max(1, round((n - s) / px))
    transform = from_origin(w, n, px, px)
    return f"EPSG:{epsg}", transform, width, height, (w, s, e, n)


def _read_on_grid(href, dst_crs, dst_transform, width, height):
    """Resample a remote COG band onto the exact target grid (0 outside its footprint)."""
    with rasterio.open(f"/vsicurl/{href}") as src:
        with WarpedVRT(
            src,
            crs=dst_crs,
            transform=dst_transform,
            width=width,
            height=height,
            resampling=Resampling.bilinear,
            src_nodata=0,
            nodata=0,
        ) as vrt:
            return vrt.read(1).astype("float32")


BANDS = ("red", "blue", "swir16", "swir22")


def _read_all_bands(scenes, grid):
    """Read every (band, scene) onto the grid in parallel (I/O-bound vsicurl reads)."""
    dst_crs, transform, width, height, _ = grid
    tasks = [
        (b, i, sc["assets"][b]["href"])
        for b in BANDS
        for i, sc in enumerate(scenes)
        if b in sc["assets"]
    ]
    out: dict[tuple[str, int], np.ndarray] = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {
            ex.submit(_read_on_grid, href, dst_crs, transform, width, height): (b, i)
            for (b, i, href) in tasks
        }
        for fut in as_completed(futs):
            key = futs[fut]
            try:
                out[key] = fut.result()
            except Exception:  # noqa: BLE001 — skip a bad tile, keep mosaicking
                out[key] = None  # type: ignore[assignment]
    return out, width, height


def _mosaic(band, reads, n_scenes, width, height):
    """First-valid mosaic of one band across scenes (least-cloudy index fills first)."""
    out = np.zeros((height, width), "float32")
    filled = np.zeros((height, width), bool)
    for i in range(n_scenes):
        arr = reads.get((band, i))
        if arr is None:
            continue
        take = (arr > 0) & ~filled
        out[take] = arr[take]
        filled |= take
        if filled.all():
            break
    return out, filled


def _stretch(a, mask, lo=2, hi=98):
    vals = a[mask]
    if vals.size == 0:
        return np.zeros_like(a)
    plo, phi = np.percentile(vals, [lo, hi])
    if phi <= plo:
        phi = plo + 1e-6
    return np.clip((a - plo) / (phi - plo), 0, 1)


def generate_alteration(bbox, png_path):
    """Compute the mosaicked alteration false-color PNG. Returns (corners, meta)."""
    scenes = search_scenes(bbox)
    epsg = epsg_for_lng((bbox[0] + bbox[2]) / 2)
    grid = _target_grid(bbox, epsg)
    dst_crs, _, _, _, bounds = grid

    reads, width, height = _read_all_bands(scenes, grid)
    n = len(scenes)
    red, m1 = _mosaic("red", reads, n, width, height)
    blue, m2 = _mosaic("blue", reads, n, width, height)
    swir16, m3 = _mosaic("swir16", reads, n, width, height)
    swir22, m4 = _mosaic("swir22", reads, n, width, height)

    valid = m1 & m2 & m3 & m4
    if valid.sum() == 0:
        raise RuntimeError("No cloud-free Sentinel-2 pixels for this area")

    eps = 1e-6
    iron = red / (blue + eps)        # iron oxide / gossan
    clay = swir16 / (swir22 + eps)   # clay / OH / carbonate
    ferrous = swir16 / (red + eps)   # ferrous / mafic

    rgb = np.dstack([_stretch(iron, valid), _stretch(clay, valid), _stretch(ferrous, valid)])
    rgba = (np.dstack([rgb, valid.astype("float32")]) * 255).astype("uint8")
    Image.fromarray(rgba, "RGBA").save(png_path)

    w_, s_, e_, n_ = transform_bounds(dst_crs, "EPSG:4326", *bounds)
    corners = [[w_, n_], [e_, n_], [e_, s_], [w_, s_]]
    cover = round(100 * valid.sum() / valid.size)
    meta = {
        "scenes": len(scenes),
        "cloud": round(min(s["properties"].get("eo:cloud_cover", 100) for s in scenes), 1),
        "coverage_pct": cover,
        "datetime": scenes[0]["properties"].get("datetime", ""),
    }
    return corners, meta
