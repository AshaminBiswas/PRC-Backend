import sanitizeHtml from 'sanitize-html';
import prisma from '../../config/database';
import { logger } from '../../config/logger';
import { eventBus } from '../../events/eventBus';
import { notifyAdmins } from '../notifications/admin-notification.service';
import {
  InboundEmailPayload,
  PoClassification,
  PoPriority,
  PoSource,
  PoStatus,
  EmailDirection,
} from './po.types';
import { generatePoSubmissionId } from './po-sequence.service';
import { classifyInboundEmail, extractSenderProfileDetails } from './po-classifier.service';
import { uploadFile } from '../upload/upload.service';

/**
 * Sanitize HTML email body to eliminate dangerous script tags, iframes, and malicious code
 */
export function sanitizeEmailHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'h1',
      'h2',
      'h3',
      'span',
      'div',
      'table',
      'tbody',
      'thead',
      'tr',
      'td',
      'th',
      'b',
      'i',
      'u',
      'hr',
      'br',
      'p',
      'a',
      'font',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class', 'align', 'color', 'bgcolor', 'valign'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'style'],
    },
    allowedSchemes: ['http', 'https', 'data', 'cid', 'mailto'],
  });
}

/**
 * Upload an email attachment to the configured storage service
 */
async function processAndStoreAttachment(
  att: { fileName: string; fileType: string; fileSize: number; buffer?: Buffer; content?: string }
): Promise<{ storagePath: string; storageUrl: string }> {
  const fileName = att.fileName || `attachment-${Date.now()}`;
  const fileType = att.fileType || 'application/octet-stream';

  if (att.buffer) {
    try {
      // Build a Multer-compatible file object to pass to uploadFile
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: fileName,
        encoding: '7bit',
        mimetype: fileType,
        size: att.fileSize || att.buffer.length,
        buffer: att.buffer,
        destination: '',
        filename: fileName,
        path: '',
        stream: null as any,
      };

      const url = await uploadFile(mockFile, 'products', 'po-attachments');
      return { storagePath: `po-attachments/${fileName}`, storageUrl: url };
    } catch (err: any) {
      logger.warn(`[PO Ingestion] Storage upload fallback for ${fileName}:`, err?.message || err);
    }
  }

  // Fallback storage URL
  const fallbackUrl = att.content || `/api/v1/po-management/attachments/raw-${Date.now()}-${encodeURIComponent(fileName)}`;
  return { storagePath: `local/${fileName}`, storageUrl: fallbackUrl };
}

/**
 * Extract existing PRC-PO-YYYY-XXXXXX reference from text
 */
