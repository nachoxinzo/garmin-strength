import { NextResponse } from 'next/server';
import {
  attachEncryptedCookie,
  GARMIN_SESSION_COOKIE,
  readEncryptedCookie,
} from '@/lib/crypto-session';
import {
  fetchGarminStrengthLogs,
  GarminTokensPayload,
} from '@/lib/garmin-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`garmin-import:${getClientIp(req)}`, 10, 10 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { success: false, error: `Límite de importaciones alcanzado. Espera ${rate.resetSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cookieTokens = readEncryptedCookie<GarminTokensPayload>(req, GARMIN_SESSION_COOKIE);
    const effectiveTokens = cookieTokens || (body?.garminTokens as GarminTokensPayload | null) || null;

    const result = await fetchGarminStrengthLogs(effectiveTokens);
    const { tokens, ...safeResult } = result;
    const res = NextResponse.json(safeResult);
    if (tokens) {
      attachEncryptedCookie(res, GARMIN_SESSION_COOKIE, tokens, req);
    }
    return res;
  } catch (error: any) {
    const message = error?.message || 'Error al importar sesiones de fuerza de Garmin';
    const status = message.includes('No hay sesión activa') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
