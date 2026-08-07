#!/bin/sh
# OSRM Health Check Script
# Tests OSRM connectivity by routing a known Delhi→Kolkata trip.
# Returns exit code 0 if healthy, 1 if unreachable.

# Delhi (77.2090, 28.6139) → Kolkata (88.3639, 22.5726)
OSRM_URL="http://localhost:5000/route/v1/driving/77.2090,28.6139;88.3639,22.5726?overview=false"

response=$(wget -qO- --timeout=5 "${OSRM_URL}" 2>/dev/null)

if echo "${response}" | grep -q '"code":"Ok"'; then
    echo "[OSRM Healthcheck] OK - routing engine is responsive"
    exit 0
else
    echo "[OSRM Healthcheck] FAIL - routing engine is not responding"
    exit 1
fi
