import { EXERCISE_CATALOG, MuscleGroup } from './exercise-catalog';
import { loadProgressionHistory } from './progressive-overload-engine';
import { loadWeeklyPlan } from './weekly-planner';

export interface MuscleVolumeStatus {
  muscle: MuscleGroup;
  plannedSets: number;
  recordedSets: number;
  targetMin: number;
  targetMax: number;
  status: 'deficit' | 'optimal' | 'high';
}

const MUSCLE_GROUPS: MuscleGroup[] = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'];

const TARGET_WEEKLY_SETS: Record<MuscleGroup, { min: number; max: number }> = {
  Pecho: { min: 10, max: 18 },
  Espalda: { min: 12, max: 20 },
  Piernas: { min: 12, max: 20 },
  Hombros: { min: 10, max: 18 },
  Brazos: { min: 8, max: 16 },
  Core: { min: 6, max: 14 },
};

const catalogById = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]));

/**
 * Analiza las series semanales planificadas y registradas por grupo muscular
 * para detectar desequilibrios o músculos sub-entrenados respecto a umbrales de hipertrofia.
 */
export function analyzeWeeklyMuscleBalance(): MuscleVolumeStatus[] {
  const plan = loadWeeklyPlan();
  const history = loadProgressionHistory();

  const plannedMap = new Map<MuscleGroup, number>();
  const recordedMap = new Map<MuscleGroup, number>();

  Object.values(plan).forEach((routine) => {
    if (!routine) return;
    for (const block of routine.blocks) {
      const m = block.exercise.muscleGroup;
      plannedMap.set(m, (plannedMap.get(m) || 0) + block.sets);
    }
  });

  // Contar series registradas en los últimos 7 días
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  Object.values(history).forEach((rec) => {
    if (rec.lastDate >= sevenDaysAgo) {
      const ex = catalogById.get(rec.exerciseId);
      if (ex) {
        recordedMap.set(ex.muscleGroup, (recordedMap.get(ex.muscleGroup) || 0) + rec.lastSets);
      }
    }
  });

  return MUSCLE_GROUPS.map((muscle) => {
    const plannedSets = plannedMap.get(muscle) || 0;
    const recordedSets = recordedMap.get(muscle) || 0;
    const effective = Math.max(plannedSets, recordedSets);
    const { min, max } = TARGET_WEEKLY_SETS[muscle];

    let status: 'deficit' | 'optimal' | 'high' = 'optimal';
    if (effective < min) status = 'deficit';
    else if (effective > max) status = 'high';

    return {
      muscle,
      plannedSets,
      recordedSets,
      targetMin: min,
      targetMax: max,
      status,
    };
  });
}
