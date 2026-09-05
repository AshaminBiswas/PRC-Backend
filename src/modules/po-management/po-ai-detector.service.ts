import axios from 'axios';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { eventBus } from '../../events/eventBus';
import { AppError } from '../../middleware/error.middleware';
import { PoClassification, PoPriority, EmailAttachmentPayload } from './po.types';
import { generatePoSubmissionId } from './po-sequence.service';
import {
  classifyInboundEmail,
  extractCustomerPoNumber,
  extractSenderProfileDetails,
} from './po-classifier.service';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export interface AiPoDetectionInput {
  subject: string;
  body: string;
  senderEmail: string;
  senderName?: string;
  companyName?: string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    fileSize?: number;
    extractedText?: string | null;
  }>;
}

export interface AiPoDetectionResult {
  isPurchaseOrder: boolean;
  classification: PoClassification;
  confidenceScore: number;
  customerPoNumber?: string | null;
  companyName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  estimatedOrderValue?: number | null;
  suggestedPriority: PoPriority;
  reasoning: string;
  lineItemsSummary?: string | null;
  detectionEngine: 'AI_LLM' | 'HEURISTIC_FALLBACK';
}

/**
 * Executes AI-powered PO detection and intent extraction using LLM.
 * Automatically and seamlessly falls back to enhanced heuristic classifier if LLM is unavailable.
 */
