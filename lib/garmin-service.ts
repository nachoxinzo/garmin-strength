import path from 'path';
import {
  GarminClient,
  Garmin,
  FileTokenStore,
  workoutFromSpec
} from 'garminconnect-js';
import { EXERCISES } from 'garminconnect-js/exercises';
import { StrengthRoutine, GarminAccountStatus } from './types';

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
    steps.push({
      type: 'repeat',
      times: block.sets,
      steps: [
        {
          type: 'interval',
          reps: block.reps,
          weightKg: block.weightKg,
          exercise: {
            category: block.exercise.category,
            name: block.exercise.garminName
          }
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
