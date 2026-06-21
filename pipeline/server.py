#!/usr/bin/env python3
"""
server.py — on-demand TWI compute API for Claim Jumper.

Right-click on the map in the app -> POST here -> we download the 3DEP DEM for a radius
around the point, compute flow-accumulation TWI, and return a colorized overlay the map
drapes in place. Lets you compute wetness anywhere in Nevada without pre-baking the state.

Run:
  cd pipeline && source .venv/bin/activate
  pip install -r requirements.txt   # (adds flask)
  python server.py                  # serves on http://127.0.0.1:8011

The Vite dev server proxies /api -> here, so the browser calls same-origin /api/twi.
"""
from __future__ import annotations

import os
import json
import time
import threading
import traceback

from flask import Flask, request, jsonify, send_from_directory

from compute_twi import generate_twi, bbox_from_point
from alteration import generate_alteration

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(REPO_ROOT, "public", "twi", "ondemand")
ALT_DIR = os.path.join(REPO_ROOT, "public", "alteration", "ondemand")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ALT_DIR, exist_ok=True)

# Production: built frontend (dist/) served by this same process. In dev it's absent and
# Vite serves the UI + proxies /api here.
WEB_DIR = os.environ.get("CJ_WEB_DIR") or os.path.join(REPO_ROOT, "dist")
_HAS_WEB = os.path.isdir(WEB_DIR)

# Guardrails so one click can't ask for the whole state.
MIN_RADIUS, MAX_RADIUS = 0.5, 25.0  # miles
# Rough Nevada bbox to reject obvious mis-clicks.
NV = (-120.3, 34.9, -113.8, 42.2)

# When bundled, serve the SPA from WEB_DIR at the site root.
app = Flask(__name__, static_folder=WEB_DIR if _HAS_WEB else None, static_url_path="")

# WhiteboxTools isn't safe to run concurrently (shared native state) — serialize computes.
_compute_lock = threading.Lock()
_alt_lock = threading.Lock()

# --- shared, cross-device storage (expeditions, POIs) ---
# A persistent JSON store so the same data shows up on every device. Point CJ_DATA_DIR at a
# Docker volume so it survives container rebuilds.
DATA_DIR = os.environ.get("CJ_DATA_DIR") or os.path.join(REPO_ROOT, "data")
os.makedirs(DATA_DIR, exist_ok=True)