export async function detectPoWithAi(input: AiPoDetectionInput): Promise<AiPoDetectionResult> {
  const cleanSubject = (input.subject || '').trim();
  const cleanBody = (input.body || '').trim();
  const attachmentsList = input.attachments || [];

  // 1. Run Enhanced Heuristic Classifier first as baseline
  const heuristic = classifyInboundEmail(
    cleanSubject,
    cleanBody,
    attachmentsList as EmailAttachmentPayload[]
  );
  const heuristicProfile = extractSenderProfileDetails(cleanBody);
  const heuristicPoNo = extractCustomerPoNumber(cleanSubject, cleanBody);

  // If NVIDIA API Key is missing or empty, use Enhanced Heuristic directly
  if (!env.nvidia.apiKey) {
    logger.info('[PO AI Detector] NVIDIA_API_KEY not configured. Utilizing enhanced heuristic detection engine.');
    return {
      isPurchaseOrder: heuristic.classification === PoClassification.PO_DETECTED,
      classification: heuristic.classification,
      confidenceScore: heuristic.confidenceScore,
      customerPoNumber: heuristicPoNo || heuristic.extractedCustomerPoNumber || null,
      companyName: input.companyName || heuristicProfile.extractedCompany || null,
      customerName: input.senderName || heuristicProfile.extractedName || null,
      customerPhone: heuristicProfile.extractedPhone || null,
      estimatedOrderValue: null,
      suggestedPriority: heuristic.suggestedPriority || PoPriority.MEDIUM,
      reasoning: heuristic.reasons.join('. ') || 'Evaluated via enhanced semantic heuristic rules.',
      lineItemsSummary: null,
      detectionEngine: 'HEURISTIC_FALLBACK',
    };
  }

  // 2. Build Structured LLM Prompt for Indian B2B Commercial Hardware Procurement
  const systemPrompt = `You are PRC PILOT — an expert AI procurement auditor and document classifier for PRC Hardware, India's leading B2B architectural hardware, glass fittings, and commercial ironmongery manufacturer.

YOUR TASK:
Analyze the inbound business email (subject, body, sender, and attached files) to determine whether this communication is an authentic commercial Purchase Order (PO), Work Order (WO), Material Indent, or Formal Order Placement.

RULES FOR CLASSIFICATION:
- "PO_DETECTED": High confidence (>= 0.70) that this is an authentic Purchase Order, approved Quotation conversion, Work Order, formal material indent, or customer releasing an order with intent to purchase hardware products.
- "POSSIBLE_PO": Medium confidence (0.40 - 0.69) where customer is asking for an order, sending a Bill of Quantities (BOQ), or requesting urgent supply, but formal PO document or final authorization is still pending.
- "GENERAL_EMAIL": Low confidence (< 0.40) indicating general inquiry, catalogue request, marketing spam, job application, general vendor pitch, or non-commercial message.

EXTRACTION INSTRUCTIONS:
1. customerPoNumber: Extract customer's own PO reference number (e.g. "DLF/PO/2026/091", "PO# 48190", "WO-9912", "PRC/ORD/26/102"). Return null if not present.
2. companyName: Extract client/buyer company or firm name (e.g. "Shapoorji Pallonji", "DLF Ltd", "Godrej Properties", "Oasis Interiors"). Return null if not determinable.
3. customerName & customerPhone: Extract sender name and phone number if present.
4. estimatedOrderValue: Estimated order value in INR (numbers only), or null if not explicitly mentioned.
5. suggestedPriority: "URGENT", "HIGH", "MEDIUM", or "LOW".
6. reasoning: 1-2 concise, clear sentences explaining why this email was or was not classified as a Purchase Order.
7. lineItemsSummary: Short summary of requested hardware items/quantities if mentioned in email or attachments.

OUTPUT FORMAT:
Return VALID JSON ONLY. Do not wrap in markdown codeblocks. Do not include any explanations outside the JSON object.

JSON SCHEMA:
{
  "isPurchaseOrder": boolean,
  "classification": "PO_DETECTED" | "POSSIBLE_PO" | "GENERAL_EMAIL",
  "confidenceScore": number (0.0 to 1.0),
  "customerPoNumber": string | null,
  "companyName": string | null,
  "customerName": string | null,
  "customerPhone": string | null,
  "estimatedOrderValue": number | null,
  "suggestedPriority": "URGENT" | "HIGH" | "MEDIUM" | "LOW",
  "reasoning": string,
  "lineItemsSummary": string | null
}`;

  const userContent = `INBOUND EMAIL FOR PO AUDIT:
- Sender: ${input.senderName || 'Unknown'} <${input.senderEmail}>
- Known Company: ${input.companyName || 'Not specified'}
- Subject: ${cleanSubject || '(No Subject)'}
- Attachments (${attachmentsList.length}):
${
  attachmentsList.length > 0
    ? attachmentsList
        .map(
          (att, idx) =>
            `  ${idx + 1}. ${att.fileName} (${att.fileType}, ${Math.round((att.fileSize || 0) / 1024)} KB)${
              att.extractedText ? ` — Extracted Text Preview: "${att.extractedText.slice(0, 300)}"` : ''
            }`
        )
        .join('\n')
    : '  (No attachments)'
}

EMAIL BODY CONTENT:
"""
${cleanBody.slice(0, 2500) || '(No plain text body content)'}
"""

Please audit and classify this email now in strict JSON format.`;

  try {
    const payload = {
      model: env.nvidia.model || 'meta/llama-3.2-90b-vision-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 800,
      temperature: 0.2, // Low temperature for high classification precision
      top_p: 0.9,
      stream: false,
    };

    const response = await axios.post<any>(NVIDIA_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${env.nvidia.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 25000,
    });

    const rawContent = response.data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('NVIDIA NIM returned empty response body');
    }

    // Extract JSON from response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to parse structured JSON from LLM: ${rawContent.slice(0, 100)}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize classification enum
    let classification: PoClassification = PoClassification.GENERAL_EMAIL;
    const rawClass = String(parsed.classification || '').toUpperCase();
    if (rawClass === 'PO_DETECTED' || parsed.isPurchaseOrder === true) {
      classification = PoClassification.PO_DETECTED;
    } else if (rawClass === 'POSSIBLE_PO') {
      classification = PoClassification.POSSIBLE_PO;
    }

    // Normalize priority enum
    let priority: PoPriority = PoPriority.MEDIUM;
    const rawPriority = String(parsed.suggestedPriority || '').toUpperCase();
    if (rawPriority === 'URGENT') priority = PoPriority.URGENT;
    else if (rawPriority === 'HIGH') priority = PoPriority.HIGH;
    else if (rawPriority === 'LOW') priority = PoPriority.LOW;

    const confidenceScore = Math.min(
      1.0,
      Math.max(0.0, Number(parsed.confidenceScore) || (classification === PoClassification.PO_DETECTED ? 0.85 : 0.4))
    );

    const customerPoNumber =
      (parsed.customerPoNumber ? String(parsed.customerPoNumber).trim() : null) ||
      heuristicPoNo ||
      heuristic.extractedCustomerPoNumber ||
      null;

    const companyName =
      (parsed.companyName ? String(parsed.companyName).trim() : null) ||
      input.companyName ||
      heuristicProfile.extractedCompany ||
      null;

    const customerName =
      (parsed.customerName ? String(parsed.customerName).trim() : null) ||
      input.senderName ||
      heuristicProfile.extractedName ||
      null;

    const customerPhone =
      (parsed.customerPhone ? String(parsed.customerPhone).trim() : null) ||
      heuristicProfile.extractedPhone ||
      null;

    logger.info(
      `[PO AI Detector] Email "${cleanSubject}" successfully classified by LLM as ${classification} (confidence: ${(
        confidenceScore * 100
      ).toFixed(1)}%)`
    );

    return {
      isPurchaseOrder: classification === PoClassification.PO_DETECTED,
      classification,
      confidenceScore,
      customerPoNumber,
      companyName,
      customerName,
      customerPhone,
      estimatedOrderValue: typeof parsed.estimatedOrderValue === 'number' ? parsed.estimatedOrderValue : null,
      suggestedPriority: priority,
      reasoning: parsed.reasoning || 'Classified by PRC PILOT AI model.',
      lineItemsSummary: parsed.lineItemsSummary || null,
      detectionEngine: 'AI_LLM',
    };
  } catch (err: any) {
    logger.warn(`[PO AI Detector] LLM analysis encountered an error (${err?.message || err}). Seamlessly falling back to enhanced heuristic engine.`);

    // Dual-engine graceful fallback
    return {
      isPurchaseOrder: heuristic.classification === PoClassification.PO_DETECTED,
      classification: heuristic.classification,
      confidenceScore: heuristic.confidenceScore,
      customerPoNumber: heuristicPoNo || heuristic.extractedCustomerPoNumber || null,
      companyName: input.companyName || heuristicProfile.extractedCompany || null,
      customerName: input.senderName || heuristicProfile.extractedName || null,
      customerPhone: heuristicProfile.extractedPhone || null,
      estimatedOrderValue: null,
      suggestedPriority: heuristic.suggestedPriority || PoPriority.MEDIUM,
      reasoning: heuristic.reasons.join('. ') || 'Evaluated via enhanced semantic heuristic rules.',
      lineItemsSummary: null,
      detectionEngine: 'HEURISTIC_FALLBACK',
    };
  }
}

