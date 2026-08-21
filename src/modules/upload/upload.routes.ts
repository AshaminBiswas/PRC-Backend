import { Router } from 'express';
import multer from 'multer';
import * as controller from './upload.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { uploadLimiter } from '../../middleware/rateLimit.middleware';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const router = Router();

router.use(authenticate);
router.use(uploadLimiter);

// Avatar upload (any authenticated user)
router.post('/avatar', upload.single('file'), controller.uploadAvatar);

// Product images (admin only)
router.post('/product', authorize('products.create'), upload.single('file'), controller.uploadProductImage);
router.post('/product/multiple', authorize('products.create'), upload.array('files', 10), controller.uploadMultipleProductImages);

// Category image (admin only)
router.post('/category', authorize('categories.update'), upload.single('file'), controller.uploadCategoryImage);

export default router;
