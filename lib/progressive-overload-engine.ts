import { StrengthRoutine, WorkoutExerciseBlock } from './types';

export type EffortRating = 'easy' | 'optimal' | 'hard';

export interface ExerciseProgressRecord {
  exerciseId: string;
  lastDate: string;
  lastWeightKg: number;
  lastReps: number;
  lastSets: number;
  lastRestSeconds: number;
  effort: EffortRating;
  consecutiveHardCount: number;
  sessionsCompleted: number;
  bestWeightKg?: number;
  bestReps?: number;
  bestEstimated1RM?: number;
}

export interface ProgressionChange {
  exerciseName: string;
  summary: string; // ej. "+2.5 kg (60 -> 62.5 kg)" o "+2 reps (10 -> 12)"
}

const PROGRESSION_STORAGE_KEY = 'garmin_strength_progression_v1';

export function loadProgressionHistory(): Record<string, ExerciseProgressRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROGRESSION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ExerciseProgressRecord>;
  } catch {
    return {};
  }
}

export function saveProgressionHistory(map: Record<string, ExerciseProgressRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function computeEpley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/**
 * Registra el resultado de un único ejercicio (permite puntuar cada ejercicio por separado).
 */
export function recordSingleExerciseCompletion(
  block: WorkoutExerciseBlock,
  effort: EffortRating
): Record<string, ExerciseProgressRecord> {
  const history = loadProgressionHistory();
  const today = new Date().toISOString().slice(0, 10);
  const prev = history[block.exercise.id];
  const consecutiveHardCount =
    effort === 'hard' ? (prev?.consecutiveHardCount || 0) + 1 : 0;

  const current1RM = computeEpley1RM(block.weightKg, block.reps);
  const prevBest1RM = prev?.bestEstimated1RM || 0;
  const isNew1RM = current1RM >= prevBest1RM;

  history[block.exercise.id] = {
    exerciseId: block.exercise.id,
    lastDate: today,
    lastWeightKg: block.weightKg,
    lastReps: block.reps,
    lastSets: block.sets,
    lastRestSeconds: block.restSeconds,
    effort,
    consecutiveHardCount,
    sessionsCompleted: (prev?.sessionsCompleted || 0) + 1,
    bestWeightKg: isNew1RM ? block.weightKg : prev?.bestWeightKg ?? block.weightKg,
    bestReps: isNew1RM ? block.reps : prev?.bestReps ?? block.reps,
    bestEstimated1RM: Math.max(prevBest1RM, current1RM),
  };

  saveProgressionHistory(history);
  return history;
}

/**
 * Registra una sesión completada con la percepción de esfuerzo individual por ejercicio
 * (o un valor por defecto si algún bloque no se puntuó).
 */
export function recordWorkoutCompletion(
  routine: StrengthRoutine,
  effortOrMap: EffortRating | Record<string, EffortRating>
): Record<string, ExerciseProgressRecord> {
  const history = loadProgressionHistory();
  const today = new Date().toISOString().slice(0, 10);

  for (const block of routine.blocks) {
    const effort: EffortRating =
      typeof effortOrMap === 'string'
        ? effortOrMap
        : effortOrMap[block.id] || effortOrMap[block.exercise.id] || 'optimal';

    const prev = history[block.exercise.id];
    const consecutiveHardCount =
      effort === 'hard' ? (prev?.consecutiveHardCount || 0) + 1 : 0;
    const current1RM = computeEpley1RM(block.weightKg, block.reps);
    const prevBest1RM = prev?.bestEstimated1RM || 0;
    const isNew1RM = current1RM >= prevBest1RM;

    history[block.exercise.id] = {
      exerciseId: block.exercise.id,
      lastDate: today,
      lastWeightKg: block.weightKg,
      lastReps: block.reps,
      lastSets: block.sets,
      lastRestSeconds: block.restSeconds,
      effort,
      consecutiveHardCount,
      sessionsCompleted: (prev?.sessionsCompleted || 0) + 1,
      bestWeightKg: isNew1RM ? block.weightKg : prev?.bestWeightKg ?? block.weightKg,
      bestReps: isNew1RM ? block.reps : prev?.bestReps ?? block.reps,
      bestEstimated1RM: Math.max(prevBest1RM, current1RM),
    };
  }

  saveProgressionHistory(history);
  return history;
}

function roundToPlate(kg: number): number {
  return Math.max(0, Math.round(kg / 2.5) * 2.5);
}

/**
 * Calcula la progresión científica (Doble Progresión + Gestión de Fatiga)
 * para cada bloque de la rutina en función del historial guardado o de una dificultad objetivo.
 */
export function computeProgressiveOverload(
  routine: StrengthRoutine,
  fallbackEffort: EffortRating = 'optimal'
): {
  updatedRoutine: StrengthRoutine;
  changes: ProgressionChange[];
} {
  const history = loadProgressionHistory();
  const changes: ProgressionChange[] = [];

  const updatedBlocks: WorkoutExerciseBlock[] = routine.blocks.map((block) => {
    const record = history[block.exercise.id];
    const effort: EffortRating = record?.effort || fallbackEffort;
    const isLowerBodyCompound =
      block.exercise.muscleGroup === 'Piernas' && block.exercise.tier <= 2;
    const isBodyweight = block.exercise.equipment === 'Peso Corporal' && block.weightKg === 0;

    let nextSets = block.sets;
    let nextReps = block.reps;
    let nextWeight = block.weightKg;
    let nextRest = block.restSeconds;
    const changeParts: string[] = [];

    // 1. Protección automática por fatiga acumulada (2+ sesiones seguidas al límite)
    if (record && record.consecutiveHardCount >= 2) {
      if (nextSets > 2) {
        nextSets = nextSets - 1;
        changeParts.push(`-1 serie (descarga)`);
      }
      nextRest = Math.min(240, nextRest + 15);
      changeParts.push(`+15s descanso`);
    } else if (effort === 'hard') {
      // Fue muy duro: mantener carga y dar +15s de recuperación para consolidar
      nextRest = Math.min(240, nextRest + 15);
      changeParts.push(`mantiene carga, +15s descanso`);
    } else if (effort === 'easy') {
      // Sobrado: Progresión agresiva controlada
      if (isBodyweight) {
        nextReps = Math.min(20, block.reps + 2);
        changeParts.push(`+2 reps (${block.reps}→${nextReps})`);
        if (block.reps >= 14 && block.sets < 4) {
          nextSets = block.sets + 1;
          changeParts.push(`+1 serie`);
        }
      } else if (block.reps >= 10 || block.exercise.tier === 1) {
        const increment = isLowerBodyCompound ? 5 : 2.5;
        nextWeight = roundToPlate(block.weightKg + increment);
        changeParts.push(`+${increment} kg (${block.weightKg}→${nextWeight} kg)`);
        // Si subimos peso tras alcanzar techo de reps, reajustamos reps base
        if (block.reps >= 12) {
          nextReps = 8;
          changeParts.push(`reps 12→8`);
        }
      } else {
        nextReps = block.reps + 2;
        changeParts.push(`+2 reps (${block.reps}→${nextReps})`);
      }
    } else {
      // Óptimo (RIR 1-2): Doble progresión clásica
      const repCeiling = block.exercise.tier === 1 ? 10 : 12;
      if (block.reps < repCeiling) {
        nextReps = block.reps + 1;
        changeParts.push(`+1 rep (${block.reps}→${nextReps})`);
        if (nextRest > 90 && block.exercise.tier >= 2) {
          nextRest = nextRest - 15;
          changeParts.push(`-15s desc`);
        }
      } else {
        if (isBodyweight) {
          if (block.sets < 5) {
            nextSets = block.sets + 1;
            changeParts.push(`+1 serie (${block.sets}→${nextSets})`);
          } else {
            nextReps = block.reps + 1;
            changeParts.push(`+1 rep`);
          }
        } else {
          const increment = isLowerBodyCompound ? 5 : 2.5;
          nextWeight = roundToPlate(block.weightKg + increment);
          nextReps = block.exercise.tier === 1 ? 6 : 8;
          changeParts.push(`+${increment} kg (${block.weightKg}→${nextWeight} kg), reps→${nextReps}`);
        }
      }
    }

    if (changeParts.length > 0) {
      changes.push({
        exerciseName: block.exercise.name,
        summary: changeParts.join(' · '),
      });
    }

    return {
      ...block,
      sets: nextSets,
      reps: nextReps,
      weightKg: nextWeight,
      restSeconds: nextRest,
    };
  });

  return {
    updatedRoutine: {
      ...routine,
      blocks: updatedBlocks,
    },
    changes,
  };
}
