import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendMessage } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import prisma from '../../config/database';
import * as poService from './po-management.service';
import * as poIngestionService from './po-email-ingestion.service';
import * as poSyncService from './po-sync.service';

export const listPoSubmissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await poService.listPoSubmissions(req.query as any);
    const metrics = await poService.getPoMetrics();
    sendSuccess(res, {
      items: data.items,
      pagination: data.pagination,
      metrics,
    });
  } catch (error) {
    next(error);
  }
};

export const getPoMetrics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await poService.getPoMetrics();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getPoSubmissionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await poService.getPoSubmissionById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, comment } = req.body;
    const userId = req.user?.id;
    const data = await poService.updatePoStatus(req.params.id, status, userId, comment);
    sendSuccess(res, data, 'Status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const updatePriority = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { priority } = req.body;
    const userId = req.user?.id;
    const data = await poService.updatePoPriority(req.params.id, priority, userId);
    sendSuccess(res, data, 'Priority updated successfully');
  } catch (error) {
    next(error);
  }
};

export const assign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignedUserId, assignedDepartment } = req.body;
    const currentUserId = req.user?.id;
    const data = await poService.assignPoSubmission(
      req.params.id,
      assignedUserId,
      assignedDepartment,
      currentUserId
    );
    sendSuccess(res, data, 'Assignment updated successfully');
  } catch (error) {
    next(error);
  }
};

export const reclassify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classification } = req.body;
    const currentUserId = req.user?.id;
    const data = await poService.updatePoClassification(
      req.params.id,
      classification,
      currentUserId
    );
    sendSuccess(res, data, 'Classification updated successfully');
  } catch (error) {
    next(error);
  }
};

export const updateCustomerPoNumber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerPoNumber } = req.body;
    const currentUserId = req.user?.id;
    const data = await poService.updateCustomerPoNumber(
      req.params.id,
      customerPoNumber,
      currentUserId
    );
    sendSuccess(res, data, 'Customer PO Number updated successfully');
  } catch (error) {
    next(error);
  }
};

export const addInternalNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { note } = req.body;
    const userId = req.user!.id;
    const data = await poService.addInternalNote(req.params.id, userId, note);
    sendSuccess(res, data, 'Internal note added successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const syncInbound = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await poSyncService.syncInboundEmails();
    sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

export const handleInboundWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    const messageId =
      payload.messageId ||
      payload['Message-ID'] ||
      `<webhook-${Date.now()}-${Math.random().toString(36).slice(2)}@inbound.prchardware.com>`;

    const emailPayload = {
      messageId,
      providerEmailId: payload.providerEmailId || payload.id,
      threadId: payload.threadId,
      inReplyTo: payload.inReplyTo || payload['In-Reply-To'],
      references: payload.references || [],
      senderName: payload.senderName || payload.from_name,
      senderEmail: payload.senderEmail || payload.from || payload.sender,
      recipientEmail: payload.recipientEmail || payload.to || 'po@pacifichardware.com',
      cc: payload.cc || [],
      bcc: payload.bcc || [],
      subject: payload.subject || 'No Subject',
      plainTextBody: payload.plainTextBody || payload.text || '',
      htmlBody: payload.htmlBody || payload.html || '',
      rawHeaders: payload.headers || payload.rawHeaders,
      receivedAt: payload.receivedAt || new Date(),
      attachments: payload.attachments || [],
    };

    const result = await poIngestionService.processInboundEmail(emailPayload);
    sendSuccess(res, result, 'Inbound email processed successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const deletePoSubmission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user?.id;
    const result = await poService.deletePoSubmission(req.params.id, currentUserId);
    sendSuccess(res, result, 'Purchase Order submission deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeletePoSubmissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    const currentUserId = req.user?.id;
    const result = await poService.bulkDeletePoSubmissions(ids, currentUserId);
    sendSuccess(res, result, `Successfully deleted ${result.deletedCount} PO submission(s)`);
  } catch (error) {
    next(error);
  }
};

export const getAttachmentFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachmentId = req.params.attachmentId || req.params.rawFile;
    const isDownload = req.query.download === 'true' || req.path.includes('/download');

    const attachment = await prisma.poEmailAttachment.findFirst({
      where: {
        OR: [
          { id: attachmentId },
          { fileName: attachmentId },
          { storageUrl: { contains: attachmentId } },
        ],
      },
    });

    if (!attachment) {
      // Check if it's a raw file in uploads directory
      const path = await import('path');
      const fs = await import('fs');
      const localFilePath = path.join(process.cwd(), 'uploads', 'po-attachments', attachmentId);
      if (fs.existsSync(localFilePath)) {
        if (isDownload) {
          return res.download(localFilePath, attachmentId);
        }
        return res.sendFile(localFilePath);
      }
      throw new AppError('NOT_FOUND', 'Email attachment not found', 404);
    }

    const { storageUrl, fileType, fileName } = attachment;

    // 1. If it's a remote URL, redirect
    if (storageUrl.startsWith('http://') || storageUrl.startsWith('https://')) {
      return res.redirect(302, storageUrl);
    }

    // 2. If it's a data URI
    if (storageUrl.startsWith('data:')) {
      const parts = storageUrl.split(';base64,');
      const mime = parts[0].replace('data:', '') || fileType || 'application/octet-stream';
      const buffer = Buffer.from(parts[1], 'base64');
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(fileName)}"`);
      return res.send(buffer);
    }

    // 3. If it's a local file
    const path = await import('path');
    const fs = await import('fs');
    const cleanRelPath = storageUrl.replace(/^\/uploads\//, '');
    const localFilePath = path.join(process.cwd(), 'uploads', cleanRelPath);
    if (fs.existsSync(localFilePath)) {
      if (isDownload) {
        return res.download(localFilePath, fileName);
      }
      return res.sendFile(localFilePath);
    }

    return res.redirect(302, storageUrl);
  } catch (error) {
    next(error);
  }
};
