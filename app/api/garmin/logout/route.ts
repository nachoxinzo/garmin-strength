import { NextResponse } from 'next/server';
import {
  clearEncryptedCookie,
  GARMIN_SESSION_COOKIE,
} from '@/lib/crypto-session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const res = NextResponse.json({ success: true });
  return clearEncryptedCookie(res, GARMIN_SESSION_COOKIE, req);
}
