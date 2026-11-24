import { CatalogExercise, EquipmentType, EXERCISE_CATALOG, MuscleGroup } from './exercise-catalog';
import { getExpertGymExercises } from './expert-gym-guide';
import { getDiscomfortExerciseIds } from './exercise-notes';
import { GarminWellnessSnapshot, StrengthRoutine, WorkoutExerciseBlock } from './types';

export interface MyGymProfile {
  availableEquipment: EquipmentType[];
  avoidLowerBackFatigue: boolean;
  gymName: string;
}

export const DEFAULT_GYM_PROFILE: MyGymProfile = {
  availableEquipment: ['Barra', 'Mancuernas', 'Polea', 'Máquina', 'Peso Corporal'],
  avoidLowerBackFatigue: false,
  gymName: 'Mi Gimnasio Habitual',
};

const GYM_PROFILE_STORAGE_KEY = 'garmin_strength_my_gym_v1';

export function loadMyGymProfile(): MyGymProfile {
  if (typeof window === 'undefined') return DEFAULT_GYM_PROFILE;
  try {
    const raw = localStorage.getItem(GYM_PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_GYM_PROFILE;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.availableEquipment) && parsed.availableEquipment.length > 0) {
      return {
        availableEquipment: parsed.availableEquipment,
        avoidLowerBackFatigue: Boolean(parsed.avoidLowerBackFatigue),
        gymName: String(parsed.gymName || 'Mi Gimnasio Habitual'),
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_GYM_PROFILE;
}

export function saveMyGymProfile(profile: MyGymProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GYM_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

/**
 * Extrae las últimas cargas conocidas desde las rutinas guardadas en el dispositivo
 * para sugerir pesos realistas automáticamente.
 */
export function getKnownExerciseWeights(existingRoutines: StrengthRoutine[] = []): Record<string, number> {
  const weights: Record<string, number> = {};

  // 1. Leer rutinas pasadas explícitas
  for (const r of existingRoutines) {
    for (const b of r.blocks || []) {
      if (b.weightKg > 0) {
        weights[b.exercise.id] = Math.max(weights[b.exercise.id] || 0, b.weightKg);
      }
    }
  }

  // 2. Leer rutinas guardadas en localStorage si existen
  if (typeof window !== 'undefined') {
    try {
      const savedRaw = localStorage.getItem('garmin_strength_routine_v1');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as StrengthRoutine;
        for (const b of parsed.blocks || []) {
          if (b.weightKg > 0 && !weights[b.exercise.id]) {
            weights[b.exercise.id] = b.weightKg;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return weights;
}

const DEFAULT_WEIGHTS_BY_EQUIPMENT: Record<EquipmentType, number> = {
  Barra: 40,
  Mancuernas: 16,
  Polea: 25,
  Máquina: 45,
  'Peso Corporal': 0,
};

export interface SmartGenerateInput {
  prompt: string;
  gymProfile: MyGymProfile;
  durationMinutes: 45 | 60 | 75 | 90;
  goal: 'hypertrophy' | 'strength' | 'powerbuilding';
  knownWeights?: Record<string, number>;
  wellness?: GarminWellnessSnapshot | null;
}

export interface SmartGenerateResult {
  routine: StrengthRoutine;
  coachRationale: string;
  source: 'gemini' | 'adaptive-engine';
}

const LOWER_BACK_HEAVY_IDS = new Set([
  'deadlift_barbell',
  'deadlift_sumo',
  'deadlift_straight_leg',
  'good_morning_barbell',
  'barbell_row',
  'pendlay_row',
  'squat_back_barbell',
]);

/**
 * Motor adaptativo local (cero latencia y fallback sin API key):
 * Interpreta lenguaje natural en español, prioriza ejercicios S-Tier de la Guía Experta,
 * filtra por el equipamiento real del gimnasio del usuario y aplica cargas sugeridas.
 */
export function generateSmartLocalRoutine(input: SmartGenerateInput): SmartGenerateResult {
  const { prompt, gymProfile, durationMinutes, goal, knownWeights = {}, wellness = null } = input;
  const text = prompt.toLowerCase();

  const lowReadiness = Boolean(wellness && wellness.readinessIndex < 45);
  const highReadiness = Boolean(wellness && wellness.readinessIndex >= 75);
  const legFatigueHigh = wellness?.lowerBodyFatigue === 'high';
  const upperFatigueHigh = wellness?.upperBodyFatigue === 'high';

  // Detectar duración mencionada en el prompt si el usuario escribió ej. "45 min"
  let targetDuration = durationMinutes;
  if (text.includes('30 min') || text.includes('40 min') || text.includes('45 min') || text.includes('rápid')) {
    targetDuration = 45;
  } else if (text.includes('75 min')) {
    targetDuration = 75;
  } else if (text.includes('90 min')) {
    targetDuration = 90;
  }

  const targetCount = targetDuration === 45 ? 4 : targetDuration === 60 ? 5 : targetDuration === 75 ? 6 : 7;

  // Detectar fatiga lumbar en el prompt o en el perfil
  const spareLowerBack =
    gymProfile.avoidLowerBackFatigue ||
    text.includes('lumbar') ||
    text.includes('espalda baja') ||
    text.includes('cansad') ||
    text.includes('fatig');

  // Detectar grupos musculares solicitados
  const requestedMuscles: MuscleGroup[] = [];
  if (text.includes('pecho') || text.includes('pectoral') || text.includes('empuje') || text.includes('push')) {
    requestedMuscles.push('Pecho');
  }
  if (text.includes('espalda') || text.includes('dorsal') || text.includes('tracción') || text.includes('pull')) {
    requestedMuscles.push('Espalda');
  }
  if (text.includes('pierna') || text.includes('cuádriceps') || text.includes('cuadriceps') || text.includes('femoral') || text.includes('glúteo') || text.includes('gluteo') || text.includes('legs')) {
    requestedMuscles.push('Piernas');
  }
  if (text.includes('hombro') || text.includes('deltoides') || text.includes('empuje') || text.includes('push')) {
    requestedMuscles.push('Hombros');
  }
  if (text.includes('brazo') || text.includes('bíceps') || text.includes('biceps') || text.includes('tríceps') || text.includes('triceps')) {
    requestedMuscles.push('Brazos');
  }
  if (text.includes('core') || text.includes('abdom')) {
    requestedMuscles.push('Core');
  }

  if (requestedMuscles.length === 0) {
    // Full Body inteligente por defecto
    requestedMuscles.push('Pecho', 'Espalda', 'Piernas', 'Hombros');
  }

  const availableSet = new Set(gymProfile.availableEquipment);
  const discomfortSet = new Set(getDiscomfortExerciseIds());
  const expertList = getExpertGymExercises();
  const expertMap = new Map(expertList.map((e) => [e.exerciseId, e]));

  // Filtrar catálogo disponible según Mi Gimnasio, protección lumbar y alertas articulares
  let candidates = EXERCISE_CATALOG.filter((ex) => {
    if (!availableSet.has(ex.equipment)) return false;
    if (!requestedMuscles.includes(ex.muscleGroup)) return false;
    if (spareLowerBack && LOWER_BACK_HEAVY_IDS.has(ex.id)) return false;
    if (discomfortSet.has(ex.id)) return false;
    return true;
  });

  if (candidates.length === 0) {
    candidates = EXERCISE_CATALOG.filter((ex) => availableSet.has(ex.equipment));
  }

  // Puntuar candidatos: S-Tier experto > A-Tier > Tier 1 > Tier 2 > Tier 3 + coincidencia específica (ej. "superior", "lateral")
  const scored = candidates.map((ex) => {
    let score = 0;
    const expert = expertMap.get(ex.id);
    if (expert?.tier === 'S') score += 50;
    else if (expert?.tier === 'A') score += 30;

    if (ex.tier === 1) score += 20;
    else if (ex.tier === 2) score += 12;
    else score += 6;

    const exName = ex.name.toLowerCase();
    if (text.includes('superior') && exName.includes('inclinado')) score += 40;
    if (text.includes('lateral') && exName.includes('lateral')) score += 40;
    if (text.includes('glúteo') && (exName.includes('hip thrust') || exName.includes('búlgara'))) score += 35;
    if (text.includes('bíceps') && ex.pattern === 'Bíceps') score += 30;
    if (text.includes('tríceps') && ex.pattern === 'Tríceps') score += 30;

    return { ex, score, expert };
  });

  scored.sort((a, b) => b.score - a.score);

  // Seleccionar equilibrando grupos musculares solicitados y evitando patrones repetidos
  const selected: typeof scored = [];
  const usedIds = new Set<string>();
  const usedPatterns = new Map<string, number>();

  // Primera pasada: 1 ejercicio top por cada músculo pedido
  for (const muscle of requestedMuscles) {
    if (selected.length >= targetCount) break;
    const match = scored.find((item) => item.ex.muscleGroup === muscle && !usedIds.has(item.ex.id));
    if (match) {
      selected.push(match);
      usedIds.add(match.ex.id);
      usedPatterns.set(match.ex.pattern, (usedPatterns.get(match.ex.pattern) || 0) + 1);
    }
  }

  // Segunda pasada: completar hasta targetCount con los mejor puntuados sin repetir patrón en exceso
  for (const item of scored) {
    if (selected.length >= targetCount) break;
    if (usedIds.has(item.ex.id)) continue;
    const patternCount = usedPatterns.get(item.ex.pattern) || 0;
    if (patternCount >= 2) continue;
    selected.push(item);
    usedIds.add(item.ex.id);
    usedPatterns.set(item.ex.pattern, patternCount + 1);
  }

  const blocks: WorkoutExerciseBlock[] = selected.map(({ ex, expert }, idx) => {
    let sets = goal === 'strength' && ex.tier === 1 ? 4 : expert?.recommendedSets || 3;
    if (lowReadiness) {
      sets = Math.max(2, sets - 1);
    } else if (legFatigueHigh && ex.muscleGroup === 'Piernas') {
      sets = Math.max(2, sets - 1);
    } else if (upperFatigueHigh && (ex.muscleGroup === 'Espalda' || ex.muscleGroup === 'Hombros')) {
      sets = Math.max(2, sets - 1);
    }

    const reps =
      goal === 'strength'
        ? ex.tier === 1
          ? 5
          : 8
        : expert?.defaultRepsNumber || (ex.tier === 3 ? 12 : 10);
    const baseRest =
      goal === 'strength' ? 150 : expert?.recommendedRestSeconds || (ex.tier === 1 ? 120 : 75);
    const restSeconds = lowReadiness ? baseRest + 15 : baseRest;

    // Peso inteligente: historial conocido o peso base realista por equipamiento
    // Si la recuperación es baja, consolidamos peso sin forzar subida del +2.5%
    const known = knownWeights[ex.id];
    const progressionMultiplier = lowReadiness ? 1.0 : highReadiness ? 1.025 : 1.015;
    const suggested = known
      ? Math.round((known * progressionMultiplier) / 2.5) * 2.5
      : DEFAULT_WEIGHTS_BY_EQUIPMENT[ex.equipment];

    return {
      id: `smart-${Date.now()}-${idx}`,
      exercise: ex,
      sets,
      reps,
      weightKg: suggested,
      suggestedWeightKg: known || undefined,
      restSeconds,
    };
  });

  const cleanMusclesLabel = requestedMuscles.slice(0, 2).join('+');
  const routineName = `IA ${cleanMusclesLabel}`.slice(0, 16);

  const rationaleParts = [
    `Diseñada para ${requestedMuscles.join(', ')} en ~${targetDuration} min usando exclusivamente el equipamiento de "${gymProfile.gymName}" (${gymProfile.availableEquipment.join(', ')}).`,
    spareLowerBack
      ? 'Se han excluido ejercicios con alta carga axial lumbar (peso muerto convencional / sentadilla libre pesada), priorizando máquinas y apoyos estables.'
      : 'Se priorizan ejercicios S-Tier por su estabilidad y perfil de resistencia óptimo.',
    Object.keys(knownWeights).length > 0
      ? lowReadiness
        ? 'Cargas consolidadas sin sobrecarga agresiva por recuperación reducida.'
        : 'Cargas ajustadas automáticamente (+2.5% sobrecarga progresiva) según tu historial reciente.'
      : 'Cargas base orientativas listas para calibrar en tu primera serie.',
  ];

  if (wellness) {
    const sleepTxt = wellness.sleep ? `Sueño ${wellness.sleep.durationHours}h` : 'Sin dato de sueño';
    rationaleParts.push(
      `Contexto Garmin: Readiness ${wellness.readinessIndex}/100 (${sleepTxt}, fatiga tren inferior ${wellness.lowerBodyFatigue}, tren superior ${wellness.upperBodyFatigue}).`
    );
  }

  return {
    routine: {
      id: `smart-routine-${Date.now()}`,
      name: routineName,
      warmupSeconds: 300,
      cooldownSeconds: 180,
      blocks,
    },
    coachRationale: rationaleParts.join(' '),
    source: 'adaptive-engine',
  };
}
