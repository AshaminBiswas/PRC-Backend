import { Router } from 'express';
import * as controller from './quotes.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  ListQuotesQuerySchema,
  CreateQuoteSchema,
  QuoteIdParamSchema,
  UpdateQuoteStatusSchema,
  ConvertQuoteSchema,
  UpdateQuotePricingSchema,
} from './quotes.schema';

const router = Router();

// GET / - Paginated list (Admin gets all, B2B customer gets own)
router.get(
  '/',
  authenticate,
  validate(ListQuotesQuerySchema, 'query'),
  controller.listQuotes
);

// POST / - Submit B2B quote request
router.post(
  '/',
  authenticate,
  validate(CreateQuoteSchema),
  controller.createQuote
);

// GET /:id - Quote detail
router.get(
  '/:id',
  authenticate,
  validate(QuoteIdParamSchema, 'params'),
  controller.getQuoteById
);

// PUT /:id - Customer update their own PENDING quotation
router.put(
  '/:id',
  authenticate,
  validate(QuoteIdParamSchema, 'params'),
  validate(CreateQuoteSchema),
  controller.updateCustomerQuote
);

// PATCH /:id/status - Admin status transition
router.patch(
  '/:id/status',
  authenticate,
  authorize('quotes.approve'),
  validate(QuoteIdParamSchema, 'params'),
  validate(UpdateQuoteStatusSchema),
  controller.updateQuoteStatus
);

// POST /:id/convert - Admin convert approved quote to order
router.post(
  '/:id/convert',
  authenticate,
  authorize('quotes.approve'),
  validate(QuoteIdParamSchema, 'params'),
  validate(ConvertQuoteSchema),
  controller.convertQuote
);

// PATCH /:id - Admin update quote pricing / notes
router.patch(
  '/:id',
  authenticate,
  authorize('quotes.update'),
  validate(QuoteIdParamSchema, 'params'),
  validate(UpdateQuotePricingSchema),
  controller.updateQuotePricing
);

export default router;
