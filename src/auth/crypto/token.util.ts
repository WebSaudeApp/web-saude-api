import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export function hashSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256Matches(value: string, digest: string): boolean {
  const left = Buffer.from(hashSha256(value));
  const right = Buffer.from(digest);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateEmailCode(): string {
  return randomInt(100000, 1000000).toString();
}

export function addDuration(duration: string, from = new Date()): Date {
  return new Date(from.getTime() + durationToMs(duration));
}

export function durationToSeconds(duration: string): number {
  return Math.floor(durationToMs(duration) / 1000);
}

function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error('Duração JWT inválida.');
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multiplier[unit];
}
