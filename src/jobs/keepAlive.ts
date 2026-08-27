import { logger } from '../config/logger';

// ─── Keep-Alive Pinger (Render Free Tier Sleep Prevention) ───────────────────
//
// Render free plan spins down services after 15 minutes of inactivity.
// This job pings the server's own /health endpoint every 4 minutes to
// keep it permanently warm — well within the 15-minute sleep threshold.
//
// Runs in production only. First ping fires 30 seconds after boot to allow
// full database initialization before hitting the health endpoint.

let keepAliveInterval: NodeJS.Timeout | null = null;

const PING_INTERVAL_MS = 4 * 60 * 1000;  // 4 minutes — well below Render's 15min sleep threshold
const STARTUP_DELAY_MS = 30 * 1000;       // 30 seconds after boot
const FETCH_TIMEOUT_MS = 10_000;          // 10 second timeout per ping

const ping = async (url: string): Promise<void> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    logger.info(`[KeepAlive] ✅ Ping OK → ${url} (${res.status})`);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      logger.warn(`[KeepAlive] ⚠️  Ping timed out → ${url}`);
    } else {
      logger.warn(`[KeepAlive] ⚠️  Ping failed → ${url}: ${err?.message || err}`);
    }
  } finally {
    clearTimeout(timer);
  }
};

export const startKeepAlive = (): void => {
  // Only run in production (Render deployment)
  if (process.env.NODE_ENV !== 'production') return;

  // Determine the self URL — use RENDER_EXTERNAL_URL if available, fallback to localhost
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  const port = process.env.PORT || 3000;
  const selfUrl = renderUrl
    ? `${renderUrl}/health`
    : `http://localhost:${port}/health`;

  logger.info(`[KeepAlive] 🚀 Server self-ping every ${PING_INTERVAL_MS / 60000} min → ${selfUrl}`);
  logger.info(`[KeepAlive]    Render sleep threshold: 15 min | Our interval: ${PING_INTERVAL_MS / 60000} min — server will NEVER sleep.`);

  // Delay first ping to let the server fully boot
  setTimeout(() => {
    ping(selfUrl);
    keepAliveInterval = setInterval(() => ping(selfUrl), PING_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
};

export const stopKeepAlive = (): void => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    logger.info('[KeepAlive] Stopped.');
  }
};
