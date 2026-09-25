import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export const IMAGE_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Memory upload limited to one image. The declared MIME type is checked here; the actual
 * bytes are verified by magic number in the storage service before anything is saved.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIME_TYPES[file.mimetype]) return cb(new AppError('UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, WebP or AVIF images are allowed.'));
    cb(null, true);
  },
});
