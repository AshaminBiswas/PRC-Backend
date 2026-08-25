import { Router } from 'express';
import * as controller from './audit.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { adminLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

// All audit routes require valid admin session
router.use(authenticate);
router.use(adminLimiter);

router.get('/logs', controller.listLogs);
router.get('/admin/:id/360', controller.getAdmin360);
router.get('/admins/:id/360', controller.getAdmin360);
router.get('/:id/360', controller.getAdmin360);

export default router;
