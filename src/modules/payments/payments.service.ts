import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import type {
  CreatePaymentOrderInput,
  VerifyPaymentInput,
  RefundPaymentInput,
} from './payments.schema';

interface UserContext {
  id: string;
  roleSlug: string;
  permissions: string[];
}

const formatPayment = (payment: any) => {
  if (!payment) return null;
  return {
    ...payment,
    amount: Number(payment.amount),
    refundedAmount: payment.refundedAmount !== undefined ? Number(payment.refundedAmount) : 0,
  };
};

const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret) {
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return null;
};

export const createPaymentOrder = async (userId: string, input: CreatePaymentOrderInput) => {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      grandTotal: true,
      status: true,
      paymentStatus: true,
    },
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  const amountNumber = input.amount !== undefined ? input.amount : Number(order.grandTotal);
  const currency = input.currency || 'INR';
  const razorpay = getRazorpayInstance();

  let razorpayOrderId: string;
  let isMock = false;

  if (razorpay) {
    try {
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amountNumber * 100), // Amount in paise
        currency,
        receipt: order.orderNumber,
        notes: {
          orderId: order.id,
          userId,
        },
      });
      razorpayOrderId = razorpayOrder.id;
    } catch (error: any) {
      console.error('[Razorpay Order Error]', error);
      // Fallback to mock if API fails in non-prod
      if (process.env.NODE_ENV !== 'production') {
        razorpayOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        isMock = true;
      } else {
        throw new AppError('PAYMENT_ERROR', `Razorpay error: ${error.message || 'Order creation failed'}`, 500);
      }
    }
  } else {
    // Gracefully mock in dev if RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing
    razorpayOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    isMock = true;
  }

  // Create or update Payment record
  const existingPayment = await prisma.payment.findFirst({
    where: { orderId: order.id, status: PaymentStatus.PENDING },
  });

  let payment;
  if (existingPayment) {
    payment = await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        amount: amountNumber,
        currency,
        method: PaymentMethod.RAZORPAY,
        razorpayOrderId,
        status: PaymentStatus.PENDING,
      },
    });
  } else {
    payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        userId,
        amount: amountNumber,
        currency,
        method: PaymentMethod.RAZORPAY,
        status: PaymentStatus.PENDING,
        razorpayOrderId,
      },
    });
  }

  return {
    id: payment.id,
    orderId: order.id,
    razorpayOrderId,
    amount: amountNumber,
    currency,
    status: payment.status,
    key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key',
    isMock,
  };
};

export const verifyPayment = async (userId: string, input: VerifyPaymentInput) => {
  const payment = await prisma.payment.findFirst({
    where: {
      orderId: input.orderId,
      razorpayOrderId: input.razorpayOrderId,
    },
  });

  if (!payment) {
    throw new AppError('NOT_FOUND', 'Payment record not found for this order and Razorpay order ID', 404);
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  const hasKeys = Boolean(keyId && keySecret);

  let isValid = false;

  if (isProduction && hasKeys) {
    // In production with real Razorpay keys configured: NEVER accept mock signatures or mock orders
    if (input.razorpaySignature === 'mock_signature' || input.razorpayOrderId.startsWith('order_mock_')) {
      isValid = false;
    } else {
      try {
        const generatedSignature = crypto
          .createHmac('sha256', keySecret!)
          .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
          .digest('hex');

        const genBuf = Buffer.from(generatedSignature, 'utf8');
        const sigBuf = Buffer.from(input.razorpaySignature, 'utf8');
        isValid = genBuf.length === sigBuf.length && crypto.timingSafeEqual(genBuf, sigBuf);
      } catch (error) {
        isValid = false;
      }
    }
  } else {
    // Dev environment OR Razorpay keys missing/not configured
    if (!keySecret || input.razorpayOrderId.startsWith('order_mock_') || input.razorpaySignature === 'mock_signature') {
      isValid = true;
    } else {
      try {
        const generatedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
          .digest('hex');

        const genBuf = Buffer.from(generatedSignature, 'utf8');
        const sigBuf = Buffer.from(input.razorpaySignature, 'utf8');
        isValid = genBuf.length === sigBuf.length && crypto.timingSafeEqual(genBuf, sigBuf);
      } catch (error) {
        isValid = false;
      }
    }
  }

  if (!isValid) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          razorpayPaymentId: input.razorpayPaymentId,
          razorpaySignature: input.razorpaySignature,
          errorDetails: { message: 'Invalid Razorpay signature' },
        },
      }),
      prisma.order.update({
        where: { id: input.orderId },
        data: { paymentStatus: PaymentStatus.FAILED },
      }),
    ]);

    throw new AppError('PAYMENT_VERIFICATION_FAILED', 'Invalid Razorpay payment signature', 400);
  }

  // Signature valid -> complete payment and update order
  const [updatedPayment, updatedOrder] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.COMPLETED,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        userId: payment.userId || userId,
      },
    }),
    prisma.order.update({
      where: { id: input.orderId },
      data: {
        paymentStatus: PaymentStatus.COMPLETED,
        status: OrderStatus.PROCESSING,
      },
    }),
  ]);

  return {
    success: true,
    verified: true,
    payment: formatPayment(updatedPayment),
    orderId: updatedOrder.id,
    orderStatus: updatedOrder.status,
    paymentStatus: updatedOrder.paymentStatus,
  };
};

