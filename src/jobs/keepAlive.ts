import { logger } from '../config/logger';

// ─── Keep-Alive Pinger (Render Free Tier Cold-Start Prevention) ───────────────
//
// Render free plan spins down services after 15 minutes of inactivity.
// This job pings the server's own /health endpoint every 10 minutes to
// keep it warm, eliminating the 30–50 second cold-start delay for users.
//
// Only runs in production. Starts 60 seconds after server boot to allow
// full initialization before the first ping.

let keepAliveInterval: NodeJS.Timeout | null = null;

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const STARTUP_DELAY_MS = 60 * 1000;       // 1 minute after boot
const FETCH_TIMEOUT_MS = 10_000;          // 10 second timeout per ping

const ping = async (url: string): Promise<void> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    logger.info(`[KeepAlive] Ping OK → ${url} (${res.status})`);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      logger.warn(`[KeepAlive] Ping timed out → ${url}`);
    } else {
      logger.warn(`[KeepAlive] Ping failed → ${url}: ${err?.message || err}`);
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

  logger.info(`[KeepAlive] Scheduled self-ping every 10 min → ${selfUrl}`);

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
