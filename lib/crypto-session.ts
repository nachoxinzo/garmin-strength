import crypto from 'crypto';
import zlib from 'zlib';
import { NextResponse } from 'next/server';

export const GARMIN_SESSION_COOKIE = 'ironsync_garmin_session';
export const HEVY_SESSION_COOKIE = 'ironsync_hevy_session';

const DEFAULT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días
const MAX_COOKIE_CHUNK_CHARS = 3400; // Garantiza < 4096 bytes incluyendo nombre y atributos RFC 6265
const MAX_CHUNKS = 4;
let warnedMissingSecret = false;

function getEncryptionKey(): Buffer {
  const configuredSecret =
    process.env.SESSION_ENCRYPTION_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GARMIN_PASSWORD;

  if (!configuredSecret) {
    if (process.env.NODE_ENV === 'production' && !warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn(
        '[SECURITY] SESSION_ENCRYPTION_SECRET no está configurado en producción. Configúralo en Vercel.'
      );
    }
  }

  const seed = configuredSecret || 'ironsync-local-dev-only-secret-change-in-prod';
  return crypto.createHash('sha256').update(seed).digest();
}

export function isHttpsRequest(req?: Request): boolean {
  if (!req) return process.env.NODE_ENV === 'production';
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim().toLowerCase() === 'https';
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

export function encryptSessionPayload(payload: unknown): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const compressed = zlib.deflateRawSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSessionPayload<T = unknown>(token: string): T | null {
  try {
    const parts = token.split('.');
    const isCompressedV2 = parts[0] === 'v2' && parts.length === 4;
    const ivB64 = isCompressedV2 ? parts[1] : parts[0];
    const tagB64 = isCompressedV2 ? parts[2] : parts[1];
    const cipherB64 = isCompressedV2 ? parts[3] : parts[2];

    if (!ivB64 || !tagB64 || !cipherB64 || (!isCompressedV2 && parts.length !== 3)) {
      return null;
    }

    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const ciphertext = Buffer.from(cipherB64, 'base64url');

    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      return null;
    }

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plainBuf = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const jsonStr = isCompressedV2
      ? zlib.inflateRawSync(plainBuf).toString('utf8')
      : plainBuf.toString('utf8');
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;

  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        map[key] = decodeURIComponent(val);
      } catch {
        map[key] = val;
      }
    }
  }
  return map;
}

export function readEncryptedCookie<T = unknown>(
  req: Request,
  cookieName: string
): T | null {
  const cookies = parseCookieHeader(req.headers.get('cookie'));
  const direct = cookies[cookieName];
  if (direct) {
    return decryptSessionPayload<T>(direct);
  }

  let assembled = '';
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const chunk = cookies[`${cookieName}.${i}`];
    if (!chunk) break;
    assembled += chunk;
  }
  if (!assembled) return null;
  return decryptSessionPayload<T>(assembled);
}

export function attachEncryptedCookie(
  res: NextResponse,
  cookieName: string,
  data: unknown,
  req?: Request,
  maxAgeSeconds = DEFAULT_COOKIE_MAX_AGE
): NextResponse {
  const sealed = encryptSessionPayload(data);
  const secure = isHttpsRequest(req);
  const baseOpts = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
  };

  if (sealed.length <= MAX_COOKIE_CHUNK_CHARS) {
    res.cookies.set(cookieName, sealed, { ...baseOpts, maxAge: maxAgeSeconds });
    for (let i = 0; i < MAX_CHUNKS; i++) {
      res.cookies.set(`${cookieName}.${i}`, '', { ...baseOpts, maxAge: 0 });
    }
    return res;
  }

  res.cookies.set(cookieName, '', { ...baseOpts, maxAge: 0 });
  const totalChunks = Math.ceil(sealed.length / MAX_COOKIE_CHUNK_CHARS);
  for (let i = 0; i < MAX_CHUNKS; i++) {
    if (i < totalChunks) {
      const slice = sealed.slice(i * MAX_COOKIE_CHUNK_CHARS, (i + 1) * MAX_COOKIE_CHUNK_CHARS);
      res.cookies.set(`${cookieName}.${i}`, slice, { ...baseOpts, maxAge: maxAgeSeconds });
    } else {
      res.cookies.set(`${cookieName}.${i}`, '', { ...baseOpts, maxAge: 0 });
    }
  }
  return res;
}

export function clearEncryptedCookie(
  res: NextResponse,
  cookieName: string,
  req?: Request
): NextResponse {
  const baseOpts = {
    httpOnly: true,
    secure: isHttpsRequest(req),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
  res.cookies.set(cookieName, '', baseOpts);
  for (let i = 0; i < MAX_CHUNKS; i++) {
    res.cookies.set(`${cookieName}.${i}`, '', baseOpts);
  }
  return res;
}
