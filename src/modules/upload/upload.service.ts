import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import ImageKit, { toFile } from '@imagekit/nodejs';
import { v2 as cloudinary } from 'cloudinary';
import supabase from '../../config/supabase';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

type BucketKey = 'avatars' | 'products' | 'categories';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ─── 1. Primary: ImageKit.io Client ───────────────────────────────────────────

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

// ─── 2. Secondary: Cloudinary Client ──────────────────────────────────────────

let isCloudinaryConfigured = false;

const getCloudinaryClient = () => {
  if (env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret) {
    if (!isCloudinaryConfigured) {
      cloudinary.config({
        cloud_name: env.cloudinary.cloudName,
        api_key: env.cloudinary.apiKey,
        api_secret: env.cloudinary.apiSecret,
        secure: true,
      });
      isCloudinaryConfigured = true;
      console.log('⚡ [Storage] Cloudinary Client initialised →', env.cloudinary.cloudName);
    }
    return cloudinary;
  }
  return null;
};

// ─── 4. Last: Cloudflare R2 S3-Compatible Client ──────────────────────────────

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

  // 2. Secondary Priority: Cloudinary (25GB Free CDN, No Credit Card Required)
  const cldClient = getCloudinaryClient();
  if (cldClient) {
    try {
      const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const result = await cldClient.uploader.upload(base64Data, {
        folder: folder ? `${bucket}/${folder}` : bucket,
        public_id: path.parse(fileName).name,
        resource_type: 'auto',
      });
      return result.secure_url;
    } catch (err: any) {
      console.error('[Cloudinary Upload Error]:', err?.message || err);
      throw new AppError('UPLOAD_FAILED', `Cloudinary Upload failed: ${err.message}`, 500);
    }
  }

  // 3. Fallback: Supabase Storage
  if (env.supabase.url && env.supabase.serviceRoleKey) {
    const bucketName = env.supabase.buckets[bucket];
    const { error } = await supabase.storage.from(bucketName).upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (!error) {
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      return data.publicUrl;
    }
  }

  // 4. Last Priority: Cloudflare R2 Storage ($0 Egress Fees)
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

  throw new AppError('STORAGE_UNAVAILABLE', 'No active storage provider configured', 500);
};

// ─── Delete File ──────────────────────────────────────────────────────────────

export const deleteFile = async (url: string, bucket: BucketKey): Promise<void> => {
  // 1. Delete from ImageKit if URL matches
  const ikClient = getImageKitClient();
  if (ikClient && url.includes('imagekit.io')) {
    try {
      const fileNameMatch = url.split('/').pop()?.split('?')[0];
      if (fileNameMatch) {
        const searchRes = await ikClient.assets.list({ searchQuery: `name = "${fileNameMatch}"` });
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

  // 2. Delete from Cloudinary if URL matches
  const cldClient = getCloudinaryClient();
  if (cldClient && url.includes('cloudinary.com')) {
    try {
      const urlParts = url.split('/');
      const publicIdWithExt = urlParts.slice(-2).join('/'); // folder/filename.ext
      const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
      await cldClient.uploader.destroy(publicId);
      return;
    } catch (err: any) {
      console.error('[Cloudinary Delete Error]:', err?.message || err);
    }
  }

  // 3. Delete from Supabase if URL matches
  if (url.includes('supabase.co')) {
    const bucketName = env.supabase.buckets[bucket];
    const bucketUrl = `${env.supabase.url}/storage/v1/object/public/${bucketName}/`;
    const filePath = url.replace(bucketUrl, '');

    const { error } = await supabase.storage.from(bucketName).remove([filePath]);
    if (error) {
      console.error(`[Supabase Storage] Failed to delete file: ${error.message}`);
    }
    return;
  }

  // 4. Delete from Cloudflare R2
  const clientR2 = getR2Client();
  if (clientR2) {
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
};

/**
 * Universal document and email attachment uploader
 * Supports PDFs, spreadsheets, CAD drawings, docs, images, ZIPs without MIME restrictions
 */
export const uploadAttachmentFile = async (
  file: { originalname: string; mimetype: string; buffer: Buffer; size?: number },
  folder: string = 'po-attachments'
): Promise<string> => {
  const cleanBaseName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}-${cleanBaseName}`;
  const filePath = `${folder}/${fileName}`;

  // 1. Primary Priority: ImageKit.io
  const ikClient = getImageKitClient();
  if (ikClient) {
    try {
      const uploadable = await toFile(file.buffer, fileName, { type: file.mimetype });
      const response = await ikClient.files.upload({
        file: uploadable,
        fileName,
        folder: `/${folder}`,
        useUniqueFileName: true,
      });
      if (response?.url) return response.url;
    } catch (err: any) {
      console.warn('[Storage] ImageKit document upload fallback:', err?.message || err);
    }
  }

  // 2. Secondary Priority: Cloudinary
  const cldClient = getCloudinaryClient();
  if (cldClient) {
    try {
      const base64Data = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;
      const result = await cldClient.uploader.upload(base64Data, {
        folder,
        public_id: path.parse(fileName).name,
        resource_type: 'auto',
      });
      if (result?.secure_url) return result.secure_url;
    } catch (err: any) {
      console.warn('[Storage] Cloudinary document upload fallback:', err?.message || err);
    }
  }

  // 3. Fallback: Supabase Storage
  if (env.supabase.url && env.supabase.serviceRoleKey) {
    try {
      const bucketName = env.supabase.buckets.products || 'products';
      const { error } = await supabase.storage.from(bucketName).upload(filePath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true,
      });

      if (!error) {
        const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        if (data?.publicUrl) return data.publicUrl;
      }
    } catch (err: any) {
      console.warn('[Storage] Supabase document upload fallback:', err?.message || err);
    }
  }

  // 4. Fallback: Cloudflare R2 Storage
  const clientR2 = getR2Client();
  if (clientR2) {
    try {
      await clientR2.send(
        new PutObjectCommand({
          Bucket: env.r2.bucketName,
          Key: filePath,
          Body: file.buffer,
          ContentType: file.mimetype || 'application/octet-stream',
        })
      );

      const publicDomain = env.r2.publicDomain || `https://${env.r2.bucketName}.${env.r2.accountId}.r2.dev`;
      return `${publicDomain}/${filePath}`;
    } catch (err: any) {
      console.warn('[Storage] Cloudflare R2 document upload fallback:', err?.message || err);
    }
  }

  // 5. Fallback: Local Filesystem storage
  try {
    const fs = await import('fs');
    const uploadDir = path.join(process.cwd(), 'uploads', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localPath = path.join(uploadDir, fileName);
    fs.writeFileSync(localPath, file.buffer);
    return `/uploads/${folder}/${fileName}`;
  } catch (fsErr: any) {
    console.warn('[Storage] Local filesystem write fallback:', fsErr?.message || fsErr);
  }

  // 6. Final In-Memory Base64 Data URI (Guarantees zero data loss)
  return `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;
};
