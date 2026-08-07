import { Router } from 'express';
import * as controller from './variants.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  CreateVariantSchema,
  UpdateVariantSchema,
  ProductIdParamSchema,
  VariantParamsSchema,
} from './variants.schema';

const router = Router({ mergeParams: true });

router.get('/', validate(ProductIdParamSchema, 'params'), controller.listVariants);
router.get('/:id', validate(VariantParamsSchema, 'params'), controller.getVariantById);

router.post(
  '/',
  authenticate,
  authorize('variants.create'),
  validate(ProductIdParamSchema, 'params'),
  validate(CreateVariantSchema),
  controller.createVariant
);

router.patch(
  '/:id',
  authenticate,
  authorize('variants.update'),
  validate(VariantParamsSchema, 'params'),
  validate(UpdateVariantSchema),
  controller.updateVariant
);

router.delete(
  '/:id',
  authenticate,
  authorize('variants.delete'),
  validate(VariantParamsSchema, 'params'),
  controller.deleteVariant
);

export default router;
