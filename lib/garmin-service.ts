import path from 'path';
import {
  GarminClient,
  Garmin,
  FileTokenStore,
  workoutFromSpec
} from 'garminconnect-js';
import { EXERCISES } from 'garminconnect-js/exercises';
import { StrengthRoutine, GarminAccountStatus } from './types';
import { EXERCISE_CATALOG } from './exercise-catalog';

function getTokensPath() {
  return path.join(process.cwd(), 'tokens');
}

export async function getGarminClient() {
  const tokenStore = new FileTokenStore(getTokensPath());
  const client = new GarminClient({ tokenStore });
  const hasTokens = await client.loadTokens();
  if (!hasTokens) {
    return null;
  }
  return new Garmin(client);
}

export async function getGarminStatus(): Promise<GarminAccountStatus> {
  try {
    const garmin = await getGarminClient();
    if (!garmin) {
      return { authenticated: false };
    }
    const profile = await garmin.getUserProfile();
    return {
      authenticated: true,
      username: (profile.userName as string) || (profile.displayName as string) || 'Usuario Garmin',
      displayName: (profile.displayName as string) || (profile.fullName as string) || 'Garmin Connect',
      profileImageUrl: (profile.profileImageUrlLarge as string) || (profile.profileImageUrlMedium as string) || undefined
    };
  } catch (error: any) {
    console.error('Error fetching Garmin status:', error);
    return { authenticated: false };
  }
}

/**
 * Garantiza que category y name existan en el diccionario oficial EXERCISES de garminconnect-js
 */
export function resolveValidGarminExercise(
  exerciseId: string,
  category: string,
  garminName: string
): { category: string; name: string } {
  const dict = EXERCISES as Record<string, readonly string[]>;

  // 1. Buscar en el catálogo actualizado por ID
  const catalogMatch = EXERCISE_CATALOG.find((e) => e.id === exerciseId);
  if (catalogMatch && dict[catalogMatch.category]?.includes(catalogMatch.garminName)) {
    return {
      category: catalogMatch.category,
      name: catalogMatch.garminName
    };
  }

  // 2. Comprobar si category y garminName ya son válidos directamente
  if (dict[category]?.includes(garminName)) {
    return { category, name: garminName };
  }

  // 3. Buscar garminName en cualquier categoría de EXERCISES
  for (const [catKey, names] of Object.entries(dict)) {
    if (Array.isArray(names) && names.includes(garminName)) {
      return { category: catKey, name: garminName };
    }
  }

  // 4. Si la categoría existe pero el nombre no, usar el primer ejercicio válido de esa categoría
  if (dict[category] && Array.isArray(dict[category]) && dict[category].length > 0) {
    return { category, name: dict[category][0] };
  }

  // 5. Fallback seguro garantizado
  return { category: 'BENCH_PRESS', name: 'BARBELL_BENCH_PRESS' };
}

export async function syncRoutineToGarmin(routine: StrengthRoutine) {
  const garmin = await getGarminClient();
  if (!garmin) {
    throw new Error('No hay sesión activa de Garmin. Por favor conecta tu cuenta primero.');
  }

  // 1. Convertir la rutina al formato del Workout Spec de Garmin
  const steps: any[] = [];

  // Calentamiento
  if (routine.warmupSeconds > 0) {
    steps.push({
      type: 'warmup',
      time: routine.warmupSeconds
    });
  }

  // Bloques de ejercicios
  routine.blocks.forEach((block) => {
    const validEx = resolveValidGarminExercise(
      block.exercise.id,
      block.exercise.category,
      block.exercise.garminName
    );

    steps.push({
      type: 'repeat',
      times: block.sets,
      steps: [
        {
          type: 'interval',
          reps: block.reps,
          weightKg: block.weightKg,
          exercise: validEx
        },
        {
          type: 'rest',
          restSeconds: block.restSeconds
        }
      ]
    });
  });

  // Enfriamiento
  if (routine.cooldownSeconds > 0) {
    steps.push({
      type: 'cooldown',
      time: routine.cooldownSeconds
    });
  }

  const spec = {
    name: routine.name.slice(0, 16),
    sport: 'strength_training',
    steps
  };

  const workoutPayload = workoutFromSpec(spec, EXERCISES);

  // 2. Subir a Garmin Connect
  const createdWorkout = await garmin.uploadStrengthWorkout(workoutPayload);
  const workoutId = createdWorkout.workoutId;

  // 3. Enviar orden directa al reloj (Fénix 8)
  let pushSuccess = false;
  try {
    await garmin.pushWorkoutToDevice(workoutId);
    pushSuccess = true;
  } catch (err: any) {
    console.warn('Push directo al dispositivo con advertencia:', err?.message || err);
  }

  return {
    success: true,
    workoutId,
    pushSuccess,
    workoutName: workoutPayload.workoutName
  };
}
