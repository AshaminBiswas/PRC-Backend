import http from 'http';
import https from 'https';

// ─── Shared Keep-Alive Connection Pool Agents ─────────────────────────────────

export const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 500,
  maxFreeSockets: 50,
  timeout: 30000,
});

export const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 500,
  maxFreeSockets: 50,
  timeout: 30000,
});
