import { NextResponse } from 'next/server';
import { generateFitWorkout } from '@/lib/fit-generator';
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

    const fitBytes = generateFitWorkout(routine);
    const safeName = routine.name.replace(/[^a-zA-Z0-9_-]/g, '_');

    return new NextResponse(fitBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}.fit"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating FIT file:', error);
    return NextResponse.json(
      { error: error.message || 'Error al compilar el archivo FIT' },
      { status: 500 }
    );
  }
}
