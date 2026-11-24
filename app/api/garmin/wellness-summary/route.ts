import { NextResponse } from 'next/server';
import { fetchGarminWellnessSnapshot } from '@/lib/garmin-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`garmin-wellness:${getClientIp(req)}`, 15, 10 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { success: false, error: `Demasiadas consultas seguidas. Espera ${rate.resetSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const result = await fetchGarminWellnessSnapshot(body.garminTokens || null);
    return NextResponse.json(result);
  } catch (error: any) {
    const message = error?.message || 'Error al obtener datos de salud y deporte de Garmin';
    const status = message.includes('No hay sesión activa') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
