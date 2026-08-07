import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Factory function that returns an Express middleware that validates
 * the given target (body/query/params) against a Zod schema.
 */
export const validate = (schema: ZodSchema, target: ValidateTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const details = (result.error as ZodError).errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      sendError(
        res,
        {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details,
        },
        422
      );
      return;
    }

    // Replace raw input with validated + coerced data
    req[target] = result.data;
    next();
  };
};