function extractExistingPoReference(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(PRC-PO-\d{4}-\d{6})\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Core Inbound Email Processing Engine (Idempotent, Thread-Aware)
 */
export async function processInboundEmail(email: InboundEmailPayload) {
  const cleanMessageId = (email.messageId || '').trim();
  if (!cleanMessageId) {
    throw new Error('Inbound email must have a valid Message-ID header');
  }

  // ── STEP 1: Duplicate Check (Idempotency) ──────────────────────────────────
  const existingMsg = await prisma.poEmailMessage.findUnique({
    where: { messageId: cleanMessageId },
    include: { poSubmission: true },
  });

  if (existingMsg) {
    logger.info(`[PO Ingestion] Duplicate email received — Message-ID: ${cleanMessageId}. Skipping insert.`);
    return {
      success: true,
      duplicate: true,
      emailMessageId: existingMsg.id,
      poSubmission: existingMsg.poSubmission,
    };
  }

  // ── STEP 2: Thread Resolution ──────────────────────────────────────────────
  let targetPoSubmissionId: string | null = null;
  let targetPoSubmission: any = null;

  // 2a. Check In-Reply-To header
  if (email.inReplyTo) {
    const parentMsg = await prisma.poEmailMessage.findUnique({
      where: { messageId: email.inReplyTo.trim() },
      include: { poSubmission: true },
    });
    if (parentMsg?.poSubmissionId) {
      targetPoSubmissionId = parentMsg.poSubmissionId;
      targetPoSubmission = parentMsg.poSubmission;
    }
  }

  // 2b. Check References headers
  if (!targetPoSubmissionId && email.references && email.references.length > 0) {
    const refMsg = await prisma.poEmailMessage.findFirst({
      where: { messageId: { in: email.references } },
      include: { poSubmission: true },
    });
    if (refMsg?.poSubmissionId) {
      targetPoSubmissionId = refMsg.poSubmissionId;
      targetPoSubmission = refMsg.poSubmission;
    }
  }

  // 2c. Check Subject for PRC-PO-YYYY-XXXXXX token
  if (!targetPoSubmissionId) {
    const refFromSubject = extractExistingPoReference(email.subject);
    if (refFromSubject) {
      const matchByRef = await prisma.poSubmission.findUnique({
        where: { poSubmissionId: refFromSubject },
      });
      if (matchByRef) {
        targetPoSubmissionId = matchByRef.id;
        targetPoSubmission = matchByRef;
      }
    }
  }

  // ── STEP 3: Handle Customer Reply to Existing Thread ─────────────────────────
  const sanitizedHtml = sanitizeEmailHtml(email.htmlBody || '');
  const cleanSubject = (email.subject || 'No Subject').trim();
  const plainText = (email.plainTextBody || '').trim();

  if (targetPoSubmissionId && targetPoSubmission) {
    logger.info(`[PO Ingestion] Inbound email belongs to existing PO thread: ${targetPoSubmission.poSubmissionId || targetPoSubmission.id}`);

    // Process attachments
    const attachmentRecords: any[] = [];
    if (email.attachments && email.attachments.length > 0) {
      for (const att of email.attachments) {
        const stored = await processAndStoreAttachment(att);
        attachmentRecords.push({
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize || 0,
          storagePath: stored.storagePath,
          storageUrl: stored.storageUrl,
          extractedText: att.extractedText || null,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create email message under existing submission
      const newEmailMsg = await tx.poEmailMessage.create({
        data: {
          poSubmissionId: targetPoSubmissionId,
          messageId: cleanMessageId,
          providerEmailId: email.providerEmailId || null,
          threadId: email.threadId || targetPoSubmission.id,
          inReplyTo: email.inReplyTo || null,
          references: email.references || [],
          direction: EmailDirection.INCOMING,
          senderName: email.senderName || null,
          senderEmail: email.senderEmail.toLowerCase().trim(),
          recipientEmail: email.recipientEmail.toLowerCase().trim(),
          cc: email.cc || [],
          bcc: email.bcc || [],
          subject: cleanSubject,
          plainTextBody: plainText,
          htmlBody: sanitizedHtml,
          rawHeaders: email.rawHeaders ? (email.rawHeaders as any) : undefined,
          receivedAt: email.receivedAt ? new Date(email.receivedAt) : new Date(),
          attachments: {
            create: attachmentRecords.map((att) => ({
              poSubmissionId: targetPoSubmissionId,
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize,
              storagePath: att.storagePath,
              storageUrl: att.storageUrl,
              extractedText: att.extractedText,
            })),
          },
        },
        include: { attachments: true },
      });

      // 2. Update PO Submission activity timestamp
      const updatedPo = await tx.poSubmission.update({
        where: { id: targetPoSubmissionId },
        data: {
          lastActivityAt: new Date(),
          // If status was COMPLETED or CANCELLED, reopen to WAITING_FOR_CUSTOMER / UNDER_REVIEW
          status:
            targetPoSubmission.status === PoStatus.COMPLETED || targetPoSubmission.status === PoStatus.CANCELLED
              ? PoStatus.UNDER_REVIEW
              : targetPoSubmission.status,
        },
      });

      // 3. Create Activity Log Entry
      await tx.poActivityLog.create({
        data: {
          poSubmissionId: targetPoSubmissionId,
          activityType: 'EMAIL_REPLY_RECEIVED',
          title: 'Customer Reply Received',
          description: `Received customer email reply from ${email.senderEmail}: "${cleanSubject}" (${attachmentRecords.length} attachment(s))`,
          performedByUserId: null,
          metadata: {
            messageId: cleanMessageId,
            attachmentsCount: attachmentRecords.length,
          },
        },
      });

      return { newEmailMsg, updatedPo };
    });

    // Notify admins of new reply
    notifyAdmins(
      `New Email on PO ${targetPoSubmission.poSubmissionId || ''}`,
      `Customer ${email.senderEmail} replied: "${cleanSubject}"`,
      'PO_UPDATE',
      { poId: targetPoSubmission.id, poSubmissionId: targetPoSubmission.poSubmissionId }
    ).catch(() => {});

    eventBus.emitEvent('po.updated', {
      id: targetPoSubmission.id,
      poId: targetPoSubmission.id,
      poSubmissionId: targetPoSubmission.poSubmissionId,
      action: 'EMAIL_REPLY_RECEIVED',
    });

    return {
      success: true,
      isReply: true,
      poSubmission: result.updatedPo,
      emailMessage: result.newEmailMsg,
    };
  }

  // ── STEP 4: Classify New Inbound Email ─────────────────────────────────────────
  const classificationResult = classifyInboundEmail(cleanSubject, plainText, email.attachments || []);
  const { classification, confidenceScore, extractedCustomerPoNumber } = classificationResult;

  logger.info(
    `[PO Classifier] Email "${cleanSubject}" classified as ${classification} (confidence: ${confidenceScore * 100}%)`
  );

  // ── STEP 5: Generate Internal PO Submission ID if PO or Possible PO ────────────
  let generatedPoId: string | null = null;
  if (
    classification === PoClassification.PO_DETECTED ||
    classification === PoClassification.POSSIBLE_PO
  ) {
    generatedPoId = await generatePoSubmissionId();
  }

  // ── STEP 6: Identify Sender Customer / Company Profile ─────────────────────────
  const senderEmailNormalized = email.senderEmail.toLowerCase().trim();
  const existingCustomer = await prisma.user.findFirst({
    where: { email: senderEmailNormalized, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, companyName: true, phone: true, gstin: true },
  });

  const extractedProfile = extractSenderProfileDetails(plainText);

  const customerName =
    email.senderName ||
    (existingCustomer ? `${existingCustomer.firstName} ${existingCustomer.lastName}`.trim() : extractedProfile.extractedName) ||
    senderEmailNormalized.split('@')[0];

  const companyName = existingCustomer?.companyName || extractedProfile.extractedCompany || null;
  const customerPhone = existingCustomer?.phone || extractedProfile.extractedPhone || null;

  // ── STEP 7: Process Attachments ───────────────────────────────────────────────
  const attachmentRecords: any[] = [];
  if (email.attachments && email.attachments.length > 0) {
    for (const att of email.attachments) {
      const stored = await processAndStoreAttachment(att);
      attachmentRecords.push({
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize || 0,
        storagePath: stored.storagePath,
        storageUrl: stored.storageUrl,
        extractedText: att.extractedText || null,
      });
    }
  }

  // Preview snippet
  const previewText = plainText.slice(0, 240);

  // ── STEP 8: Atomic Database Transaction ────────────────────────────────────────
  const createdPo = await prisma.$transaction(async (tx) => {
    // 1. Create PoSubmission
    const submission = await tx.poSubmission.create({
      data: {
        poSubmissionId: generatedPoId,
        source: PoSource.EMAIL,
        classification,
        confidenceScore,
        customerPoNumber: extractedCustomerPoNumber || null,
        customerName,
        companyName,
        customerEmail: senderEmailNormalized,
        customerPhone,
        subject: cleanSubject,
        previewText,
        status: PoStatus.NEW,
        priority: classificationResult.suggestedPriority || PoPriority.MEDIUM,
        receivedAt: email.receivedAt ? new Date(email.receivedAt) : new Date(),
        lastActivityAt: new Date(),
        metadata: {
          reasons: classificationResult.reasons,
          recipientEmail: email.recipientEmail,
          rawMessageId: cleanMessageId,
        },
      },
    });

    // 2. Create Initial PoEmailMessage
    const emailMsg = await tx.poEmailMessage.create({
      data: {
        poSubmissionId: submission.id,
        messageId: cleanMessageId,
        providerEmailId: email.providerEmailId || null,
        threadId: email.threadId || submission.id,
        inReplyTo: email.inReplyTo || null,
        references: email.references || [],
        direction: EmailDirection.INCOMING,
        senderName: email.senderName || customerName,
        senderEmail: senderEmailNormalized,
        recipientEmail: email.recipientEmail.toLowerCase().trim(),
        cc: email.cc || [],
        bcc: email.bcc || [],
        subject: cleanSubject,
        plainTextBody: plainText,
        htmlBody: sanitizedHtml,
        rawHeaders: email.rawHeaders ? (email.rawHeaders as any) : undefined,
        receivedAt: email.receivedAt ? new Date(email.receivedAt) : new Date(),
        attachments: {
          create: attachmentRecords.map((att) => ({
            poSubmissionId: submission.id,
            fileName: att.fileName,
            fileType: att.fileType,
            fileSize: att.fileSize,
            storagePath: att.storagePath,
            storageUrl: att.storageUrl,
            extractedText: att.extractedText,
          })),
        },
      },
      include: { attachments: true },
    });

    // 3. Create Initial Activity Log
    await tx.poActivityLog.create({
      data: {
        poSubmissionId: submission.id,
        activityType: 'EMAIL_RECEIVED',
        title: 'Original Email Received',
        description: `Inbound email received from ${senderEmailNormalized} classified as ${classification} (confidence ${Math.round(
          confidenceScore * 100
        )}%)`,
        metadata: {
          messageId: cleanMessageId,
          poSubmissionId: generatedPoId,
          classification,
          confidenceScore,
          extractedCustomerPoNumber,
        },
      },
    });

    if (generatedPoId) {
      await tx.poActivityLog.create({
        data: {
          poSubmissionId: submission.id,
          activityType: 'ID_GENERATED',
          title: 'PO Submission ID Assigned',
          description: `Internal PO reference generated: ${generatedPoId}`,
          newValue: generatedPoId,
        },
      });
    }

    return { submission, emailMsg };
  });

  logger.info(`[PO Ingestion] Successfully created PO Submission: ${createdPo.submission.poSubmissionId || createdPo.submission.id}`);

  // ── STEP 9: Dispatch Notifications & SSE Broadcast ───────────────────────────
  if (classification === PoClassification.PO_DETECTED) {
    notifyAdmins(
      `New Purchase Order Received: ${generatedPoId}`,
      `From: ${customerName} (${senderEmailNormalized})\nSubject: ${cleanSubject}`,
      'NEW_PO_RECEIVED',
      { poId: createdPo.submission.id, poSubmissionId: generatedPoId }
    ).catch(() => {});
  } else if (classification === PoClassification.POSSIBLE_PO) {
    notifyAdmins(
      `Possible PO Requires Review: ${generatedPoId}`,
      `From: ${customerName} (${senderEmailNormalized})\nSubject: ${cleanSubject}`,
      'POSSIBLE_PO_REVIEW',
      { poId: createdPo.submission.id, poSubmissionId: generatedPoId }
    ).catch(() => {});
  }

  eventBus.emitEvent('po.created', {
    id: createdPo.submission.id,
    poSubmissionId: generatedPoId,
    classification,
    confidenceScore,
    customerName,
    companyName,
    customerEmail: senderEmailNormalized,
    customerPhone,
    subject: cleanSubject,
    previewText,
    status: createdPo.submission.status,
    priority: createdPo.submission.priority,
    source: createdPo.submission.source,
    assignedUserId: null,
    assignedUser: null,
    receivedAt: createdPo.submission.receivedAt.toISOString(),
    lastActivityAt: createdPo.submission.lastActivityAt.toISOString(),
    createdAt: createdPo.submission.createdAt.toISOString(),
    updatedAt: createdPo.submission.updatedAt.toISOString(),
    _count: { emails: 1, attachments: attachmentRecords.length, internalNotes: 0 },
  });

  return {
    success: true,
    isReply: false,
    poSubmission: createdPo.submission,
    emailMessage: createdPo.emailMsg,
  };
}
