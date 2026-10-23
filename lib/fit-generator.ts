import { Encoder, Profile } from '@garmin/fitsdk';
import { StrengthRoutine } from './types';

// Mapeo entre categorías de Garmin Connect y los IDs del FIT SDK
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
  LATERAL_RAISE: 14,
  LEG_CURL: 15,
  LUNGE: 17,
  PLANK: 19,
  PULL_UP: 21,
  ROW: 23,
  SHOULDER_PRESS: 24,
  SQUAT: 28,
  TRICEPS_EXTENSION: 30
};

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

    for (let s = 1; s <= block.sets; s++) {
      // Paso activo
      flatSteps.push({
        stepName: `S${s} ${block.reps}r ${block.weightKg}k`.slice(0, 16),
        intensity: 'active',
        durationType: 'reps',
        durationValue: block.reps,
        exerciseCategory: catId,
        exerciseName: 1, // default variante básica
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
