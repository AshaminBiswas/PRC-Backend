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
  const systemPrompt = `You are the PRC PILOT — an intelligent business assistant for PRC Hardware, a premier B2B architectural hardware and building supplies company based in India.

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

  const defaultSubject = `Re: [${po.poSubmissionId || po.customerPoNumber || "PO"}] ${po.subject || "Purchase Order Update"}`;

  const systemPrompt = `You are a professional B2B corporate correspondence composer for PRC Hardware.

CRITICAL INSTRUCTIONS:
1. BREVITY & CONCISENESS: Keep the email reply short, crisp, and direct to the point (2 to 3 brief paragraphs maximum). Do NOT write lengthy or repetitive text.
2. LANGUAGE QUALITY: Write in articulate, elegant, and grammatically flawless standard English.
3. SUBJECT LINE: Make the subject line short, clear, and relevant. Example: "Re: [${po.poSubmissionId || po.customerPoNumber || "PO"}] Proforma Invoice & Order Confirmation".
4. COMPANY IDENTITY: Refer only to "PRC Hardware". NEVER use "Pacific Rehousing Corporation".
5. FORMAT: Return VALID JSON ONLY (no markdown code blocks, no backticks, no extra text outside the JSON object).

JSON SCHEMA:
{
  "subject": "Re: [${po.poSubmissionId || po.customerPoNumber || "PO"}] Specific Subject Line",
  "body": "Dear [Customer Name],\\n\\n[Paragraph 1: Direct acknowledgment & order status/PI update]\\n\\n[Paragraph 2: Stock availability or next action steps]\\n\\nWarm regards,\\nPRC Hardware Team\\nsales@pacifichardware.com",
  "suggestedStatus": "WAITING_FOR_CUSTOMER",
  "detectedContext": "Short 1-line summary of customer request"
}

TONE: ${input.tone}
${input.instructions ? `ADMIN INSTRUCTION: ${input.instructions}` : ""}`;

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

Draft a short, professional B2B reply email now in valid JSON format.`;

  const rawReply = await callNvidiaModel(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    { maxTokens: 1000, temperature: 0.4 }
  );

  let parsed = {
    subject: defaultSubject,
    body: "",
    suggestedStatus: "WAITING_FOR_CUSTOMER",
    detectedContext: "PO analyzed by PRC PILOT",
  };

  try {
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.subject) parsed.subject = obj.subject.replace(/^(Re:\s*)+/i, "Re: ").trim();
      if (obj.body) parsed.body = obj.body.trim();
      if (obj.suggestedStatus) parsed.suggestedStatus = obj.suggestedStatus;
      if (obj.detectedContext) parsed.detectedContext = obj.detectedContext;
    } else {
      parsed.body = rawReply.trim();
    }
  } catch {
    parsed.body = rawReply
      .replace(/```json|```/g, "")
      .replace(/"(subject|body|suggestedStatus|detectedContext)":\s*/g, "")
      .replace(/^\{|\}$/g, "")
      .trim();
  }

  // Safety filter: Clean any leaked JSON keys or escape sequences
  if (parsed.body.includes('"suggestedStatus"') || parsed.body.includes('"detectedContext"')) {
    const bodyMatch = parsed.body.match(/"body":\s*"([\s\S]*?)"(?=,\s*"suggestedStatus"|,\s*"detectedContext"|\})/);
    if (bodyMatch && bodyMatch[1]) {
      parsed.body = bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
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

