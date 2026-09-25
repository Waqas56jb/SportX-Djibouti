import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../utils/errors.js';
import { IMAGE_MIME_TYPES } from '../../middleware/upload.middleware.js';

export type StorageFolder = 'products' | 'categories' | 'brands' | 'users' | 'campaigns' | 'store';

export interface StoredFile {
  url: string;
  path: string;
  contentType: string;
  size: number;
}

/** Detects the real image type from magic bytes; the client-declared MIME type is not trusted. */
export function sniffImageType(buf: Buffer): keyof typeof IMAGE_MIME_TYPES | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(buf.toString('ascii', 8, 12))) return 'image/avif';
  return null;
}

interface StorageProvider {
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  remove(key: string): Promise<void>;
}

const localProvider: StorageProvider = {
  async put(key, body) {
    const root = path.resolve(env.LOCAL_UPLOAD_DIR);
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) throw new AppError('VALIDATION_ERROR', 'Invalid storage path.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    return `${env.API_BASE_URL.replace(/\/$/, '')}/uploads/${key}`;
  },
  async remove(key) {
    const root = path.resolve(env.LOCAL_UPLOAD_DIR);
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) return;
    await fs.rm(target, { force: true });
  },
};

const supabaseProvider: StorageProvider = {
  async put(key, body, contentType) {
    const bucket = supabaseAdmin().storage.from(env.SUPABASE_STORAGE_BUCKET);
    const { error } = await bucket.upload(key, body, { contentType, upsert: false, cacheControl: '31536000' });
    if (error) throw new AppError('INTERNAL_ERROR', 'Could not store the file. Please try again.');
    return bucket.getPublicUrl(key).data.publicUrl;
  },
  async remove(key) {
    await supabaseAdmin().storage.from(env.SUPABASE_STORAGE_BUCKET).remove([key]);
  },
};

const provider = env.STORAGE_PROVIDER === 'local' ? localProvider : supabaseProvider;

/**
 * Stores an uploaded image under a structured path ({folder}/{ownerId}/{random}.{ext}).
 * The original filename is never used; the type is verified from the bytes.
 */
export const storageService = {
  async putImage(folder: StorageFolder, ownerId: string, file: { buffer: Buffer; mimetype: string; size: number }): Promise<StoredFile> {
    if (file.size > env.UPLOAD_MAX_BYTES) throw new AppError('PAYLOAD_TOO_LARGE', 'File is too large.');
    const real = sniffImageType(file.buffer);
    if (!real) throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'The file is not a valid JPEG, PNG, WebP or AVIF image.');
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(ownerId)) throw new AppError('VALIDATION_ERROR', 'Invalid owner id.');
    const key = `${folder}/${ownerId}/${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${IMAGE_MIME_TYPES[real]}`;
    const url = await provider.put(key, file.buffer, real);
    return { url, path: key, contentType: real, size: file.size };
  },

  /** Deletes a previously stored object. External (seed) URLs have no path and are ignored. */
  async remove(storagePath: string | null | undefined): Promise<void> {
    if (!storagePath) return;
    await provider.remove(storagePath).catch(() => undefined);
  },
};
