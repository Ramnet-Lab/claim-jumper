# syntax=docker/dockerfile:1
# Claim Jumper — single container: Flask serves both the built React app and the compute API.

# --- Stage 1: build the frontend ---
FROM node:20-bookworm-slim AS web
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY . .
RUN npm run build           # -> /web/dist

# --- Stage 2: python runtime (API + static) ---
FROM python:3.12-slim
WORKDIR /app

# System libs: libgomp1 for WhiteboxTools (OpenMP); libexpat1 for rasterio's bundled GDAL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 libexpat1 \
 && rm -rf /var/lib/apt/lists/*

COPY pipeline/requirements.txt ./pipeline/requirements.txt
RUN pip install --no-cache-dir -r pipeline/requirements.txt gunicorn

# Pre-download the WhiteboxTools binary so first compute is instant (best-effort).
RUN python -c "from whitebox import WhiteboxTools; WhiteboxTools().version()" \
    || echo "WhiteboxTools will download on first use"

COPY pipeline ./pipeline
COPY --from=web /web/dist ./dist

ENV CJ_WEB_DIR=/app/dist \
    GDAL_HTTP_TIMEOUT=60 \
    GDAL_HTTP_MAX_RETRY=3 \
    PYTHONUNBUFFERED=1
EXPOSE 8011

# Single worker (the compute lock serializes WhiteboxTools); threads handle concurrency.
# Long timeout because an alteration/TWI compute can take ~30-60s.
CMD ["gunicorn", "--chdir", "/app/pipeline", "--workers", "1", "--threads", "8", \
     "--timeout", "300", "--bind", "0.0.0.0:8011", "server:app"]
