import { Router } from 'express';
import * as controller from './payments.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  CreatePaymentOrderSchema,
  VerifyPaymentSchema,
  OrderIdParamSchema,
  RefundPaymentSchema,
} from './payments.schema';

const router = Router();

// POST /create-order - Create Razorpay order
router.post(
  '/create-order',
  authenticate,
  validate(CreatePaymentOrderSchema),
  controller.createPaymentOrder
);

// POST /verify - Verify Razorpay payment signature
router.post(
  '/verify',
  authenticate,
  validate(VerifyPaymentSchema),
  controller.verifyPayment
);

// GET /:orderId - Get payment record for order
router.get(
  '/:orderId',
  authenticate,
  validate(OrderIdParamSchema, 'params'),
  controller.getPaymentByOrderId
);

// POST /refund - Initiate refund (Admin only)
router.post(
  '/refund',
  authenticate,
  authorize('payments.refund'),
  validate(RefundPaymentSchema),
  controller.refundPayment
);

export default router;
