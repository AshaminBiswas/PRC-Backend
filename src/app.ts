import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { morganStream } from './config/logger';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

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

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

if (env.scaling.trustProxy) {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet());

// Horizontal Scaling & Load Balancing Instance Identification
app.use((_req, res, next) => {
  res.setHeader('X-Instance-ID', env.INSTANCE_ID);
  next();
});

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.cors.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// HTTP logging (routed through Winston)
app.use(morgan(env.isDev ? 'dev' : 'combined', { stream: morganStream }));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// General rate limiter (all routes)
app.use(generalLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────

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

import { serveDocsJson, serveDocsUi } from './config/swagger';

// ─── API Routes ───────────────────────────────────────────────────────────────

const prefix = env.API_PREFIX;

// OpenAPI Documentation
app.get(`${prefix}/docs.json`, serveDocsJson);
app.get(`${prefix}/docs`, serveDocsUi);

app.use(`${prefix}/auth`, authRoutes);
app.use(`${prefix}/users`, usersRoutes);
app.use(`${prefix}/roles`, rolesRoutes);
app.use(`${prefix}/permissions`, rolesRoutes); // /permissions shares roles router
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

// ─── Razorpay Webhooks (raw body required — mounted BEFORE json parser) ───────
// Note: webhook route uses express.raw() internally, so it must be registered
// after the body parsers but uses its own raw body middleware.
app.use(`${prefix}/payments/webhook`, webhookRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
