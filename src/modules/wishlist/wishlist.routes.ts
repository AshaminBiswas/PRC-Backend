import { Router } from 'express';
import * as controller from './wishlist.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { AddWishlistItemSchema, WishlistItemParamSchema } from './wishlist.schema';

const router = Router();

router.use(authenticate);

router.get('/', controller.getWishlist);
router.post('/', validate(AddWishlistItemSchema), controller.addToWishlist);
router.delete('/clear', controller.clearWishlist);
router.delete('/:itemId', validate(WishlistItemParamSchema, 'params'), controller.removeFromWishlist);

export default router;
