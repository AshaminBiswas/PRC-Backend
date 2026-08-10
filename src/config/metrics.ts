import client from 'prom-client';

// ─── Collect Default Node.js Process & V8 Metrics (CPU, Memory, Event Loop Lag)
client.collectDefaultMetrics({ prefix: 'prc_' });

// ─── RED Metrics (Rate, Errors, Duration) ────────────────────────────────────

export const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'prc_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const httpRequestsTotal = new client.Counter({
  name: 'prc_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const activeConnectionsGauge = new client.Gauge({
  name: 'prc_active_connections',
  help: 'Number of active HTTP connections',
});

export const register = client.register;
