import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';

// ─── Custom App Error ─────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown[]
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── Global Error Handler ─────────────────────────────────────────────────────

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // Ensure CORS headers are present on all error responses
  const origin = req.headers.origin;
  if (origin && !res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // Prisma known errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as { code: string; meta?: { target?: string[] } };

    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] ?? 'field';
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `A record with this ${field} already exists`,
        },
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Record not found' },
      });
      return;
    }
  }

  // Log unexpected errors
  logger.error('[Unhandled Error]', { message: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.isDev ? err.message : 'An unexpected error occurred',
      ...(env.isDev && { stack: err.stack }),
    },
  });
};

// ─── Not Found Handler ────────────────────────────────────────────────────────

export const notFoundHandler = (req: Request, res: Response): void => {
  const origin = req.headers.origin;
  if (origin && !res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};