class JsonStore:
    """Tiny id-keyed JSON store with atomic read-modify-write."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()

    def _read(self):
        try:
            with open(self.path) as f:
                return json.load(f)
        except (FileNotFoundError, ValueError):
            return {}

    def _write(self, data):
        tmp = self.path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f)
        os.replace(tmp, self.path)

    def all(self):
        with self.lock:
            return list(self._read().values())

    def upsert(self, item):
        with self.lock:
            data = self._read()
            data[str(item["id"])] = item
            self._write(data)

    def delete(self, item_id):
        with self.lock:
            data = self._read()
            data.pop(str(item_id), None)
            self._write(data)


EXP_STORE = JsonStore(os.path.join(DATA_DIR, "expeditions.json"))
POI_STORE = JsonStore(os.path.join(DATA_DIR, "pois.json"))


def _crud(store):
    """Wire GET (list) + PUT (upsert) + DELETE for a store under the calling route."""
    if request.method == "PUT":
        item = request.get_json(force=True, silent=True) or {}
        if "id" not in item:
            return jsonify(error="missing id"), 400
        store.upsert(item)
        return jsonify(ok=True)
    return jsonify(store.all())


@app.route("/api/expeditions", methods=["GET", "PUT"])
def expeditions():
    return _crud(EXP_STORE)


@app.delete("/api/expeditions/<item_id>")
def delete_expedition(item_id):
    EXP_STORE.delete(item_id)
    return jsonify(ok=True)


@app.route("/api/pois", methods=["GET", "PUT"])
def pois():
    return _crud(POI_STORE)


@app.delete("/api/pois/<item_id>")
def delete_poi(item_id):
    POI_STORE.delete(item_id)
    return jsonify(ok=True)


@app.post("/api/twi")
def twi():
    data = request.get_json(force=True, silent=True) or {}
    try:
        lng = float(data["lng"])
        lat = float(data["lat"])
    except (KeyError, TypeError, ValueError):
        return jsonify(error="lng and lat are required numbers"), 400

    radius = float(data.get("radius_miles", 5))
    radius = max(MIN_RADIUS, min(MAX_RADIUS, radius))
    max_size = int(data.get("max_size", 1200))

    w, s, e, n = NV
    if not (w <= lng <= e and s <= lat <= n):
        return jsonify(error="point is outside the Nevada coverage area"), 422

    bbox = bbox_from_point(lng, lat, radius)

    # Serialize: WhiteboxTools collides if run concurrently (e.g. rapid right-clicks).
    with _compute_lock:
        # one active overlay at a time -> clear old files (inside lock to avoid races)
        for f in os.listdir(OUT_DIR):
            try:
                os.remove(os.path.join(OUT_DIR, f))
            except OSError:
                pass
        # stamp computed inside lock -> unique filename per compute (cache-busting)
        fname = f"twi-{int(time.time() * 1000)}.png"
        png_path = os.path.join(OUT_DIR, fname)
        try:
            t0 = time.time()
            corners = generate_twi(bbox, png_path, epsg=None, max_size=max_size)
            secs = round(time.time() - t0, 1)
        except Exception as ex:  # noqa: BLE001 — surface any pipeline failure to the client
            traceback.print_exc()
            return jsonify(error=f"TWI compute failed: {ex}"), 500

    return jsonify(
        url=f"/twi/ondemand/{fname}",
        coordinates=corners,  # [[TL],[TR],[BR],[BL]] in lng/lat
        center=[lng, lat],
        radius_miles=radius,
        seconds=secs,
    )


@app.post("/api/alteration")
def alteration():
    data = request.get_json(force=True, silent=True) or {}
    try:
        lng = float(data["lng"])
        lat = float(data["lat"])
    except (KeyError, TypeError, ValueError):
        return jsonify(error="lng and lat are required numbers"), 400

    radius = max(MIN_RADIUS, min(MAX_RADIUS, float(data.get("radius_miles", 5))))
    w, s, e, n = NV
    if not (w <= lng <= e and s <= lat <= n):
        return jsonify(error="point is outside the Nevada coverage area"), 422

    bbox = bbox_from_point(lng, lat, radius)
    with _alt_lock:
        for f in os.listdir(ALT_DIR):
            try:
                os.remove(os.path.join(ALT_DIR, f))
            except OSError:
                pass
        fname = f"alt-{int(time.time() * 1000)}.png"
        png_path = os.path.join(ALT_DIR, fname)
        try:
            t0 = time.time()
            corners, meta = generate_alteration(bbox, png_path)
            secs = round(time.time() - t0, 1)
        except Exception as ex:  # noqa: BLE001
            traceback.print_exc()
            return jsonify(error=f"Alteration compute failed: {ex}"), 500

    return jsonify(
        url=f"/alteration/ondemand/{fname}",
        coordinates=corners,
        center=[lng, lat],
        radius_miles=radius,
        seconds=secs,
        **meta,
    )


@app.get("/alteration/ondemand/<path:fname>")
def serve_alteration(fname):
    return send_from_directory(ALT_DIR, fname)


@app.get("/api/health")
def health():
    return jsonify(ok=True)


# Serve the generated PNGs directly too (handy if not going through the Vite proxy).
@app.get("/twi/ondemand/<path:fname>")
def serve_overlay(fname):
    return send_from_directory(OUT_DIR, fname)


# Serve the bundled single-page app at the site root (production). Static assets are served
# automatically from WEB_DIR by Flask's static handler (static_url_path="").
@app.get("/")
def index():
    if _HAS_WEB:
        return send_from_directory(WEB_DIR, "index.html")
    return jsonify(ok=True, service="claim-jumper-api", note="frontend not bundled (dev mode)")


if __name__ == "__main__":
    host = os.environ.get("CJ_HOST", "127.0.0.1")
    port = int(os.environ.get("CJ_PORT", "8011"))
    mode = "UI+API" if _HAS_WEB else "API only"
    print(f"Claim Jumper {mode} on http://{host}:{port}")
    app.run(host=host, port=port, threaded=True)
