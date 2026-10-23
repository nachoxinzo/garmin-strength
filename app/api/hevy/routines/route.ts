import { NextResponse } from 'next/server';
import { matchHevyExerciseToGarmin } from '@/lib/hevy-mapper';
import { StrengthRoutine, WorkoutExerciseBlock } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawApiKey = searchParams.get('apiKey') || req.headers.get('api-key');
    const apiKey = rawApiKey ? rawApiKey.trim() : '';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Por favor introduce tu API Key de Hevy.' },
        { status: 400 }
      );
    }

    console.log(`[Hevy API] Conectando con API Key...`);

    // 1. Obtener rutinas (Hevy exige pageSize <= 10)
    let allRawRoutines: any[] = [];
    let page = 1;
    let maxPages = 3; // hasta 30 rutinas

    while (page <= maxPages) {
      const routinesRes = await fetch(`https://api.hevyapp.com/v1/routines?page=${page}&pageSize=10`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!routinesRes.ok) {
        const errText = await routinesRes.text();
        console.error(`[Hevy API Error] Status ${routinesRes.status}:`, errText);

        let userMsg = `Error de Hevy (${routinesRes.status})`;
        if (routinesRes.status === 401) {
          userMsg = 'API Key no válida (401). Verifica que la has copiado completa sin espacios desde hevy.com/settings?developer.';
        } else if (routinesRes.status === 403) {
          userMsg = 'Acceso denegado (403): La API de Hevy requiere suscripción Hevy Pro activa.';
        } else {
          userMsg = `Error ${routinesRes.status}: ${errText}`;
        }

        return NextResponse.json({ error: userMsg }, { status: routinesRes.status });
      }

      const data = await routinesRes.json();
      const currentRoutines = data.routines || [];
      allRawRoutines.push(...currentRoutines);

      if (!data.page_count || page >= data.page_count || currentRoutines.length === 0) {
        break;
      }
      page++;
    }

    console.log(`[Hevy API] Total rutinas obtenidas: ${allRawRoutines.length}`);

    // 2. Obtener plantillas de ejercicios (pageSize <= 10) para mapear nombres si están disponibles
    let templateMap = new Map<string, string>();
    try {
      const templatesRes = await fetch('https://api.hevyapp.com/v1/exercise_templates?page=1&pageSize=10', {
        headers: { 'api-key': apiKey, 'Accept': 'application/json' }
      });
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        const list = templatesData.exercise_templates || templatesData || [];
        list.forEach((t: any) => {
          if (t.id && t.title) {
            templateMap.set(t.id, t.title);
          }
        });
      }
    } catch (err) {
      console.warn('[Hevy API] templates error:', err);
    }

    // 3. Traducir cada rutina de Hevy a formato Garmin
    const parsedRoutines = allRawRoutines.map((r: any) => {
      const blocks: WorkoutExerciseBlock[] = [];

      (r.exercises || []).forEach((ex: any) => {
        // En Hevy, cada ejercicio dentro de una rutina suele tener ya title o template_id
        const exerciseTitle = ex.title || templateMap.get(ex.exercise_template_id) || 'Ejercicio Hevy';
        const garminExercise = matchHevyExerciseToGarmin(exerciseTitle);

        const normalSets = (ex.sets || []).filter((s: any) => s.type !== 'warmup');
        const setList = normalSets.length > 0 ? normalSets : (ex.sets || []);

        const reps = setList[0]?.reps || 10;
        const weightKg = setList[0]?.weight_kg || 0;
        const restSeconds = ex.rest_seconds || 90;

        blocks.push({
          id: `hevy-${ex.exercise_template_id || Math.random()}`,
          exercise: garminExercise,
          sets: Math.max(1, setList.length),
          reps,
          weightKg,
          suggestedWeightKg: weightKg,
          restSeconds
        });
      });

      const safeName = (r.title || 'Rutina Hevy').slice(0, 16);

      const routine: StrengthRoutine = {
        id: `hevy-routine-${r.id}`,
        name: safeName,
        warmupSeconds: 300,
        cooldownSeconds: 180,
        blocks
      };

      return {
        id: r.id,
        title: r.title,
        updatedAt: r.updated_at ? r.updated_at.slice(0, 10) : '',
        exerciseCount: blocks.length,
        totalSets: blocks.reduce((acc, b) => acc + b.sets, 0),
        routine
      };
    });

    return NextResponse.json({ routines: parsedRoutines });
  } catch (error: any) {
    console.error('[Hevy API Exception]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al conectar con la API de Hevy' },
      { status: 500 }
    );
  }
}
