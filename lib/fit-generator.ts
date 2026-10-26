import { Encoder, Profile } from '@garmin/fitsdk';
import { StrengthRoutine } from './types';

// Mapeo completo entre categorías de Garmin Connect y los IDs numéricos del FIT SDK
const FIT_CATEGORY_MAP: Record<string, number> = {
  BENCH_PRESS: 0,
  CALF_RAISE: 1,
  CARDIO: 2,
  CARRY: 3,
  CHOP: 4,
  CORE: 5,
  CRUNCH: 6,
  CURL: 7,
  DEADLIFT: 8,
  FLYE: 9,
  HIP_RAISE: 10,
  HIP_STABILITY: 11,
  HIP_SWING: 12,
  HYPEREXTENSION: 13,
  LATERAL_RAISE: 14,
  LEG_CURL: 15,
  LEG_RAISE: 16,
  LUNGE: 17,
  OLYMPIC_LIFT: 18,
  PLANK: 19,
  PLYO: 20,
  PULL_UP: 21,
  PUSH_UP: 22,
  ROW: 23,
  SHOULDER_PRESS: 24,
  SHOULDER_STABILITY: 25,
  SHRUG: 26,
  SIT_UP: 27,
  SQUAT: 28,
  TOTAL_BODY: 29,
  TRICEPS_EXTENSION: 30,
  WARM_UP: 31,
  RUN: 32,
  BIKE: 33,
  MOVE: 35,
  POSE: 36,
  BANDED_EXERCISES: 37,
  BATTLE_ROPE: 38,
  ELLIPTICAL: 39,
  FLOOR_CLIMB: 40,
  INDOOR_BIKE: 41,
  INDOOR_ROW: 42,
  LADDER: 43,
  SANDBAG: 44,
  SLED: 45,
  SLEDGE_HAMMER: 46,
  STAIR_STEPPER: 47,
  SUSPENSION: 49,
  TIRE: 50
};

function snakeToCamel(str: string): string {
  return str
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Obtiene el ID numérico exacto del ejercicio dentro de su categoría en el FIT SDK
 */
export function resolveFitExerciseNameId(category: string, garminName: string): number {
  try {
    const catCamel = snakeToCamel(category);
    const typeKey = `${catCamel}ExerciseName`;
    const enumObj = (Profile.types as Record<string, Record<string, string>>)[typeKey];
    if (!enumObj) return 0;

    const targetCamel = snakeToCamel(garminName);
    for (const [idStr, nameVal] of Object.entries(enumObj)) {
      if (
        nameVal.toLowerCase() === targetCamel.toLowerCase() ||
        nameVal.toLowerCase() === `_${targetCamel}`.toLowerCase()
      ) {
        const parsed = Number(idStr);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
  } catch {
    // Fallback seguro
  }
  return 0;
}

export function generateFitWorkout(routine: StrengthRoutine): Uint8Array {
  const encoder = new Encoder();

  // 1. FILE_ID
  (encoder as any).onMesg(Profile.MesgNum.FILE_ID, {
    type: 'workout',
    manufacturer: 'development',
    product: 0,
    serialNumber: Math.floor(Math.random() * 1000000) + 100000,
    timeCreated: new Date()
  });

  // Aplanar los pasos para el formato binario
  const flatSteps: any[] = [];

  if (routine.warmupSeconds > 0) {
    flatSteps.push({
      stepName: 'Calentamiento'.slice(0, 16),
      intensity: 'warmup',
      durationType: 'time',
      durationValue: routine.warmupSeconds * 1000
    });
  }

  routine.blocks.forEach((block) => {
    const catId = FIT_CATEGORY_MAP[block.exercise.category] ?? 0;
    const exId = resolveFitExerciseNameId(block.exercise.category, block.exercise.garminName);

    for (let s = 1; s <= block.sets; s++) {
      // Paso activo
      flatSteps.push({
        stepName: `${block.exercise.name.slice(0, 9)} S${s}`.slice(0, 16),
        intensity: 'active',
        durationType: 'reps',
        durationValue: block.reps,
        exerciseCategory: catId,
        exerciseName: exId,
        exerciseWeight: block.weightKg
      });

      // Descanso
      if (block.restSeconds > 0) {
        flatSteps.push({
          stepName: `Descanso S${s}`.slice(0, 16),
          intensity: 'rest',
          durationType: 'time',
          durationValue: block.restSeconds * 1000
        });
      }
    }
  });

  if (routine.cooldownSeconds > 0) {
    flatSteps.push({
      stepName: 'Estiramientos'.slice(0, 16),
      intensity: 'cooldown',
      durationType: 'time',
      durationValue: routine.cooldownSeconds * 1000
    });
  }

  // 2. Mensaje WORKOUT
  (encoder as any).onMesg(Profile.MesgNum.WORKOUT, {
    wktName: routine.name.slice(0, 16),
    sport: 'training',
    subSport: 'strengthTraining',
    numValidSteps: flatSteps.length
  });

  // 3. Mensajes WORKOUT_STEP
  flatSteps.forEach((step, index) => {
    const stepMessage: Record<string, any> = {
      messageIndex: index,
      wktStepName: step.stepName,
      durationType: step.durationType,
      durationValue: step.durationValue,
      targetType: 'open',
      targetValue: 0,
      intensity: step.intensity
    };

    if (step.intensity === 'active') {
      stepMessage.exerciseCategory = step.exerciseCategory;
      stepMessage.exerciseName = step.exerciseName;
      if (step.exerciseWeight !== undefined) {
        stepMessage.exerciseWeight = step.exerciseWeight;
      }
    }

    (encoder as any).onMesg(Profile.MesgNum.WORKOUT_STEP, stepMessage);
  });

  return encoder.close();
}
