import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../config/database";
import { AiChatInput, AiDraftReplyInput, AiReportInput } from "./ai-agent.schema";

const NVIDIA_API_URL = `${env.nvidia.baseUrl}/chat/completions`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface NvidiaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface NvidiaResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ─── Core NVIDIA NIM Caller ───────────────────────────────────────────────────

async function callNvidiaModel(
  messages: NvidiaMessage[],
  options: { maxTokens?: number; temperature?: number; topP?: number } = {}
): Promise<string> {
  if (!env.nvidia.apiKey) {
    throw new Error(
      "NVIDIA_API_KEY is not configured. Please add it to your Render environment variables."
    );
  }

  const payload = {
    model: env.nvidia.model,
    messages,
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.6,
    top_p: options.topP ?? 0.9,
    stream: false,
  };

  const response = await axios.post<NvidiaResponse>(NVIDIA_API_URL, payload, {
    headers: {
      Authorization: `Bearer ${env.nvidia.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 60000,
  });

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("NVIDIA NIM returned an empty response.");

  const usage = response.data?.usage;
  if (usage) {
    logger.info(
      `[AI Agent] NVIDIA NIM tokens — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`
    );
  }

  return content;
}

// ─── 1. General Admin Copilot Chat ───────────────────────────────────────────

export async function adminCopilotChat(input: AiChatInput): Promise<{
  reply: string;
  model: string;
}> {
  const systemPrompt = `You are the PRC PILOT — an intelligent business assistant for Pacific Rehousing Corporation, a premium hardware products company based in India.

LANGUAGE & COMMUNICATION RULES:
- Always use proper, articulate, grammatically correct, and professional standard English.
- Avoid broken syntax, slang, informal contractions, or colloquial fillers.
- Maintain a courteous, executive tone suitable for B2B trade, hardware engineering, and corporate operations.

You assist the admin team with:
- Analyzing purchase orders (POs), proforma invoices (PIs), quotations, and customer inquiries.
- Detecting order statuses, courier dispatch timelines, and payment reconciliation.
- Summarizing inventory levels and alerting on low-stock items requiring replenishment.
- Drafting fluent, professional B2B customer email replies.
- Generating clear, structured business reports with key performance metrics.

Always be concise, professional, and action-oriented. Apply Indian business context (GST, HSN codes, INR currency, Indian logistics) accurately.`;

  const messages: NvidiaMessage[] = [
    { role: "system", content: systemPrompt },
    ...input.messages,
  ];

  const reply = await callNvidiaModel(messages, { maxTokens: 1500, temperature: 0.6 });
  return { reply, model: env.nvidia.model };
}

// ─── 2. Smart PO Email Reply Drafter ─────────────────────────────────────────

export async function draftPoEmailReply(input: AiDraftReplyInput): Promise<{
  subject: string;
  body: string;
  suggestedStatus: string;
  detectedContext: string;
  model: string;
}> {
  const po = await prisma.poSubmission.findUnique({
    where: { id: input.poId },
    include: {
      emails: {
        orderBy: { receivedAt: "asc" },
        take: 5,
      },
      attachments: { take: 10 },
    },
  });

  if (!po) throw new Error(`PO submission ${input.poId} not found`);

  // Build stock context
  let stockContext = "";
  if (input.includeStockCheck) {
    try {
      const lowStockItems = await prisma.product.findMany({
        where: { stock: { lte: 10 }, status: "ACTIVE" },
        select: { name: true, sku: true, stock: true },
        orderBy: { stock: "asc" },
        take: 10,
      });
      if (lowStockItems.length > 0) {
        stockContext = `\n\nCURRENT INVENTORY ALERTS:\n${lowStockItems
          .map((p) => `- ${p.name} (SKU: ${p.sku}): ${p.stock} units left`)
          .join("\n")}`;
      }
    } catch (err) {
      logger.warn("[AI Agent] Could not fetch stock context:", err);
    }
  }

  const emailThread = (po.emails ?? [])
    .map(
      (msg, i) =>
        `[Message ${i + 1} — ${msg.direction} — ${new Date(msg.receivedAt).toLocaleDateString("en-IN")}]\nFrom: ${msg.senderEmail}\nSubject: ${msg.subject ?? "(No Subject)"}\n\n${(msg.plainTextBody ?? "").slice(0, 800) || "(No body)"}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are a professional B2B corporate correspondence composer for PRC Hardware (Pacific Rehousing Corporation).

LANGUAGE & COMMUNICATION RULES:
- Write in flawless, elegant, and grammatically precise standard English.
- Maintain formal yet warm corporate etiquette appropriate for high-value B2B trade.
- Ensure all sentences are complete, clearly structured, and free of colloquialisms or grammatical flaws.

Your task is to draft a professional, courteous, and action-oriented email reply based on the purchase order details and customer email thread provided.

RESPONSE FORMAT (return valid JSON only, no markdown fences):
{
  "subject": "Re: [Subject Line Here]",
  "body": "Full email body text here...",
  "suggestedStatus": "WAITING_FOR_CUSTOMER|IN_PROGRESS|APPROVED|COMPLETED",
  "detectedContext": "Brief 1-line summary of what you detected in this PO"
}

TONE: ${input.tone}
${input.instructions ? `ADDITIONAL INSTRUCTIONS FROM ADMIN: ${input.instructions}` : ""}`;

  const userMessage = `PO SUBMISSION DETAILS:
- PO ID: ${po.poSubmissionId || po.id}
- Customer PO Number: ${po.customerPoNumber || "Not specified"}
- Classification: ${po.classification || "Unknown"}
- Status: ${po.status}
- Customer: ${po.customerName || "Unknown"} <${po.customerEmail}>
- Company: ${po.companyName || "N/A"}
- Subject: ${po.subject || "N/A"}

EMAIL THREAD:
${emailThread || "(No email thread found)"}
${stockContext}

Draft a professional reply email now.`;

  const rawReply = await callNvidiaModel(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    { maxTokens: 1500, temperature: 0.5 }
  );

  let parsed: { subject: string; body: string; suggestedStatus: string; detectedContext: string };
  try {
    const cleaned = rawReply.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      subject: `Re: ${po.subject || "Your Purchase Order"}`,
      body: rawReply,
      suggestedStatus: "IN_PROGRESS",
      detectedContext: "AI analysis completed.",
    };
  }

  return { ...parsed, model: env.nvidia.model };
}

// ─── 3. Business Data Report Generator ───────────────────────────────────────

export async function generateBusinessReport(input: AiReportInput): Promise<{
  report: string;
  reportType: string;
  generatedAt: string;
  model: string;
}> {
  const now = new Date();
  const fromDate = input.dateRange?.from
    ? new Date(input.dateRange.from)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const toDate = input.dateRange?.to ? new Date(input.dateRange.to) : now;

  let dataContext = "";

  if (
    input.reportType === "executive_summary" ||
    input.reportType === "revenue_trends"
  ) {
    const [orderStats, poStats, quoteStats] = await Promise.all([
      prisma.order.groupBy({
        by: ["status"],
        _count: true,
        _sum: { grandTotal: true },
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
      prisma.poSubmission.groupBy({
        by: ["status"],
        _count: true,
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
      prisma.quote.groupBy({
        by: ["status"],
        _count: true,
        _sum: { grandTotal: true },
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
    ]);

    dataContext = `
EXECUTIVE SUMMARY DATA (${fromDate.toLocaleDateString("en-IN")} to ${toDate.toLocaleDateString("en-IN")}):

ORDERS BY STATUS:
${orderStats.map((s) => `- ${s.status}: ${s._count} orders, Revenue: ₹${Number(s._sum?.grandTotal ?? 0).toFixed(2)}`).join("\n") || "No data"}

PO SUBMISSIONS BY STATUS:
${poStats.map((s) => `- ${s.status}: ${s._count} POs`).join("\n") || "No data"}

QUOTATIONS BY STATUS:
${quoteStats.map((s) => `- ${s.status}: ${s._count} quotes, Value: ₹${Number(s._sum?.grandTotal ?? 0).toFixed(2)}`).join("\n") || "No data"}`;
  } else if (
    input.reportType === "inventory_health" ||
    input.reportType === "low_stock_alerts"
  ) {
    const [lowStock, outOfStockCount] = await Promise.all([
      prisma.product.findMany({
        where: { stock: { lte: 20, gt: 0 }, status: "ACTIVE" },
        select: { name: true, sku: true, stock: true, price: true },
        orderBy: { stock: "asc" },
        take: 20,
      }),
      prisma.product.count({ where: { stock: 0, status: "ACTIVE" } }),
    ]);

    dataContext = `
INVENTORY HEALTH REPORT:
OUT OF STOCK PRODUCTS: ${outOfStockCount}
LOW STOCK (≤20 units):
${lowStock.map((p) => `- ${p.name} (SKU: ${p.sku}): ${p.stock} units @ ₹${p.price}`).join("\n") || "None"}`;
  } else if (input.reportType === "po_analysis") {
    const [byClassification, byPriority, recent] = await Promise.all([
      prisma.poSubmission.groupBy({
        by: ["classification"],
        _count: true,
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
      prisma.poSubmission.groupBy({
        by: ["priority"],
        _count: true,
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
      prisma.poSubmission.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        select: {
          poSubmissionId: true,
          customerName: true,
          companyName: true,
          status: true,
          classification: true,
          priority: true,
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    dataContext = `
PO ANALYSIS (${fromDate.toLocaleDateString("en-IN")} to ${toDate.toLocaleDateString("en-IN")}):

BY CLASSIFICATION:
${byClassification.map((c) => `- ${c.classification || "Unclassified"}: ${c._count}`).join("\n") || "No data"}

BY PRIORITY:
${byPriority.map((p) => `- ${p.priority || "NORMAL"}: ${p._count}`).join("\n") || "No data"}

RECENT POs:
${recent.slice(0, 10).map((p) => `- ${p.poSubmissionId}: ${p.customerName || "Unknown"} (${p.companyName || "N/A"}) — ${p.status} [${p.priority}]`).join("\n") || "No data"}`;
  } else if (input.reportType === "quotation_pipeline") {
    const quotes = await prisma.quote.groupBy({
      by: ["status"],
      _count: true,
      _sum: { grandTotal: true },
      where: { createdAt: { gte: fromDate, lte: toDate } },
    });

    dataContext = `
QUOTATION PIPELINE (${fromDate.toLocaleDateString("en-IN")} to ${toDate.toLocaleDateString("en-IN")}):
${quotes.map((q) => `- ${q.status}: ${q._count} quotes, Value: ₹${Number(q._sum?.grandTotal ?? 0).toFixed(2)}`).join("\n") || "No data"}`;
  } else if (input.reportType === "payment_reconciliation") {
    const payments = await prisma.payment.groupBy({
      by: ["status", "method"],
      _count: true,
      _sum: { amount: true },
      where: { createdAt: { gte: fromDate, lte: toDate } },
    });

    dataContext = `
PAYMENT RECONCILIATION (${fromDate.toLocaleDateString("en-IN")} to ${toDate.toLocaleDateString("en-IN")}):
${payments.map((p) => `- ${p.status} via ${p.method}: ${p._count} transactions, ₹${Number(p._sum?.amount ?? 0).toFixed(2)}`).join("\n") || "No data"}`;
  } else {
    dataContext = `Report type: ${input.reportType}. Provide general PRC Hardware business analysis.`;
  }

  const systemPrompt = `You are the PRC Hardware Business Intelligence AI. Generate a comprehensive, professional business report in ${input.format} format.

The report should:
1. Start with a brief executive summary.
2. Highlight key insights and anomalies.
3. Provide clear, actionable recommendations.
4. Use Indian business context (INR currency, Indian date format, etc).
5. Be concise but thorough.`;

  const userMessage = `Generate a ${input.reportType.replace(/_/g, " ").toUpperCase()} report based on this data:\n\n${dataContext}`;

  const report = await callNvidiaModel(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    { maxTokens: 2048, temperature: 0.4 }
  );

  return {
    report,
    reportType: input.reportType,
    generatedAt: now.toISOString(),
    model: env.nvidia.model,
  };
}