export const getPaymentByOrderId = async (orderId: string, user: UserContext) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true },
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  const isAdmin =
    user.roleSlug === 'admin' ||
    user.roleSlug === 'super-admin' ||
    user.permissions.includes('payments.read');

  if (!isAdmin && order.userId !== user.id) {
    throw new AppError('FORBIDDEN', 'Access denied to payment details', 403);
  }

  const payments = await prisma.payment.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });

  if (payments.length === 0) {
    throw new AppError('NOT_FOUND', 'No payment records found for this order', 404);
  }

  return payments.map(formatPayment);
};

export const refundPayment = async (user: UserContext, input: RefundPaymentInput) => {
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    include: { order: true },
  });

  if (!payment) {
    throw new AppError('NOT_FOUND', 'Payment record not found', 404);
  }

  const partiallyRefundedStatus = (PaymentStatus as any).PARTIALLY_REFUNDED;

  const paymentAmount = Number(payment.amount);
  const totalAlreadyRefunded = Number((payment as any).refundedAmount || 0);
  const maxRefundable = Number((paymentAmount - totalAlreadyRefunded).toFixed(2));

  const isEligibleStatus =
    payment.status === PaymentStatus.COMPLETED ||
    (partiallyRefundedStatus && payment.status === partiallyRefundedStatus) ||
    maxRefundable > 0;

  if (!isEligibleStatus) {
    throw new AppError(
      'BAD_REQUEST',
      `Only COMPLETED or PARTIALLY_REFUNDED payments can be refunded. Current status is ${payment.status}`,
      400
    );
  }

  const requestedAmount = input.amount !== undefined ? input.amount : maxRefundable;

  if (requestedAmount > maxRefundable || requestedAmount > paymentAmount) {
    throw new AppError(
      'BAD_REQUEST',
      `Requested refund amount (${requestedAmount}) exceeds valid payment amount (${Math.max(0, maxRefundable)})`,
      400
    );
  }

  if (requestedAmount <= 0) {
    throw new AppError('BAD_REQUEST', 'Refund amount must be greater than 0', 400);
  }

  const refundAmount = requestedAmount;
  const newTotalRefunded = Number((totalAlreadyRefunded + refundAmount).toFixed(2));
  const isFullRefund = newTotalRefunded >= paymentAmount;

  const targetPaymentStatus = isFullRefund
    ? PaymentStatus.REFUNDED
    : (partiallyRefundedStatus || PaymentStatus.COMPLETED);

  const targetOrderPaymentStatus = isFullRefund
    ? PaymentStatus.REFUNDED
    : (partiallyRefundedStatus || PaymentStatus.REFUNDED);

  const razorpay = getRazorpayInstance();

  let refundId = `rfnd_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (razorpay && payment.razorpayPaymentId && !payment.razorpayPaymentId.startsWith('pay_mock_')) {
    try {
      const refundRes = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(refundAmount * 100),
        notes: { reason: input.reason || 'Admin initiated refund' },
      });
      refundId = refundRes.id;
    } catch (error: any) {
      console.error('[Razorpay Refund Error]', error);
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('REFUND_FAILED', `Razorpay refund error: ${error.message}`, 500);
      }
    }
  }

  const [updatedPayment] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: targetPaymentStatus,
        refundedAmount: newTotalRefunded,
      } as any,
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: targetOrderPaymentStatus,
      },
    }),
  ]);

  return {
    refundId,
    status: 'processed',
    paymentId: payment.id,
    orderId: payment.orderId,
    amount: refundAmount,
    reason: input.reason || 'Refund requested',
    payment: formatPayment(updatedPayment),
  };
};
