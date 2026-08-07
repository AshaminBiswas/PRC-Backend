import { Router } from 'express';
import * as controller from './settings.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import { UpdateSettingsSchema } from './settings.schema';

const router = Router();

// Public site settings
router.get('/public', cacheResponse(300), controller.getPublicSettings);

// Admin system / store settings
router.get(
  '/',
  authenticate,
  authorize('settings.read', 'settings.manage'),
  controller.getAllSettings
);

router.patch(
  '/',
  authenticate,
  authorize('settings.update', 'settings.manage'),
  validate(UpdateSettingsSchema),
  controller.updateSettings
);

export default router;
