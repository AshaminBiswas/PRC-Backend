import { Router } from 'express';
import * as controller from './quotes.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, optionalAuthenticate } from '../../middleware/auth.middleware';
import {
  CreateB2BQuoteSchema,
  TrackQuoteQuerySchema,
  CustomerResponseSchema,
  AdminUpdateQuoteStatusSchema,
  AdminUpdateQuoteItemsSchema,
  SignQuoteSchema,
  VerifySignatureSchema,
  ListQuotesQuerySchema,
  QuoteIdParamSchema,
  TokenParamSchema,
} from './quotes.schema';

const router = Router();

// ─── Public & B2B Customer Endpoints ──────────────────────────────────────────

// 1. Submit B2B quotation request
router.post(
  '/',
  optionalAuthenticate,
  validate(CreateB2BQuoteSchema),
  controller.createQuote
);

// 2. Universal Tracking: Look up quotation by Reference No, Email, GSTIN, or Phone
router.get(
  '/track',
  validate(TrackQuoteQuerySchema, 'query'),
  controller.trackQuotes
);

// 3. View approved quotation via secure access token
router.get(
  '/public/:token',
  validate(TokenParamSchema, 'params'),
  controller.getQuoteByToken
);

// 4. Customer accept or decline quotation via token
router.post(
  '/public/:token/respond',
  validate(TokenParamSchema, 'params'),
  validate(CustomerResponseSchema),
  controller.respondToQuote
);

// 5. Verify cryptographic digital signature & authenticity
router.post(
  '/verify-signature',
  validate(VerifySignatureSchema),
  controller.verifySignature
);

// ─── Admin Console Endpoints ──────────────────────────────────────────────────

// 6. Admin paginated list with metrics & filters
router.get(
  '/',
  authenticate,
  authorize('quotes.read'),
  validate(ListQuotesQuerySchema, 'query'),
  controller.listQuotes
);

// 7. Admin quote detail by ID with full audit log
router.get(
  '/:id',
  authenticate,
  authorize('quotes.read'),
  validate(QuoteIdParamSchema, 'params'),
  controller.getQuoteById
);

// 8. Admin status transition with mandatory note for pending/rejected
router.patch(
  '/:id/status',
  authenticate,
  authorize('quotes.approve'),
  validate(QuoteIdParamSchema, 'params'),
  validate(AdminUpdateQuoteStatusSchema),
  controller.updateQuoteStatus
);

// 9. Admin edit line items, rates, quantities, and shipping cost
router.patch(
  '/:id/items',
  authenticate,
  authorize('quotes.update'),
  validate(QuoteIdParamSchema, 'params'),
  validate(AdminUpdateQuoteItemsSchema),
  controller.updateQuoteItems
);

// 10. Admin digitally sign, encode QR code, and approve
router.post(
  '/:id/sign',
  authenticate,
  authorize('quotes.approve'),
  validate(QuoteIdParamSchema, 'params'),
  validate(SignQuoteSchema),
  controller.digitallySignQuote
);

// 11. Admin soft delete quotation
router.delete(
  '/:id',
  authenticate,
  authorize('quotes.delete'),
  validate(QuoteIdParamSchema, 'params'),
  controller.deleteQuote
);

export default router;
