import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import ImageKit, { toFile } from '@imagekit/nodejs';
import supabase from '../../config/supabase';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

type BucketKey = 'avatars' | 'products' | 'categories';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ─── ImageKit.io Client (100% Free 20GB No-Card Storage) ───────────────────────

let imagekitClient: ImageKit | null = null;

const getImageKitClient = (): ImageKit | null => {
  if (env.imagekit.privateKey && env.imagekit.urlEndpoint) {
    if (!imagekitClient) {
      imagekitClient = new ImageKit({
        privateKey: env.imagekit.privateKey,
      });
      console.log('⚡ [Storage] ImageKit.io Client initialised →', env.imagekit.urlEndpoint);
    }
    return imagekitClient;
  }
  return null;
};

// ─── Cloudflare R2 S3-Compatible Client ───────────────────────────────────────

let r2Client: S3Client | null = null;

const getR2Client = (): S3Client | null => {
  if (env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey) {
    if (!r2Client) {
      r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.r2.accessKeyId,
          secretAccessKey: env.r2.secretAccessKey,
        },
      });
      console.log('⚡ [Storage] Cloudflare R2 Client initialised →', env.r2.bucketName);
    }
    return r2Client;
  }
  return null;
};

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
  const filePath = folder ? `${bucket}/${folder}/${fileName}` : `${bucket}/${fileName}`;

  // 1. Primary Priority: ImageKit.io (20GB Free CDN, No Credit Card Required)
  const ikClient = getImageKitClient();
  if (ikClient) {
    try {
      const uploadable = await toFile(file.buffer, fileName, { type: file.mimetype });
      const response = await ikClient.files.upload({
        file: uploadable,
        fileName,
        folder: folder ? `/${bucket}/${folder}` : `/${bucket}`,
        useUniqueFileName: true,
      });
      return response.url || `${env.imagekit.urlEndpoint}/${response.filePath}`;
    } catch (err: any) {
      console.error('[ImageKit Upload Error]:', err?.message || err);
      throw new AppError('UPLOAD_FAILED', `ImageKit Upload failed: ${err.message}`, 500);
    }
  }

  // 2. Secondary Priority: Cloudflare R2 Storage ($0 Egress Fees)
  const clientR2 = getR2Client();
  if (clientR2) {
    try {
      await clientR2.send(
        new PutObjectCommand({
          Bucket: env.r2.bucketName,
          Key: filePath,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      const publicDomain = env.r2.publicDomain || `https://${env.r2.bucketName}.${env.r2.accountId}.r2.dev`;
      return `${publicDomain}/${filePath}`;
    } catch (err: any) {
      console.error('[Cloudflare R2 Upload Error]:', err?.message || err);
      throw new AppError('UPLOAD_FAILED', `Cloudflare R2 Upload failed: ${err.message}`, 500);
    }
  }

  // 3. Fallback: Supabase Storage
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
  const ikClient = getImageKitClient();
  if (ikClient && url.includes('imagekit.io')) {
    try {
      const fileNameMatch = url.split('/').pop()?.split('?')[0];
      if (fileNameMatch) {
        const searchRes = await ikClient.assets.list({ name: fileNameMatch });
        if (searchRes && Array.isArray(searchRes) && searchRes.length > 0) {
          const fileId = (searchRes[0] as any).id || (searchRes[0] as any).fileId;
          if (fileId) {
            await ikClient.files.delete(fileId);
            return;
          }
        }
      }
    } catch (err: any) {
      console.error('[ImageKit Delete Error]:', err?.message || err);
    }
  }

  const clientR2 = getR2Client();
  if (clientR2 && !url.includes('supabase.co')) {
    try {
      const publicDomain = env.r2.publicDomain || `https://${env.r2.bucketName}.${env.r2.accountId}.r2.dev`;
      const filePath = url.replace(`${publicDomain}/`, '');
      await clientR2.send(
        new DeleteObjectCommand({
          Bucket: env.r2.bucketName,
          Key: filePath,
        })
      );
      return;
    } catch (err: any) {
      console.error('[Cloudflare R2 Delete Error]:', err?.message || err);
    }
  }

  const bucketName = env.supabase.buckets[bucket];
  const bucketUrl = `${env.supabase.url}/storage/v1/object/public/${bucketName}/`;
  const filePath = url.replace(bucketUrl, '');

  const { error } = await supabase.storage.from(bucketName).remove([filePath]);
  if (error) {
    console.error(`[Storage] Failed to delete file: ${error.message}`);
  }
};
