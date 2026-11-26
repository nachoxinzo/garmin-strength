import { NextResponse } from 'next/server';
import {
  attachEncryptedCookie,
  GARMIN_SESSION_COOKIE,
  readEncryptedCookie,
} from '@/lib/crypto-session';
import { GarminTokensPayload, syncRoutineToGarmin } from '@/lib/garmin-service';
import { StrengthRoutine } from '@/lib/types';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`garmin-batch:${getClientIp(req)}`, 8, 10 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Límite de sincronización por lotes alcanzado. Espera ${rate.resetSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const body = await req.json();
    const routines: StrengthRoutine[] = body.routines;
    const cookieTokens = readEncryptedCookie<GarminTokensPayload>(req, GARMIN_SESSION_COOKIE);
    let currentTokens: GarminTokensPayload | null =
      cookieTokens || (body?.garminTokens as GarminTokensPayload | null) || null;

    if (!Array.isArray(routines) || routines.length === 0) {
      return NextResponse.json(
        { error: 'Debes proporcionar al menos una rutina para sincronizar.' },
        { status: 400 }
      );
    }

    if (routines.length > 14) {
      return NextResponse.json(
        { error: 'Máximo 14 rutinas permitidas por lote de sincronización.' },
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
        const res = await syncRoutineToGarmin(routine, currentTokens);
        if (res.tokens) {
          currentTokens = res.tokens;
        }
        results.push({
          workoutId: res.workoutId,
          workoutName: res.workoutName || routine.name,
          success: true,
        });
      } catch (err: any) {
        console.error(`Error sincronizando rutina "${routine.name}":`, err);
        results.push({
          workoutName: routine.name,
          success: false,
          error: err.message || 'Error desconocido',
        });
      }

      if (i < routines.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    const totalSuccess = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;

    const response = NextResponse.json({
      success: totalSuccess > 0,
      totalSuccess,
      totalFailed,
      results,
    });
    if (currentTokens) {
      attachEncryptedCookie(response, GARMIN_SESSION_COOKIE, currentTokens, req);
    }
    return response;
  } catch (error: any) {
    console.error('Error en sync-batch:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno en la sincronización por lotes' },
      { status: 500 }
    );
  }
}
