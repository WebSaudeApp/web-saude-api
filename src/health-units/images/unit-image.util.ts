import { randomUUID } from 'crypto';
import { mkdir, unlink } from 'fs/promises';
import { extname, join } from 'path';

export const MAX_UNIT_IMAGES = 50;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const ALLOWED_IMAGE_MIMES = Object.keys(MIME_TO_EXT);

export function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? '';
}

export function isAllowedImage(file: {
  mimetype: string;
  originalname: string;
}): boolean {
  const ext = extname(file.originalname).toLowerCase();
  const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
  return (
    ALLOWED_IMAGE_MIMES.includes(file.mimetype) && allowedExt.includes(ext)
  );
}

export function uniqueImageName(mime: string): string {
  return `${randomUUID()}${extensionForMime(mime)}`;
}

export function uploadsRoot(): string {
  return join(process.cwd(), 'uploads', 'health-units');
}

export async function ensureUploadsDir(): Promise<void> {
  await mkdir(uploadsRoot(), { recursive: true });
}

export function publicImageUrl(imageId: string): string {
  return `/unit-images/${imageId}`;
}

export async function removeUploadedFile(url: string): Promise<void> {
  if (!url.startsWith('/uploads/')) {
    return;
  }
  const filename = url.split('/').pop();
  if (!filename) {
    return;
  }
  try {
    await unlink(join(uploadsRoot(), filename));
  } catch {
    return;
  }
}
