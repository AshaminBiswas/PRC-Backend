import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "../../config/database";
import { logger } from "../../config/logger";
import { PaymentStatus, OrderStatus } from "@prisma/client";

const router = Router();

// Razorpay sends events as raw body — we need to parse it ourselves
router.post(
  "/",
  // Use raw body so we can verify the signature before parsing JSON
  (req: Request, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Read raw body
    let rawBody = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { rawBody += chunk; });
    req.on("end", async () => {
      // -- Signature verification ----------------------------------------------
      if (webhookSecret && signature) {
        const expected = crypto
          .createHmac("sha256", webhookSecret)
          .update(rawBody)
          .digest("hex");
        if (expected !== signature) {
          logger.warn("[Webhook] Invalid Razorpay signature — request rejected");
          res.status(400).json({ error: "Invalid signature" });
          return;
        }
      } else if (process.env.NODE_ENV === "production") {
        logger.error("[Webhook] RAZORPAY_WEBHOOK_SECRET not configured in production");
        res.status(500).json({ error: "Webhook not configured" });
        return;
      }

      // -- Parse event --------------------------------------------------------
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        res.status(400).json({ error: "Invalid JSON body" });
        return;
      }

      const eventType = event.event as string;
      logger.info(`[Webhook] Received event: ${eventType}`);

      try {
        // -- payment.captured -----------------------------------------------
        if (eventType === "payment.captured") {
          const payload = (event.payload as Record<string, unknown>);
          const paymentEntity = (payload?.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
          const razorpayPaymentId = paymentEntity?.id as string | undefined;
          const razorpayOrderId = paymentEntity?.order_id as string | undefined;

          if (razorpayPaymentId && razorpayOrderId) {
            const payment = await prisma.payment.findFirst({
              where: { razorpayOrderId },
            });

            if (payment && payment.status !== PaymentStatus.COMPLETED) {
              await prisma.$transaction([
                prisma.payment.update({
                  where: { id: payment.id },
                  data: {
                    status: PaymentStatus.COMPLETED,
                    razorpayPaymentId,
                  },
                }),
                prisma.order.update({
                  where: { id: payment.orderId },
                  data: {
                    paymentStatus: PaymentStatus.COMPLETED,
                    status: OrderStatus.PROCESSING,
                  },
                }),
              ]);
              logger.info(`[Webhook] payment.captured — order ${payment.orderId} marked PROCESSING`);
            }
          }
        }

        // -- payment.failed -------------------------------------------------
        if (eventType === "payment.failed") {
          const payload = (event.payload as Record<string, unknown>);
          const paymentEntity = (payload?.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
          const razorpayOrderId = paymentEntity?.order_id as string | undefined;
          const errorDesc = paymentEntity?.error_description as string | undefined;

          if (razorpayOrderId) {
            const payment = await prisma.payment.findFirst({
              where: { razorpayOrderId },
            });

            if (payment && payment.status === PaymentStatus.PENDING) {
              await prisma.$transaction([
                prisma.payment.update({
                  where: { id: payment.id },
                  data: {
                    status: PaymentStatus.FAILED,
                    errorDetails: { message: errorDesc ?? "Payment failed" },
                  },
                }),
                prisma.order.update({
                  where: { id: payment.orderId },
                  data: { paymentStatus: PaymentStatus.FAILED },
                }),
              ]);
              logger.warn(`[Webhook] payment.failed — order ${payment.orderId}`);
            }
          }
        }

        // -- refund.processed -----------------------------------------------
        if (eventType === "refund.processed") {
          logger.info("[Webhook] refund.processed acknowledged");
        }

        res.json({ received: true });
      } catch (err) {
        logger.error("[Webhook] Handler error:", err);
        // Return 200 anyway to prevent Razorpay from retrying on our logic errors
        res.json({ received: true, warning: "Handler error — check logs" });
      }
    });
  }
);

export default router;
