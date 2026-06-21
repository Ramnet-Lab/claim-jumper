#!/bin/sh
# Build and (re)start Claim Jumper from this directory. Run on the host (e.g. Unraid).
# Data (expeditions/POIs) lives in the named volume so it survives rebuilds.
set -e
docker build -t cliam-jumper:latest .
docker rm -f cliam-jumper 2>/dev/null || true
docker run -d --name cliam-jumper --restart unless-stopped \
  -p 8765:8011 -e CJ_DATA_DIR=/data -v cliam-jumper-data:/data \
  cliam-jumper:latest
echo "Claim Jumper -> http://localhost:8765"
