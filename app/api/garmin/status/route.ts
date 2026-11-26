import { NextResponse } from 'next/server';
import {
  attachEncryptedCookie,
  GARMIN_SESSION_COOKIE,
  readEncryptedCookie,
} from '@/lib/crypto-session';
import { GarminTokensPayload, getGarminStatus } from '@/lib/garmin-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const rate = checkRateLimit(`garmin-status:${getClientIp(req)}`, 40, 10 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { authenticated: false, error: `Demasiadas consultas. Espera ${rate.resetSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const cookieTokens = readEncryptedCookie<GarminTokensPayload>(req, GARMIN_SESSION_COOKIE);
    const status = await getGarminStatus(cookieTokens);
    const { tokens, ...safeStatus } = status;
    const res = NextResponse.json(safeStatus);
    if (tokens) {
      attachEncryptedCookie(res, GARMIN_SESSION_COOKIE, tokens, req);
    }
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error?.message || 'Error comprobando estado de Garmin' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`garmin-status:${getClientIp(req)}`, 40, 10 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { authenticated: false, error: `Demasiadas consultas. Espera ${rate.resetSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cookieTokens = readEncryptedCookie<GarminTokensPayload>(req, GARMIN_SESSION_COOKIE);
    const effectiveTokens = cookieTokens || (body?.garminTokens as GarminTokensPayload | null) || null;

    const status = await getGarminStatus(effectiveTokens);
    const { tokens, ...safeStatus } = status;
    const res = NextResponse.json(safeStatus);
    if (tokens) {
      attachEncryptedCookie(res, GARMIN_SESSION_COOKIE, tokens, req);
    }
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error?.message || 'Error comprobando estado de Garmin' },
      { status: 500 }
    );
  }
}
