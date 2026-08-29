import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { morganStream } from './config/logger';
import compression from 'compression';
import { env } from './config/env';
import { generalLimiter, webhookLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { serveDocsJson, serveDocsUi } from './config/swagger';

// ─── Module Routes ────────────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import rolesRoutes from './modules/roles/roles.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import materialsRoutes from './modules/materials/materials.routes';
import productsRoutes from './modules/products/products.routes';
import variantsRoutes from './modules/variants/variants.routes';
import wishlistRoutes from './modules/wishlist/wishlist.routes';
import couponsRoutes from './modules/coupons/coupons.routes';
import shippingRoutes from './modules/shipping/shipping.routes';
import cartRoutes from './modules/cart/cart.routes';
import checkoutRoutes from './modules/checkout/checkout.routes';
import uploadRoutes from './modules/upload/upload.routes';
import ordersRoutes from './modules/orders/orders.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import quotesRoutes from './modules/quotes/quotes.routes';
import reviewsRoutes from './modules/reviews/reviews.routes';
import enquiriesRoutes from './modules/enquiries/enquiries.routes';
import cmsRoutes from './modules/cms/cms.routes';
import bannersRoutes from './modules/banners/banners.routes';
import homepageRoutes from './modules/homepage/homepage.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import searchRoutes from './modules/search/search.routes';
import settingsRoutes from './modules/settings/settings.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import reportsRoutes from './modules/reports/reports.routes';

import appointmentsRoutes from './modules/appointments/appointments.routes';
import allocationRoutes from './modules/allocation/allocation.routes';
import logisticsRoutes from './modules/logistics/logistics.routes';
import invoiceRoutes from './modules/invoices/invoices.routes';
import webhookRoutes from './modules/payments/webhook.routes';
import b2bPricingRoutes from './modules/b2b-pricing/b2b-pricing.routes';
import auditRoutes from './modules/audit/audit.routes';
import projectsRoutes from './modules/projects/projects.routes';
import poManagementRoutes from './modules/po-management/po-management.routes';
import aiAgentRoutes from './modules/ai-agent/ai-agent.routes';
import {
  branchesRouter,
  suppliersRouter,
  inventoryRouter,
  purchasesRouter,
  transfersRouter,
  stockAdjustmentsRouter,
  stockMovementsRouter,
  inventoryReportsRouter,
} from './modules/inventory/inventory.routes';

import sseRoutes from './events/sse.routes';
import { initEventBus } from './events/eventBus';
import { startBullMQWorkers } from './queues/bullmq.worker';
import { startKeepAlive } from './jobs/keepAlive';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

if (env.scaling.trustProxy) {
  app.set('trust proxy', 1);
}

// HTTP Response Compression (Gzip / Brotli with 1KB threshold & level 6 tuning)
app.use(
  compression({
    level: 6,
    threshold: 1024, // Don't compress responses smaller than 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      // Do not compress Server-Sent Events (SSE) streaming responses to prevent proxy buffering
      if (req.headers.accept === 'text/event-stream' || req.path?.includes('/events/stream')) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// Security headers with Swagger UI & CDN support in CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", 'https:'],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://unpkg.com',
          'https://cdn.jsdelivr.net',
        ],
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'",
          'https://unpkg.com',
          'https://cdn.jsdelivr.net',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://unpkg.com',
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        styleSrcElem: [
          "'self'",
          "'unsafe-inline'",
          'https://unpkg.com',
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'http:'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://unpkg.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Horizontal Scaling & Load Balancing Instance Identification
app.use((_req, res, next) => {
  res.setHeader('X-Instance-ID', env.INSTANCE_ID);
  next();
});

// CORS (Allow configured origins, localhost, Vercel deployments, or reflect request origin safely)
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Extract allowed origins from env or fallback list
    const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s: string) => s.trim().replace(/\/$/, ''))
      .filter(Boolean);

    const defaultAllowed = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'https://frontend-sage-pi-65.vercel.app',
      'https://admin-delta-kohl.vercel.app',
      env.frontend.url?.replace(/\/$/, ''),
      env.frontend.adminUrl?.replace(/\/$/, ''),
    ].filter(Boolean) as string[];

    const allAllowed = Array.from(new Set([...defaultAllowed, ...configuredOrigins]));
    const normalizedOrigin = origin.replace(/\/$/, '');

    // Check explicit match
    if (allAllowed.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow any *.vercel.app domain (including preview branches and production deployments)
    if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow localhost with any port (e.g. 5173, 5174, 5175, 3000, 3001) in all environments for local frontend/admin testing
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow local Wi-Fi / LAN IPs (e.g. 192.168.x.x, 10.x.x.x, 172.16-31.x.x) for testing from mobile devices and other laptops
    if (/^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow official production and staging domains
    if (/^https?:\/\/([a-zA-Z0-9_-]+\.)?(pacifichardware\.com|prchardware\.com)$/.test(normalizedOrigin)) {
      return callback(null, true);
    }

    // Safe permissive fallback for authenticated API calls
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  exposedHeaders: ['X-Instance-ID', 'Content-Range', 'X-Total-Count'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// HTTP logging (routed through Winston — health & readiness probes are skipped)
app.use(
  morgan(env.isDev ? 'dev' : 'combined', {
    stream: morganStream,
    skip: (req) =>
      req.url === '/health' ||
      req.url === '/ready' ||
      req.url === `${env.API_PREFIX}/health` ||
      req.url === `${env.API_PREFIX}/ready` ||
      req.url.endsWith('/health') ||
      req.url.endsWith('/ready'),
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Cookie parser — required for httpOnly refresh token cookie reads
app.use(cookieParser());

import path from 'path';

// ─── Health Checks & OpenAPI Documentation (Mounted BEFORE rate limiter) ──────

const prefix = env.API_PREFIX;

const serveHtmlDocs = (_req: express.Request, res: express.Response) => {
  const filePath = path.join(__dirname, 'public', 'docs.html');
  res.sendFile(filePath);
};

app.get('/', (_req, res) => {
  res.json({
    success: true,
    name: 'Pacific Hardware Enterprise REST API',
    version: '1.0.0',
    documentation: `${prefix}/docs-ui`,
    swaggerDocs: `${prefix}/docs`,
    health: `${prefix}/health`,
    status: 'ONLINE',
  });
});

const handleHealth = (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'PRC Hardware API is running',
    version: '1.0.0',
    instanceId: env.INSTANCE_ID,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
};

const handleReady = (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    ready: true,
    instanceId: env.INSTANCE_ID,
    timestamp: new Date().toISOString(),
  });
};

app.get(['/health', `${prefix}/health`], handleHealth);
app.get(['/ready', `${prefix}/ready`], handleReady);

// ─── Prometheus Metrics Endpoint ─────────────────────────────────────────────
import { register, httpRequestDurationMicroseconds, httpRequestsTotal } from './config/metrics';

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    httpRequestDurationMicroseconds.observe({ method: req.method, route, status_code: res.statusCode }, duration);
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.get('/docs-ui', serveHtmlDocs);
app.get(`${prefix}/docs-ui`, serveHtmlDocs);
app.get(`${prefix}/docs.json`, serveDocsJson);
app.get(`${prefix}/docs`, serveDocsUi);

// ─── Razorpay Webhooks (raw body required, high-throughput gateway limiter) ───
app.use(`${prefix}/payments/webhook`, webhookLimiter, webhookRoutes);

// ─── General Rate Limiter (Baseline fallback for all REST API routes) ────────
app.use((req, res, next) => {
  // Skip generalLimiter for SSE stream as it has its own dedicated sseLimiter
  if (req.path.startsWith(`${prefix}/events/stream`)) {
    return next();
  }
  return generalLimiter(req, res, next);
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use(`${prefix}/auth`, authRoutes);
app.use(`${prefix}/users`, usersRoutes);
app.use(`${prefix}/roles`, rolesRoutes);
app.use(`${prefix}/permissions`, rolesRoutes);
app.use(`${prefix}/categories`, categoriesRoutes);
app.use(`${prefix}/materials`, materialsRoutes);
app.use(`${prefix}/products/:productId/variants`, variantsRoutes);
app.use(`${prefix}/variants`, variantsRoutes);
app.use(`${prefix}/products`, productsRoutes);
app.use(`${prefix}/wishlist`, wishlistRoutes);
app.use(`${prefix}/coupons`, couponsRoutes);
app.use(`${prefix}/shipping`, shippingRoutes);
app.use(`${prefix}/cart`, cartRoutes);
app.use(`${prefix}/checkout`, checkoutRoutes);
app.use(`${prefix}/upload`, uploadRoutes);
app.use(`${prefix}/orders`, ordersRoutes);
app.use(`${prefix}/payments`, paymentsRoutes);
app.use(`${prefix}/quotes`, quotesRoutes);
app.use(`${prefix}/reviews`, reviewsRoutes);
app.use(`${prefix}/enquiries`, enquiriesRoutes);
app.use(`${prefix}/cms`, cmsRoutes);
app.use(`${prefix}/banners`, bannersRoutes);
app.use(`${prefix}/homepage`, homepageRoutes);
app.use(`${prefix}/notifications`, notificationsRoutes);
app.use(`${prefix}/search`, searchRoutes);
app.use(`${prefix}/settings`, settingsRoutes);
app.use(`${prefix}/projects`, projectsRoutes);
app.use(`${prefix}/dashboard`, dashboardRoutes);
app.use(`${prefix}/analytics`, dashboardRoutes);
app.use(`${prefix}/reports`, reportsRoutes);
app.use(`${prefix}/appointments`, appointmentsRoutes);
app.use(`${prefix}/allocation`, allocationRoutes);
app.use('/api/warehouse', allocationRoutes);
app.use(`${prefix}/logistics`, logisticsRoutes);
app.use(`${prefix}/invoices`, invoiceRoutes);
app.use(`${prefix}/b2b-pricing`, b2bPricingRoutes);
app.use(`${prefix}/audit`, auditRoutes);
app.use(`${prefix}/po-management`, poManagementRoutes);
app.use(`${prefix}/ai-agent`, aiAgentRoutes);
app.use(`${prefix}/events`, sseRoutes);

// ─── Multi-Branch Inventory Module Mounts ────────────────────────────────────
app.use(`${prefix}/branches`, branchesRouter);
app.use(`${prefix}/suppliers`, suppliersRouter);
app.use(`${prefix}/inventory`, inventoryRouter);
app.use(`${prefix}/purchases`, purchasesRouter);
app.use(`${prefix}/transfers`, transfersRouter);
app.use(`${prefix}/stock-adjustments`, stockAdjustmentsRouter);
app.use(`${prefix}/stock-movements`, stockMovementsRouter);
app.use(`${prefix}/reports`, inventoryReportsRouter);

app.get(`${prefix}/test-email`, async (req, res) => {
  try {
    const { sendMail } = await import('./utils/email.utils');
    const toEmail = (req.query.email as string) || 'ashaminbiswas1@gmail.com';
    await sendMail({
      to: toEmail,
      subject: 'PRC Diagnostic Email Test',
      html: `<h2>Hello!</h2><p>If you see this, your Render SMTP configuration is fully working for ${toEmail}!</p>`
    });
    res.status(200).json({
      success: true,
      message: `Diagnostic email successfully dispatched to ${toEmail}`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || String(err),
      hint: "Check if BREVO_API_KEY is still populated in Render and remove it if you want to force Gmail SMTP fallback."
    });
  }
});

// ─── Initialize Event-Driven Architecture & BullMQ Background Workers ────────
initEventBus();
if (env.NODE_ENV !== 'test') {
  startBullMQWorkers();
  startKeepAlive(); // Prevent Render free-tier cold starts (pings /health every 10 min)
}

// ─── Error Handling ───────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
