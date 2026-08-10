import { Response } from 'express';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown[];
}

export interface CursorPaginationMeta {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const sendSuccess = (
  res: Response,
  data: unknown,
  message?: string,
  statusCode = 200
): Response => {
  return res.status(statusCode).json({   
    success: true,
    ...(message && { message }),
    data,
  });
};

export const sendPaginated = (
  res: Response,
  data: unknown[],
  pagination: PaginationMeta,
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination,
  });
};

export const sendCursorPaginated = (
  res: Response,
  data: unknown[],
  nextCursor: string | null,
  limit: number,
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination: {
      limit,
      nextCursor,
      hasMore: nextCursor !== null,
    },
  });
};

export const sendError = (
  res: Response,
  error: ApiError,
  statusCode = 400
): Response => {
  return res.status(statusCode).json({
    success: false,
    error,
  });
};

export const sendMessage = (
  res: Response,
  message: string,
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
  });
};

// ─── Pagination Calculators ───────────────────────────────────────────────────

export const buildPagination = (
  page: number,
  limit: number,
  totalItems: number
): PaginationMeta => {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

export const getPaginationParams = (
  query: Record<string, unknown>
): { page: number; limit: number; skip: number } => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const getCursorParams = (
  query: Record<string, unknown>
): { cursor: string | null; limit: number } => {
  const cursor = query.cursor ? String(query.cursor) : null;
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10)));
  return { cursor, limit };
};

// ─── JSON Payload Sanitizer & Security Stripper ──────────────────────────────

export const sanitizePayload = <T = any>(obj: T): T => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload) as unknown as T;
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'passwordHash') continue; // Never expose password hashes
      if (value !== null && value !== undefined) {
        cleaned[key] = sanitizePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
};
