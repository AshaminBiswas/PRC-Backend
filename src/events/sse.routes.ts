import { Router, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/token.utils';
import { sseService } from './sse.service';
import { sseLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

/**
 * GET /api/v1/events/stream
 * Real-time Server-Sent Events (SSE) Stream endpoint.
 * Supports token via Header Authorization: Bearer <token> or query param ?token=<token>
 */
router.get(
  '/stream',
  // 1. Authenticate token first before consuming rate limit
  (req: Request, res: Response, next): any => {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token required for real-time SSE stream (?token=... or Authorization header)',
        },
      });
    }

    try {
      const decoded: any = verifyAccessToken(token);
      (req as any).user = decoded;
      (req as any).sseToken = token;
      next();
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        },
      });
    }
  },
  // 2. Apply rate limiter per authenticated user
  sseLimiter,
  // 3. Establish SSE stream
  (req: Request, res: Response): any => {
    const decoded = (req as any).user;

    // Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx proxy buffering
    res.flushHeaders();

    const clientId = `${decoded.userId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const roleSlug = decoded.roleSlug || decoded.role || 'user';

    const client = {
      id: clientId,
      userId: decoded.userId,
      role: roleSlug,
      res,
      connectedAt: new Date(),
      ip: req.ip,
    };

  sseService.addClient(client);

  // Clean up client connection on socket close
  req.on('close', () => {
    sseService.removeClient(clientId);
  });

  res.on('finish', () => {
    sseService.removeClient(clientId);
  });
});

/**
 * GET /api/v1/events/metrics
 * Returns live SSE connection pool statistics
 */
router.get('/metrics', (_req: Request, res: Response) => {
  const metrics = sseService.getMetrics();
  return res.json({
    success: true,
    data: metrics,
  });
});

export default router;
