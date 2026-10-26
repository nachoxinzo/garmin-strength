import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mapHevyToGarminCatalog } from '@/lib/hevy-mapper';
import { StrengthRoutine, WorkoutExerciseBlock } from '@/lib/types';

const HEVY_API_BASE = 'https://api.hevyapp.com/v1';

function getHevyTokenFile() {
  return path.join(process.cwd(), 'tokens', 'hevy.json');
}

function getHevyApiKey(): string | null {
  try {
    const file = getHevyTokenFile();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (data.apiKey) return data.apiKey;
    }
  } catch {
    // ignore
  }
  return process.env.HEVY_API_KEY || null;
}

function saveHevyApiKey(apiKey: string) {
  try {
    const dir = path.join(process.cwd(), 'tokens');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(getHevyTokenFile(), JSON.stringify({ apiKey: apiKey.trim() }, null, 2));
  } catch {
    // En entornos serverless (Vercel) el sistema de archivos es de solo lectura; el cliente persiste en Supabase + localStorage
  }
}

interface HevySet {
  index?: number;
  type?: string; // 'normal' | 'warmup' | 'dropset' | 'failure'
  weight_kg?: number | null;
  reps?: number | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
}

interface HevyExerciseEntry {
  index?: number;
  title?: string;
  notes?: string;
  exercise_template_id?: string;
  rest_seconds?: number | null;
  sets?: HevySet[];
}

