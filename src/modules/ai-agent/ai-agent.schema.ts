import { z } from "zod";

// ─── General Chat ─────────────────────────────────────────────────────────────
export const AiChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1),
      })
    )
    .min(1),
  context: z
    .object({
      view: z.string().optional(),
      entityId: z.string().optional(),
      entityType: z.string().optional(),
    })
    .optional(),
  stream: z.boolean().default(false),
});

// ─── Draft Email Reply ────────────────────────────────────────────────────────
export const AiDraftReplySchema = z.object({
  poId: z.string().uuid("Valid PO ID required"),
  tone: z
    .enum(["professional", "friendly", "urgent", "apologetic"])
    .default("professional"),
  instructions: z.string().max(500).optional(),
  includeStockCheck: z.boolean().default(true),
});

// ─── Business Report ──────────────────────────────────────────────────────────
export const AiReportSchema = z.object({
  reportType: z.enum([
    "executive_summary",
    "po_analysis",
    "quotation_pipeline",
    "inventory_health",
    "payment_reconciliation",
    "dispatch_sla",
    "low_stock_alerts",
    "customer_activity",
    "revenue_trends",
  ]),
  dateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  format: z.enum(["text", "json", "markdown"]).default("markdown"),
});

export type AiChatInput = z.infer<typeof AiChatSchema>;
export type AiDraftReplyInput = z.infer<typeof AiDraftReplySchema>;
export type AiReportInput = z.infer<typeof AiReportSchema>;
