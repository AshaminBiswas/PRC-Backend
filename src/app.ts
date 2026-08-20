import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { morganStream } from './config/logger';
import compression from 'compression';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { serveDocsJson, serveDocsUi } from './config/swagger';

// ─── Module Routes ────────────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import rolesRoutes from './modules/roles/roles.routes';
import categoriesRoutes from './modules/categories/categories.routes';
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

import inventoryRoutes from './modules/inventory';
import venturesRoutes from './modules/inventory/ventures/ventures.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import allocationRoutes from './modules/allocation/allocation.routes';
import logisticsRoutes from './modules/logistics/logistics.routes';
import invoiceRoutes from './modules/invoices/invoices.routes';
import webhookRoutes from './modules/payments/webhook.routes';
import b2bPricingRoutes from './modules/b2b-pricing/b2b-pricing.routes';
import purchaseOrdersRoutes, { adminPurchaseOrdersRouter } from './modules/purchase-orders/purchase-orders.routes';
import customerPoSubmissionsRouter, { adminPoSubmissionsRouter } from './modules/po-submissions/po-submissions.routes';
import sseRoutes from './events/sse.routes';
import { initEventBus } from './events/eventBus';
import { startBullMQWorkers } from './queues/bullmq.worker';

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

// CORS (Allow configured origins, localhost, or reflect request origin safely)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Extract allowed origins from env or default to localhost
      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map((s: string) => s.trim()) 
        : ['http://localhost:5173', 'http://localhost:3001', 'http://127.0.0.1:5173', 'http://127.0.0.1:3001'];

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'],
  })
);

// HTTP logging (routed through Winston — health & readiness probes are skipped)
app.use(
  morgan(env.isDev ? 'dev' : 'combined', {
    stream: morganStream,
    skip: (req) => req.url === '/health' || req.url === '/ready',
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
    health: '/health',
    status: 'ONLINE',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'PRC Hardware API is running',
    version: '1.0.0',
    instanceId: env.INSTANCE_ID,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.get('/ready', (_req, res) => {
  res.json({
    success: true,
    ready: true,
    instanceId: env.INSTANCE_ID,
    timestamp: new Date().toISOString(),
  });
});

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

// ─── General Rate Limiter ──────────────────────────────────────────────────────
app.use(generalLimiter);

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use(`${prefix}/auth`, authRoutes);
app.use(`${prefix}/users`, usersRoutes);
app.use(`${prefix}/roles`, rolesRoutes);
app.use(`${prefix}/permissions`, rolesRoutes);
app.use(`${prefix}/categories`, categoriesRoutes);
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
app.use(`${prefix}/dashboard`, dashboardRoutes);
app.use(`${prefix}/reports`, reportsRoutes);
app.use(`${prefix}/inventory`, inventoryRoutes);
app.use(`${prefix}/ventures`, venturesRoutes);
app.use(`${prefix}/appointments`, appointmentsRoutes);
app.use(`${prefix}/allocation`, allocationRoutes);
app.use('/api/warehouse', allocationRoutes);
app.use(`${prefix}/logistics`, logisticsRoutes);
app.use(`${prefix}/invoices`, invoiceRoutes);
app.use(`${prefix}/b2b-pricing`, b2bPricingRoutes);
app.use(`${prefix}/purchase-orders`, purchaseOrdersRoutes);
app.use(`${prefix}/admin/purchase-orders`, adminPurchaseOrdersRouter);
app.use(`${prefix}/po-submissions`, customerPoSubmissionsRouter);
app.use(`${prefix}/admin/po-submissions`, adminPoSubmissionsRouter);
app.use(`${prefix}/admin/invoices`, adminPurchaseOrdersRouter);
app.use(`${prefix}/events`, sseRoutes);

// ─── Razorpay Webhooks (raw body required) ───────────────────────────────────
app.use(`${prefix}/payments/webhook`, webhookRoutes);

// ─── Initialize Event-Driven Architecture & BullMQ Background Workers ────────
initEventBus();
if (env.NODE_ENV !== 'test') {
  startBullMQWorkers();
}

// ─── Error Handling ───────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
