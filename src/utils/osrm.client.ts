/**
 * OSRM (Open Source Routing Machine) HTTP Client
 *
 * Production-grade client for self-hosted OSRM routing engine.
 * Provides road distance and driving duration using OpenStreetMap data.
 *
 * Features:
 *  - In-memory LRU route cache (configurable TTL)
 *  - Exponential backoff retry logic
 *  - Configurable timeout with AbortController
 *  - Parallel multi-destination requests
 *  - Health check / ping
 *  - Structured logging
 *
 * OSRM API: GET /route/v1/driving/{src_lon},{src_lat};{dst_lon},{dst_lat}?overview=false
 */

import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OsrmRouteResult {
  distanceKm: number;       // Road distance in kilometres (rounded to 2dp)
  durationMinutes: number;  // Driving duration in minutes (rounded to 2dp)
  source: 'OSRM' | 'CACHE';
}

export interface OsrmWarehouseResult {
  warehouseId: string;
  distanceKm: number;
  durationMinutes: number;
  source: 'OSRM' | 'CACHE';
  error?: string;           // Set if OSRM request failed for this warehouse
}

interface OsrmApiResponse {
  code: string;
  routes?: Array<{
    distance: number;  // metres
    duration: number;  // seconds
  }>;
  message?: string;
}

// ─── In-Memory LRU Route Cache ────────────────────────────────────────────────

interface CacheEntry {
  result: OsrmRouteResult;
  expiresAt: number;
}

class RouteCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries = 10_000;

  private buildKey(
    srcLat: number, srcLon: number,
    dstLat: number, dstLon: number
  ): string {
    return `${srcLat.toFixed(6)},${srcLon.toFixed(6)}→${dstLat.toFixed(6)},${dstLon.toFixed(6)}`;
  }

  get(srcLat: number, srcLon: number, dstLat: number, dstLon: number): OsrmRouteResult | null {
    const key = this.buildKey(srcLat, srcLon, dstLat, dstLon);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return { ...entry.result, source: 'CACHE' };
  }

  set(
    srcLat: number, srcLon: number,
    dstLat: number, dstLon: number,
    result: OsrmRouteResult,
    ttlSeconds: number
  ): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const key = this.buildKey(srcLat, srcLon, dstLat, dstLon);
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(): void {
    this.cache.clear();
  }

  stats(): { size: number; maxEntries: number } {
    return { size: this.cache.size, maxEntries: this.maxEntries };
  }
}

// Singleton cache instance
const routeCache = new RouteCache();

// ─── Core OSRM HTTP Fetch ─────────────────────────────────────────────────────

/**
 * Fetches a single driving route from OSRM between two coordinates.
 * Implements exponential backoff retry logic.
 */
async function fetchOsrmRoute(
  srcLat: number,
  srcLon: number,
  dstLat: number,
  dstLon: number
): Promise<OsrmRouteResult> {
  const { baseUrl, timeoutMs, maxRetries, retryDelayMs, cacheTtlSeconds } = env.osrm;

  // Check cache first
  const cached = routeCache.get(srcLat, srcLon, dstLat, dstLon);
  if (cached) {
    return cached;
  }

  // Build candidate OSRM server URLs (primary env URL + public OSRM fallback)
  const baseUrls = [baseUrl];
  if (baseUrl !== 'https://router.project-osrm.org') {
    baseUrls.push('https://router.project-osrm.org');
  }

  let lastError: Error | null = null;

  for (const currentBaseUrl of baseUrls) {
    const url = `${currentBaseUrl}/route/v1/driving/${srcLon},${srcLat};${dstLon},${dstLat}?overview=false&steps=false`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`OSRM HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as OsrmApiResponse;

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error(`OSRM returned code '${data.code}': ${data.message || 'No route found'}`);
        }

        const route = data.routes[0];
        const result: OsrmRouteResult = {
          distanceKm: Number((route.distance / 1000).toFixed(2)),
          durationMinutes: Number((route.duration / 60).toFixed(2)),
          source: 'OSRM',
        };

        // Cache the result
        routeCache.set(srcLat, srcLon, dstLat, dstLon, result, cacheTtlSeconds);

        return result;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;

        const isAbort = err.name === 'AbortError';
        const logMsg = isAbort
          ? `OSRM request timed out (${timeoutMs}ms) on attempt ${attempt}/${maxRetries} (${currentBaseUrl})`
          : `OSRM request failed on attempt ${attempt}/${maxRetries} (${currentBaseUrl}): ${err.message}`;

        console.warn(`[OSRM Client] ${logMsg} | route: ${srcLat},${srcLon}→${dstLat},${dstLon}`);

        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw new Error(
    `OSRM failed after ${maxRetries} attempts for route ${srcLat},${srcLon}→${dstLat},${dstLon}: ${lastError?.message}`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculates road distance and driving duration between two coordinates.
 * Uses cached result if available.
 */
export async function getRoadRoute(
  srcLat: number,
  srcLon: number,
  dstLat: number,
  dstLon: number
): Promise<OsrmRouteResult> {
  return fetchOsrmRoute(srcLat, srcLon, dstLat, dstLon);
}

/**
 * Calculates road routes from one source to multiple destinations in PARALLEL.
 * Uses Promise.allSettled to ensure one failure doesn't block all results.
 *
 * Returns an array of results — failed warehouses have `error` field set.
 */
export async function getParallelRoutes(
  srcLat: number,
  srcLon: number,
  destinations: Array<{ id: string; latitude: number; longitude: number }>
): Promise<OsrmWarehouseResult[]> {
  const tasks = destinations.map(async (dest) => {
    try {
      const route = await fetchOsrmRoute(srcLat, srcLon, dest.latitude, dest.longitude);
      return {
        warehouseId: dest.id,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        source: route.source,
      } as OsrmWarehouseResult;
    } catch (err: any) {
      console.error(`[OSRM Client] Failed for warehouse ${dest.id}: ${err.message}`);
      return {
        warehouseId: dest.id,
        distanceKm: Infinity,
        durationMinutes: Infinity,
        source: 'OSRM' as const,
        error: err.message,
      } as OsrmWarehouseResult;
    }
  });

  return Promise.all(tasks);
}

/**
 * Health check — pings the OSRM server root endpoint.
 * Returns true if healthy, false if unreachable.
 */
export async function pingOsrm(): Promise<{ healthy: boolean; responseTimeMs: number; error?: string }> {
  const { baseUrl, timeoutMs } = env.osrm;
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Ping a known route (Delhi → Kolkata) as a real connectivity test
    const url = `${baseUrl}/route/v1/driving/77.2090,28.6139;88.3639,22.5726?overview=false`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const responseTimeMs = Date.now() - start;
    return { healthy: response.ok, responseTimeMs };
  } catch (err: any) {
    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;
    return {
      healthy: false,
      responseTimeMs,
      error: err.name === 'AbortError' ? `Timed out after ${timeoutMs}ms` : err.message,
    };
  }
}

/**
 * Invalidates the entire in-memory route cache.
 * Call this after warehouse coordinates change.
 */
export function invalidateRouteCache(): void {
  routeCache.invalidate();
  console.info('[OSRM Client] Route cache invalidated.');
}

/**
 * Returns route cache statistics.
 */
export function getRouteCacheStats(): { size: number; maxEntries: number } {
  return routeCache.stats();
}
