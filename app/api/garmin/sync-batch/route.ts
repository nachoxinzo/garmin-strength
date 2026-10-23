import { NextResponse } from 'next/server';
import { syncRoutineToGarmin } from '@/lib/garmin-service';
import { StrengthRoutine } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const routines: StrengthRoutine[] = body.routines;

    if (!Array.isArray(routines) || routines.length === 0) {
      return NextResponse.json(
        { error: 'Debes proporcionar al menos una rutina para sincronizar.' },
        { status: 400 }
      );
    }

    const results: Array<{
      workoutId?: number | string;
      workoutName: string;
      success: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < routines.length; i++) {
      const routine = routines[i];
      try {
        const res = await syncRoutineToGarmin(routine);
        results.push({
          workoutId: res.workoutId,
          workoutName: res.workoutName || routine.name,
          success: true
        });
      } catch (err: any) {
        console.error(`Error sincronizando rutina "${routine.name}":`, err);
        results.push({
          workoutName: routine.name,
          success: false,
          error: err.message || 'Error desconocido'
        });
      }

      // Pequeña pausa de 400ms entre llamadas consecutivas para proteger contra rate limit de Garmin
      if (i < routines.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    const totalSuccess = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: totalSuccess > 0,
      totalSuccess,
      totalFailed,
      results
    });
  } catch (error: any) {
    console.error('Error en sync-batch:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno en la sincronización por lotes' },
      { status: 500 }
    );
  }
}
