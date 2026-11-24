import { NextResponse } from 'next/server';
import { syncRoutineToGarmin } from '@/lib/garmin-service';
import { StrengthRoutine } from '@/lib/types';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`garmin-sync:${getClientIp(req)}`, 25, 10 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Límite de envíos a Garmin alcanzado. Espera ${rate.resetSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const body = await req.json();
    const routine: StrengthRoutine = body.routine;
    const garminTokens = body.garminTokens || null;

    if (!routine || !routine.name || !Array.isArray(routine.blocks) || routine.blocks.length === 0) {
      return NextResponse.json(
        { error: 'La rutina debe tener al menos un ejercicio y un nombre válido.' },
        { status: 400 }
      );
    }

    if (routine.blocks.length > 35) {
      return NextResponse.json(
        { error: 'La rutina supera el límite máximo de 35 ejercicios.' },
        { status: 400 }
      );
    }

    const result = await syncRoutineToGarmin(routine, garminTokens);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error syncing routine:', error);
    return NextResponse.json(
      { error: error.message || 'Error al sincronizar con Garmin Connect' },
      { status: 500 }
    );
  }
}
