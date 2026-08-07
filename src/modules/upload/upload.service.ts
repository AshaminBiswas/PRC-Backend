import supabase from '../../config/supabase';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

type BucketKey = 'avatars' | 'products' | 'categories';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ─── Upload File ──────────────────────────────────────────────────────────────

export const uploadFile = async (
  file: Express.Multer.File,
  bucket: BucketKey,
  folder?: string
): Promise<string> => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new AppError(
      'INVALID_FILE_TYPE',
      `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      400
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError('FILE_TOO_LARGE', 'File size must not exceed 5MB', 400);
  }

  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const fileName = `${uuidv4()}${ext}`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;
  const bucketName = env.supabase.buckets[bucket];

  const { error } = await supabase.storage.from(bucketName).upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    throw new AppError('UPLOAD_FAILED', `Upload failed: ${error.message}`, 500);
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
};

// ─── Delete File ──────────────────────────────────────────────────────────────

export const deleteFile = async (url: string, bucket: BucketKey): Promise<void> => {
  const bucketName = env.supabase.buckets[bucket];
  const bucketUrl = `${env.supabase.url}/storage/v1/object/public/${bucketName}/`;
  const filePath = url.replace(bucketUrl, '');

  const { error } = await supabase.storage.from(bucketName).remove([filePath]);
  if (error) {
    console.error(`[Storage] Failed to delete file: ${error.message}`);
  }
};
