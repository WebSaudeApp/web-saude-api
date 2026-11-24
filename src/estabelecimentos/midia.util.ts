import { extname } from 'path';

export const MAX_UNIT_IMAGES = 50;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const ALLOWED_IMAGE_MIMES = Object.keys(MIME_TO_EXT);

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

export function publicImageUrl(imageId: string): string {
  return `/midias/${imageId}`;
}