/**
 * Runs AI PO Detection on a specific PoSubmission record in the database,
 * updates the database record, creates an audit log, and emits real-time SSE updates.
 */
export async function aiDetectAndClassifySubmission(
  id: string,
  performedByUserId?: string
) {
  const po = await prisma.poSubmission.findFirst({
    where: {
      OR: [{ id }, { poSubmissionId: id }],
    },
    include: {
      emails: {
        orderBy: { receivedAt: 'asc' },
        take: 5,
        include: { attachments: true },
      },
      attachments: true,
    },
  });

  if (!po) {
    throw new AppError('NOT_FOUND', 'PO submission not found for AI detection', 404);
  }

  // Gather email context
  const primaryEmail = po.emails[0];
  const combinedBody = (primaryEmail?.plainTextBody || po.previewText || '').trim();
  const allAttachments = po.attachments.map((att) => ({
    fileName: att.fileName,
    fileType: att.fileType,
    fileSize: att.fileSize,
    extractedText: att.extractedText,
  }));

  // Run AI Detection
  const detectionResult = await detectPoWithAi({
    subject: po.subject,
    body: combinedBody,
    senderEmail: po.customerEmail,
    senderName: po.customerName || undefined,
    companyName: po.companyName || undefined,
    attachments: allAttachments,
  });

  // If newly classified as PO or Possible PO and doesn't have an internal reference ID, generate one
  let assignedPoId = po.poSubmissionId;
  if (
    !assignedPoId &&
    (detectionResult.classification === PoClassification.PO_DETECTED ||
      detectionResult.classification === PoClassification.POSSIBLE_PO)
  ) {
    assignedPoId = await generatePoSubmissionId();
  }

  const existingMeta = (po.metadata && typeof po.metadata === 'object' ? po.metadata : {}) as Record<string, any>;

  // Atomic database update & audit trail
  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const updated = await tx.poSubmission.update({
      where: { id: po.id },
      data: {
        classification: detectionResult.classification,
        confidenceScore: detectionResult.confidenceScore,
        customerPoNumber: detectionResult.customerPoNumber || po.customerPoNumber,
        companyName: detectionResult.companyName || po.companyName,
        customerName: detectionResult.customerName || po.customerName,
        customerPhone: detectionResult.customerPhone || po.customerPhone,
        priority: detectionResult.suggestedPriority || po.priority,
        poSubmissionId: assignedPoId,
        lastActivityAt: new Date(),
        metadata: {
          ...existingMeta,
          aiDetection: {
            isPurchaseOrder: detectionResult.isPurchaseOrder,
            confidenceScore: detectionResult.confidenceScore,
            reasoning: detectionResult.reasoning,
            lineItemsSummary: detectionResult.lineItemsSummary,
            detectionEngine: detectionResult.detectionEngine,
            detectedAt: new Date().toISOString(),
          },
        },
      },
      include: {
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        _count: {
          select: { emails: true, attachments: true, internalNotes: true },
        },
      },
    });

    // Record Activity Log
    await tx.poActivityLog.create({
      data: {
        poSubmissionId: po.id,
        activityType: 'PO_AI_DETECTED',
        title: detectionResult.isPurchaseOrder ? 'PO Confirmed by AI' : 'AI Analysis Completed',
        description: `Classified as ${detectionResult.classification} (${Math.round(
          detectionResult.confidenceScore * 100
        )}% confidence) via ${detectionResult.detectionEngine}. Reasoning: ${detectionResult.reasoning}`,
        previousValue: po.classification,
        newValue: detectionResult.classification,
        performedByUserId: performedByUserId || null,
        metadata: {
          engine: detectionResult.detectionEngine,
          confidenceScore: detectionResult.confidenceScore,
          customerPoNumber: detectionResult.customerPoNumber,
          assignedPoId,
          reasoning: detectionResult.reasoning,
        },
      },
    });

    if (assignedPoId && !po.poSubmissionId) {
      await tx.poActivityLog.create({
        data: {
          poSubmissionId: po.id,
          activityType: 'ID_GENERATED',
          title: 'PO Submission ID Assigned',
          description: `Internal PO reference generated: ${assignedPoId}`,
          newValue: assignedPoId,
          performedByUserId: performedByUserId || null,
        },
      });
    }

    return updated;
  });

  // Emit SSE Real-Time Event so all open Admin Consoles update instantaneously
  eventBus.emitEvent('po.updated', {
    id: updatedSubmission.id,
    poId: updatedSubmission.id,
    poSubmissionId: updatedSubmission.poSubmissionId,
    status: updatedSubmission.status,
    action: 'AI_DETECTED',
  });

  return {
    po: updatedSubmission,
    aiDetectionResult: detectionResult,
  };
}
