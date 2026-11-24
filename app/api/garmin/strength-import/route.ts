import { NextResponse } from 'next/server';
import { fetchGarminStrengthLogs } from '@/lib/garmin-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await fetchGarminStrengthLogs(body.garminTokens || null);
    return NextResponse.json(result);
  } catch (error: any) {
    const message = error?.message || 'Error al importar sesiones de fuerza de Garmin';
    const status = message.includes('No hay sesión activa') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
