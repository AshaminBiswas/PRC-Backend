/**
 * po-submissions.controller.ts
 *
 * Request handlers for PO Submissions module.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { poSubmissionsService } from './po-submissions.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';

export class PoSubmissionsController {
  // ─── Customer: Form PO Submission ───────────────────────────────────────────
  createFormPo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.createFormPo(
        req.user.id,
        req.body,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Purchase Order submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  };

  // ─── Customer: PDF PO Upload ────────────────────────────────────────────────
  createPdfPo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      if (!req.file) throw new AppError('FILE_REQUIRED', 'Please upload a PDF purchase order', 400);

      const result = await poSubmissionsService.createPdfPo(
        req.user.id,
        req.file,
        req.body,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Purchase Order PDF uploaded successfully', 201);
    } catch (error) {
      next(error);
    }
  };

  // ─── Customer: List My Submissions ──────────────────────────────────────────
  getMySubmissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const { items, pagination } = await poSubmissionsService.getMySubmissions(req.user.id, req.query as any);
      sendPaginated(res, items, pagination);
    } catch (error) {
      next(error);
    }
  };

  // ─── Customer / Admin: Get Detail by ID ─────────────────────────────────────
  getSubmissionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const isAdmin = req.user.roleSlug === 'super_admin' || req.user.roleSlug === 'admin';
      const submission = await poSubmissionsService.getSubmissionById(req.user.id, req.params.id, isAdmin);
      sendSuccess(res, submission);
    } catch (error) {
      next(error);
    }
  };

  // ─── Customer: Delete Submission (Draft/Submitted only) ──────────────────────
  deleteSubmission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.deleteSubmission(req.user.id, req.params.id);
      sendSuccess(res, result, 'Purchase Order submission deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  // ─── Customer / Admin: Download Acknowledgement PDF ──────────────────────────
  downloadAcknowledgement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const isAdmin = req.user.roleSlug === 'super_admin' || req.user.roleSlug === 'admin';
      const { filePath, ackNumber } = await poSubmissionsService.getAcknowledgementStream(
        req.params.id,
        req.user.id,
        isAdmin
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="PRC_Acknowledgement_${ackNumber}.pdf"`);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin / Customer: View / Download Attachment ────────────────────────────
  downloadAttachment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const isAdmin = req.user.roleSlug === 'super_admin' || req.user.roleSlug === 'admin';
      const { filePath, originalFileName, mimeType } = await poSubmissionsService.getAttachmentStream(
        req.params.id,
        req.user.id,
        isAdmin
      );

      const isInline = req.query.inline === 'true';
      res.setHeader('Content-Type', mimeType || 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(originalFileName)}"`
      );
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: View PDF Stream via Token (for split-pane iframe) ─────────────────
  viewAttachmentByToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.query.token as string;
      if (!token) throw new AppError('UNAUTHORIZED', 'Access token required', 401);

      let payload: any;
      try {
        payload = jwt.verify(token, env.jwt.accessSecret);
      } catch {
        throw new AppError('FORBIDDEN', 'Invalid or expired attachment viewer token', 403);
      }

      const { filePath, originalFileName, mimeType } = await poSubmissionsService.getAttachmentStream(
        payload.attachmentId,
        payload.adminId,
        true
      );

      res.setHeader('Content-Type', mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFileName)}"`);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Get Signed URL for PDF Viewer ───────────────────────────────────
  getPdfSignedUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.getPdfSignedUrl(req.params.id, req.user);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Unified Queue with Filters ───────────────────────────────────────
  adminGetQueue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items, pagination, metrics } = await poSubmissionsService.adminGetQueue(req.query as any);
      res.status(200).json({
        success: true,
        data: items,
        metrics,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Start Review ────────────────────────────────────────────────────
  adminStartReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.adminStartReview(
        req.user,
        req.params.id,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'PO is now Under Review');
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Map Catalog Line Items ──────────────────────────────────────────
  adminUpsertLineItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.adminUpsertLineItems(
        req.user,
        req.params.id,
        req.body,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Line items mapped successfully');
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Approve Submission ──────────────────────────────────────────────
  adminApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.adminApprove(
        req.user,
        req.params.id,
        req.body,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Purchase Order approved successfully');
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Issue Formal Acknowledgement ────────────────────────────────────
  adminIssueAcknowledgement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.adminIssueAcknowledgement(
        req.user,
        req.params.id,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Order Acknowledgement generated and emailed to customer');
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Reject Submission ───────────────────────────────────────────────
  adminReject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.adminReject(
        req.user,
        req.params.id,
        req.body.reason,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Purchase Order rejected');
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Request Changes ─────────────────────────────────────────────────
  adminRequestChanges = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.adminRequestChanges(
        req.user,
        req.params.id,
        req.body.reason,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Changes requested from customer');
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Assign Reviewer ─────────────────────────────────────────────────
  adminAssign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.adminAssign(
        req.user,
        req.params.id,
        req.body.adminUserId,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Submission assigned successfully');
    } catch (error) {
      next(error);
    }
  };

  // ─── Admin: Add Internal Note ───────────────────────────────────────────────
  adminAddInternalNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const result = await poSubmissionsService.adminAddInternalNote(
        req.user,
        req.params.id,
        req.body.note,
        req.ip || (req.headers['x-forwarded-for'] as string)
      );
      sendSuccess(res, result, 'Internal note recorded');
    } catch (error) {
      next(error);
    }
  };
}

export const poSubmissionsController = new PoSubmissionsController();
