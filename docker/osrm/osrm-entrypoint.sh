#!/bin/sh
# OSRM Container Entrypoint
# Starts the OSRM routing daemon using the Multi-Level Dijkstra (MLD) algorithm.
# Pre-processed .osrm files must already exist in /data/ (built in Dockerfile stage 1).

set -e

DATA_FILE="/data/india-latest.osrm"

echo "[OSRM] Starting OSRM Routing Engine..."
echo "[OSRM] Algorithm: MLD (Multi-Level Dijkstra)"
echo "[OSRM] Data file: ${DATA_FILE}"
echo "[OSRM] Listening on port 5000"

# Validate that pre-processed data exists
if [ ! -f "${DATA_FILE}" ]; then
    echo "[OSRM] ERROR: Pre-processed OSRM data not found at ${DATA_FILE}"
    echo "[OSRM] Please rebuild the Docker image to re-run preprocessing."
    exit 1
fi

exec osrm-routed \
    --algorithm mld \
    --max-table-size 10000 \
    --max-matching-size 1000 \
    --port 5000 \
    "${DATA_FILE}"