function extractWorkingSetMetrics(
  sets: HevySet[] | undefined,
  fallbackLatest?: { weightKg: number; reps: number }
): { setsCount: number; reps: number; weightKg: number } {
  const list = Array.isArray(sets) ? sets : [];
  if (list.length === 0) {
    return {
      setsCount: 3,
      reps: fallbackLatest?.reps || 10,
      weightKg: fallbackLatest?.weightKg || 0
    };
  }

  // Filtrar series de calentamiento para no inflar las series efectivas de trabajo
  const workingSets = list.filter((s) => s.type !== 'warmup');
  const effectiveSets = workingSets.length > 0 ? workingSets : list;

  // Peso máximo de trabajo registrado en las series efectivas
  const weights = effectiveSets
    .map((s) => (typeof s.weight_kg === 'number' && !Number.isNaN(s.weight_kg) ? s.weight_kg : 0))
    .filter((w) => w > 0);

  const maxWeight =
    weights.length > 0
      ? Math.round(Math.max(...weights) * 100) / 100
      : fallbackLatest?.weightKg || 0;

  // Repeticiones representativas (media de series efectivas)
  const repsList = effectiveSets
    .map((s) => (typeof s.reps === 'number' && s.reps > 0 ? s.reps : 0))
    .filter((r) => r > 0);

  const avgReps =
    repsList.length > 0
      ? Math.round(repsList.reduce((acc, r) => acc + r, 0) / repsList.length)
      : fallbackLatest?.reps || 10;

  return {
    setsCount: Math.max(1, effectiveSets.length),
    reps: Math.max(1, avgReps),
    weightKg: Math.max(0, maxWeight)
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('apiKey');
    const apiKey = (queryKey && queryKey.trim()) || getHevyApiKey();

    if (!apiKey) {
      return NextResponse.json(
        {
          authenticated: false,
          error: 'No hay API Key de Hevy configurada.'
        },
        { status: 401 }
      );
    }

    // Guardar en disco si es posible (entorno local)
    if (queryKey && queryKey.trim()) {
      saveHevyApiKey(queryKey.trim());
    }

    const headers = {
      'api-key': apiKey,
      Accept: 'application/json'
    };

    // 1. Obtener rutinas guardadas en Hevy (paginando hasta 5 páginas de 10 rutinas)
    const allRawRoutines: any[] = [];
    for (let page = 1; page <= 5; page++) {
      const routinesRes = await fetch(
        `${HEVY_API_BASE}/routines?page=${page}&pageSize=10`,
        { headers, cache: 'no-store' }
      );

      if (!routinesRes.ok) {
        if (page === 1) {
          const errText = await routinesRes.text();
          return NextResponse.json(
            {
              authenticated: false,
              error: `Error de Hevy API (${routinesRes.status}): Verifica tu API Key de Hevy Pro. ${errText}`
            },
            { status: routinesRes.status }
          );
        }
        break;
      }

      const routinesData = await routinesRes.json();
      const pageRoutines = routinesData.routines || [];
      allRawRoutines.push(...pageRoutines);

      const pageCount = routinesData.page_count || 1;
      if (page >= pageCount || pageRoutines.length === 0) {
        break;
      }
    }

    // 2. Obtener los últimos entrenamientos reales (/v1/workouts) para extraer los últimos pesos reales levantados
    const latestExerciseStatsByTemplate = new Map<string, { weightKg: number; reps: number; title: string }>();
    const latestExerciseStatsByTitle = new Map<string, { weightKg: number; reps: number }>();
    const recentWorkouts: any[] = [];

    try {
      const workoutsRes = await fetch(`${HEVY_API_BASE}/workouts?page=1&pageSize=10`, {
        headers,
        cache: 'no-store'
      });
      if (workoutsRes.ok) {
        const workoutsData = await workoutsRes.json();
        const workoutsList = workoutsData.workouts || [];
        recentWorkouts.push(...workoutsList);

        for (const w of workoutsList) {
          for (const ex of (w.exercises || []) as HevyExerciseEntry[]) {
            const metrics = extractWorkingSetMetrics(ex.sets);
            const tplId = ex.exercise_template_id;
            const rawTitle = (ex.title || '').trim();
            const normTitle = rawTitle.toLowerCase();

            if (tplId && !latestExerciseStatsByTemplate.has(tplId) && metrics.weightKg > 0) {
              latestExerciseStatsByTemplate.set(tplId, {
                weightKg: metrics.weightKg,
                reps: metrics.reps,
                title: rawTitle
              });
            }
            if (normTitle && !latestExerciseStatsByTitle.has(normTitle) && metrics.weightKg > 0) {
              latestExerciseStatsByTitle.set(normTitle, {
                weightKg: metrics.weightKg,
                reps: metrics.reps
              });
            }
          }
        }
      }
    } catch {
      // Continuar si el endpoint de workouts falla
    }

    // 3. Transformar las rutinas de Hevy al formato esperado por el editor y Garmin Fénix 8
    const mappedRoutines: any[] = allRawRoutines.map((r: any, idx: number) => {
      const blocks: WorkoutExerciseBlock[] = (r.exercises || []).map(
        (ex: HevyExerciseEntry, exIdx: number) => {
          const tplId = ex.exercise_template_id || '';
          const tplStats = tplId ? latestExerciseStatsByTemplate.get(tplId) : undefined;
          const rawTitle = (ex.title || tplStats?.title || 'Ejercicio Hevy').trim();
          const titleStats = latestExerciseStatsByTitle.get(rawTitle.toLowerCase());

          const fallbackLatest = tplStats || titleStats;
          const { setsCount, reps, weightKg } = extractWorkingSetMetrics(ex.sets, fallbackLatest);
          const catalogEx = mapHevyToGarminCatalog(rawTitle);

          const restSeconds =
            typeof ex.rest_seconds === 'number' && ex.rest_seconds > 0 ? ex.rest_seconds : 90;

          return {
            id: `hevy-api-${r.id || idx}-${exIdx}`,
            exercise: catalogEx,
            sets: setsCount,
            reps,
            weightKg,
            suggestedWeightKg: weightKg > 0 ? weightKg : undefined,
            restSeconds
          };
        }
      );

      const cleanTitle = (r.title || `Rutina Hevy ${idx + 1}`).trim();
      const routineObj: StrengthRoutine = {
        id: `hevy-routine-${r.id || idx}`,
        name: cleanTitle.slice(0, 28),
        warmupSeconds: 300,
        cooldownSeconds: 180,
        blocks
      };

      return {
        id: routineObj.id,
        title: cleanTitle,
        name: routineObj.name,
        exerciseCount: blocks.length,
        totalSets: blocks.reduce((acc, b) => acc + b.sets, 0),
        blocks,
        routine: routineObj
      };
    });

    // 4. Si el usuario no tiene rutinas en /v1/routines pero sí entrenamientos en /v1/workouts,
    // convertir sus entrenamientos recientes en rutinas importables para Garmin
    if (mappedRoutines.length === 0 && recentWorkouts.length > 0) {
      recentWorkouts.forEach((w: any, idx: number) => {
        const blocks: WorkoutExerciseBlock[] = (w.exercises || []).map(
          (ex: HevyExerciseEntry, exIdx: number) => {
            const rawTitle = (ex.title || 'Ejercicio Hevy').trim();
            const { setsCount, reps, weightKg } = extractWorkingSetMetrics(ex.sets);
            const catalogEx = mapHevyToGarminCatalog(rawTitle);

            return {
              id: `hevy-wk-${w.id || idx}-${exIdx}`,
              exercise: catalogEx,
              sets: setsCount,
              reps,
              weightKg,
              suggestedWeightKg: weightKg > 0 ? weightKg : undefined,
              restSeconds:
                typeof ex.rest_seconds === 'number' && ex.rest_seconds > 0 ? ex.rest_seconds : 90
            };
          }
        );

        if (blocks.length > 0) {
          const cleanTitle = (w.title || `Entreno Hevy ${idx + 1}`).trim();
          const routineObj: StrengthRoutine = {
            id: `hevy-workout-${w.id || idx}`,
            name: cleanTitle.slice(0, 28),
            warmupSeconds: 300,
            cooldownSeconds: 180,
            blocks
          };

          mappedRoutines.push({
            id: routineObj.id,
            title: cleanTitle,
            name: routineObj.name,
            exerciseCount: blocks.length,
            totalSets: blocks.reduce((acc, b) => acc + b.sets, 0),
            blocks,
            routine: routineObj
          });
        }
      });
    }

    return NextResponse.json({
      authenticated: true,
      count: mappedRoutines.length,
      routines: mappedRoutines
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error conectando con Hevy API' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey } = body;
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'API Key requerida' }, { status: 400 });
    }
    saveHevyApiKey(apiKey);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
