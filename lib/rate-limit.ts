interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of store.entries()) {
      rec.timestamps = rec.timestamps.filter((ts) => now - ts < 3600000);
      if (rec.timestamps.length === 0) store.delete(key);
    }
  }, 10 * 60 * 1000).unref?.();
}

export function getClientIp(request: Request): string {
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) return vercelIp.split(',')[0].trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return '127.0.0.1';
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; resetSeconds: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { success: false, resetSeconds };
  }

  record.timestamps.push(now);
  return { success: true, resetSeconds: Math.ceil(windowMs / 1000) };
}
