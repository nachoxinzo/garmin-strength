import { NextResponse } from 'next/server';
import { fetchGarminActivityDetail } from '@/lib/garmin-service';
import { SportCategory } from '@/lib/types';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`garmin-detail:${getClientIp(req)}`, 40, 10 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { success: false, error: `Demasiadas consultas de detalle. Espera ${rate.resetSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const activityId = Number(body.activityId);
    if (!activityId) {
      return NextResponse.json(
        { success: false, error: 'Falta activityId válido.' },
        { status: 400 }
      );
    }
    const sportCategory = (body.sportCategory || 'Cardio / Otros') as SportCategory;
    const result = await fetchGarminActivityDetail(
      activityId,
      sportCategory,
      body.garminTokens || null
    );
    return NextResponse.json(result);
  } catch (error: any) {
    const message = error?.message || 'Error al obtener detalle de la actividad de Garmin';
    const status = message.includes('No hay sesión activa') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
