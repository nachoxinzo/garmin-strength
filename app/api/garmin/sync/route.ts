import { NextResponse } from 'next/server';
import { syncRoutineToGarmin } from '@/lib/garmin-service';
import { StrengthRoutine } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const routine: StrengthRoutine = body.routine;

    if (!routine || !routine.name || !routine.blocks || routine.blocks.length === 0) {
      return NextResponse.json(
        { error: 'La rutina debe tener al menos un ejercicio y un nombre válido.' },
        { status: 400 }
      );
    }

    const result = await syncRoutineToGarmin(routine);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error syncing routine:', error);
    return NextResponse.json(
      { error: error.message || 'Error al sincronizar con Garmin Connect' },
      { status: 500 }
    );
  }
}
