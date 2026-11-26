import { CatalogExercise, EquipmentType, EXERCISE_CATALOG, MuscleGroup } from './exercise-catalog';
import { getExpertGymExercises } from './expert-gym-guide';
import { getDiscomfortExerciseIds } from './exercise-notes';
import { GarminWellnessSnapshot, StrengthRoutine, WorkoutExerciseBlock } from './types';

export type TrainingEnvironment = 'gym' | 'home_minimal' | 'home_no_equipment';

export interface MyGymProfile {
  availableEquipment: EquipmentType[];
  avoidLowerBackFatigue: boolean;
  gymName: string;
  environment?: TrainingEnvironment;
}

export const TRAINING_ENVIRONMENT_PRESETS: Record<
  TrainingEnvironment,
  {
    label: string;
    shortLabel: string;
    description: string;
    gymName: string;
    availableEquipment: EquipmentType[];
  }
> = {
  gym: {
    label: 'Gimnasio Completo',
    shortLabel: 'Gimnasio',
    description: 'Barras, máquinas guiadas, poleas, mancuernas y racks',
    gymName: 'Mi Gimnasio Habitual',
    availableEquipment: ['Barra', 'Mancuernas', 'Polea', 'Máquina', 'Peso Corporal'],
  },
  home_minimal: {
    label: 'En Casa · Poco Material',
    shortLabel: 'Casa · Mancuernas',
    description: 'Mancuernas y peso corporal (sin máquinas ni barras olímpicas)',
    gymName: 'En Casa (Poco Material)',
    availableEquipment: ['Mancuernas', 'Peso Corporal'],
  },
  home_no_equipment: {
    label: 'En Casa · Sin Material',
    shortLabel: 'Casa · Sin material',
    description: '100% peso corporal sin equipamiento ni barra de dominadas',
    gymName: 'En Casa (Sin Material)',
    availableEquipment: ['Peso Corporal'],
  },
};

export const GYM_ONLY_BODYWEIGHT_IDS = new Set<string>([
  'pull_up',
  'chin_up',
  'neutral_grip_pull_up',
  'dips_chest',
  'triceps_dip_weighted',
  'hanging_leg_raise',
  'hanging_knee_raise',
  'back_extension',
  'ab_wheel_rollout',
]);

export const DEFAULT_GYM_PROFILE: MyGymProfile = {
  availableEquipment: ['Barra', 'Mancuernas', 'Polea', 'Máquina', 'Peso Corporal'],
  avoidLowerBackFatigue: false,
  gymName: 'Mi Gimnasio Habitual',
  environment: 'gym',
};

const GYM_PROFILE_STORAGE_KEY = 'garmin_strength_my_gym_v1';

export function isExerciseAllowedForProfile(
  ex: CatalogExercise,
  profile: MyGymProfile
): boolean {
  if (!profile.availableEquipment.includes(ex.equipment)) return false;
  const env = profile.environment || 'gym';
  if ((env === 'home_no_equipment' || env === 'home_minimal') && GYM_ONLY_BODYWEIGHT_IDS.has(ex.id)) {
    return false;
  }
  return true;
}

export function resolveEffectiveGymProfile(
  gymProfile: MyGymProfile,
  promptText = ''
): { effectiveProfile: MyGymProfile; isHome: boolean } {
  const text = promptText.toLowerCase();
  const baseEnv: TrainingEnvironment =
    gymProfile.environment ||
    (gymProfile.availableEquipment.length === 1 &&
    gymProfile.availableEquipment[0] === 'Peso Corporal'
      ? 'home_no_equipment'
      : gymProfile.availableEquipment.every(
          (e) => e === 'Mancuernas' || e === 'Peso Corporal'
        )
      ? 'home_minimal'
      : 'gym');

  const asksNoEquip =
    text.includes('sin material') ||
    text.includes('sin equipo') ||
    text.includes('sin equipamiento') ||
    text.includes('nada de material') ||
    text.includes('solo peso corporal');
  const asksHomeMinimal =
    !asksNoEquip &&
    (text.includes('en casa') ||
      text.includes('desde casa') ||
      text.includes('poco material') ||
      text.includes('solo mancuernas') ||
      text.includes('hotel') ||
      text.includes('viaje'));

  if (asksNoEquip) {
    const preset = TRAINING_ENVIRONMENT_PRESETS.home_no_equipment;
    return {
      effectiveProfile: {
        ...gymProfile,
        environment: 'home_no_equipment',
        availableEquipment: preset.availableEquipment,
        gymName: preset.gymName,
      },
      isHome: true,
    };
  }

  if (asksHomeMinimal && baseEnv === 'gym') {
    const preset = TRAINING_ENVIRONMENT_PRESETS.home_minimal;
    return {
      effectiveProfile: {
        ...gymProfile,
        environment: 'home_minimal',
        availableEquipment: preset.availableEquipment,
        gymName: preset.gymName,
      },
      isHome: true,
    };
  }

  return {
    effectiveProfile: { ...gymProfile, environment: baseEnv },
    isHome: baseEnv === 'home_minimal' || baseEnv === 'home_no_equipment',
  };
}

export function loadMyGymProfile(): MyGymProfile {
  if (typeof window === 'undefined') return DEFAULT_GYM_PROFILE;
  try {
    const raw = localStorage.getItem(GYM_PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_GYM_PROFILE;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.availableEquipment) && parsed.availableEquipment.length > 0) {
      const env: TrainingEnvironment =
        parsed.environment === 'home_minimal' ||
        parsed.environment === 'home_no_equipment' ||
        parsed.environment === 'gym'
          ? parsed.environment
          : 'gym';
      return {
        availableEquipment: parsed.availableEquipment,
        avoidLowerBackFatigue: Boolean(parsed.avoidLowerBackFatigue),
        gymName: String(parsed.gymName || TRAINING_ENVIRONMENT_PRESETS[env].gymName),
        environment: env,
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
  weeklyMuscleDeficits?: MuscleGroup[];
  deloadMode?: boolean;
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

// Ejercicios con pico de tensión en posición elongada (hipertrofia mediada por estiramiento)
const STRETCH_MEDIATED_IDS = new Set([
  'bench_press_incline_dumbbell',
  'incline_chest_press_machine',
  'cable_crossover',
  'dumbbell_fly',
  'overhead_triceps_extension_cable',
  'overhead_triceps_extension_dumbbell',
  'incline_dumbbell_curl',
  'leg_curl_seated',
  'romanian_deadlift',
  'lateral_raise_cable',
  'lat_pulldown',
  'calf_raise_standing',
]);

/**
 * Motor adaptativo local (cero latencia y fallback sin API key):
 * Interpreta lenguaje natural en español, prioriza ejercicios S-Tier de la Guía Experta,
 * filtra por el equipamiento real del gimnasio del usuario y aplica cargas sugeridas.
 */
export function generateSmartLocalRoutine(input: SmartGenerateInput): SmartGenerateResult {
  const {
    prompt,
    gymProfile,
    durationMinutes,
    goal,
    knownWeights = {},
    wellness = null,
    weeklyMuscleDeficits = [],
    deloadMode = false,
  } = input;
  const text = prompt.toLowerCase();

  const lowReadiness = Boolean(wellness && wellness.readinessIndex < 45);
  const isDeload = deloadMode || lowReadiness || text.includes('descarga') || text.includes('deload');
  const highReadiness = Boolean(wellness && wellness.readinessIndex >= 75 && !isDeload);
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
  const { effectiveProfile, isHome } = resolveEffectiveGymProfile(gymProfile, text);
  const spareLowerBack =
    effectiveProfile.avoidLowerBackFatigue ||
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
  if (text.includes('torso') || text.includes('upper')) {
    if (!requestedMuscles.includes('Pecho')) requestedMuscles.push('Pecho');
    if (!requestedMuscles.includes('Espalda')) requestedMuscles.push('Espalda');
    if (!requestedMuscles.includes('Hombros')) requestedMuscles.push('Hombros');
  }
  if (text.includes('core') || text.includes('abdom')) {
    requestedMuscles.push('Core');
  }

  if (requestedMuscles.length === 0) {
    // Full Body inteligente por defecto
    requestedMuscles.push('Pecho', 'Espalda', 'Piernas', 'Hombros', 'Core');
  }

  const discomfortSet = new Set(getDiscomfortExerciseIds());
  const expertList = getExpertGymExercises();
  const expertMap = new Map(expertList.map((e) => [e.exerciseId, e]));

  // Filtrar catálogo disponible según Entorno / Mi Gimnasio, protección lumbar y alertas articulares
  let candidates = EXERCISE_CATALOG.filter((ex) => {
    if (!isExerciseAllowedForProfile(ex, effectiveProfile)) return false;
    if (!requestedMuscles.includes(ex.muscleGroup)) return false;
    if (spareLowerBack && LOWER_BACK_HEAVY_IDS.has(ex.id)) return false;
    if (discomfortSet.has(ex.id)) return false;
    return true;
  });

  if (candidates.length < requestedMuscles.length) {
    candidates = EXERCISE_CATALOG.filter((ex) => isExerciseAllowedForProfile(ex, effectiveProfile));
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

    // Bonus científico: hipertrofia mediada por estiramiento (Maeo/Wolf et al.)
    if (STRETCH_MEDIATED_IDS.has(ex.id)) score += 22;

    // Bonus si el grupo muscular tiene déficit de volumen semanal (10-20 series)
    if (weeklyMuscleDeficits.includes(ex.muscleGroup)) score += 28;

    // Penalización ligera si hay fatiga de piernas en Garmin (48h)
    if (wellness?.lowerBodyFatigue === 'high' && ex.muscleGroup === 'Piernas') score -= 20;

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

  // Segunda pasada: completar hasta targetCount con los mejor puntuados,
  // limitando a máx. 2 compuestos axiales pesados (Ratio Estímulo-Fatiga / SFR)
  let axialCount = selected.filter((item) => LOWER_BACK_HEAVY_IDS.has(item.ex.id)).length;
  for (const item of scored) {
    if (selected.length >= targetCount) break;
    if (usedIds.has(item.ex.id)) continue;
    const isAxial = LOWER_BACK_HEAVY_IDS.has(item.ex.id);
    if (isAxial && axialCount >= 2) continue;
    const patternCount = usedPatterns.get(item.ex.pattern) || 0;
    if (patternCount >= 2) continue;
    selected.push(item);
    usedIds.add(item.ex.id);
    usedPatterns.set(item.ex.pattern, patternCount + 1);
    if (isAxial) axialCount++;
  }

  // Orden biomecánico óptimo: compuestos pesados (Tier 1) primero, aislamientos al final
  selected.sort((a, b) => a.ex.tier - b.ex.tier);

  const blocks: WorkoutExerciseBlock[] = selected.map(({ ex, expert }, idx) => {
    let sets = goal === 'strength' && ex.tier === 1 ? 4 : expert?.recommendedSets || 3;
    if (isDeload) {
      sets = Math.max(2, Math.round(sets * 0.6));
    } else if (legFatigueHigh && ex.muscleGroup === 'Piernas') {
      sets = Math.max(2, sets - 1);
    } else if (upperFatigueHigh && (ex.muscleGroup === 'Espalda' || ex.muscleGroup === 'Hombros')) {
      sets = Math.max(2, sets - 1);
    }

    const reps =
      ex.equipment === 'Peso Corporal'
        ? goal === 'strength'
          ? 8
          : ex.tier === 1
          ? 12
          : 15
        : goal === 'strength'
        ? ex.tier === 1
          ? 5
          : 8
        : expert?.defaultRepsNumber || (ex.tier === 3 ? 12 : 10);
    // Descansos basados en evidencia (Schoenfeld et al. 2016: >=150s en compuestos Tier 1; menor descanso en peso corporal)
    const baseRest =
      ex.equipment === 'Peso Corporal'
        ? ex.tier === 1
          ? 75
          : 60
        : goal === 'strength'
        ? 180
        : ex.tier === 1
        ? 150
        : expert?.recommendedRestSeconds || 75;
    const restSeconds = isDeload ? baseRest + 15 : baseRest;
    const targetRir = isDeload
      ? 'RIR 3 (Descarga)'
      : ex.tier === 1
      ? 'RIR 1-2'
      : ex.tier === 2
      ? 'RIR 1'
      : 'RIR 0-1';
    const stretchBias = STRETCH_MEDIATED_IDS.has(ex.id);

    // Peso inteligente: en peso corporal siempre 0 kg; si hay buen readiness, +2.5% en peso externo
    const known = knownWeights[ex.id];
    const progressionMultiplier = isDeload ? 1.0 : highReadiness ? 1.025 : 1.015;
    const suggested =
      ex.equipment === 'Peso Corporal'
        ? 0
        : known
        ? Math.round((known * progressionMultiplier) / 2.5) * 2.5
        : DEFAULT_WEIGHTS_BY_EQUIPMENT[ex.equipment];

    return {
      id: `smart-${Date.now()}-${idx}`,
      exercise: ex,
      sets,
      reps,
      weightKg: suggested,
      suggestedWeightKg: ex.equipment === 'Peso Corporal' ? undefined : known || undefined,
      restSeconds,
      targetRir,
      stretchBias,
    };
  });

  const cleanMusclesLabel = requestedMuscles.slice(0, 2).join('+');
  const routinePrefix = isDeload ? 'DL ' : isHome ? 'Casa ' : 'IA ';
  const routineName = `${routinePrefix}${cleanMusclesLabel}`.slice(0, 16);

  const stretchCount = blocks.filter((b) => b.stretchBias).length;
  const rationaleParts = [
    `Diseñada para ${requestedMuscles.join(', ')} en ~${targetDuration} min usando exclusivamente el equipamiento de "${effectiveProfile.gymName}" (${effectiveProfile.availableEquipment.join(', ')}).`,
    isHome
      ? effectiveProfile.environment === 'home_no_equipment'
        ? 'Rutina 100% sin material ni barra de dominadas: ejercicios de peso corporal seguros y completos para entrenar en cualquier espacio.'
        : 'Modo Casa con poco material: prioriza mancuernas versátiles y peso corporal sin requerir máquinas ni racks de gimnasio.'
      : spareLowerBack
      ? 'Se han excluido ejercicios con alta carga axial lumbar, priorizando máquinas y apoyos estables.'
      : `Orden biomecánico optimizado (Tier 1→3, máx. 2 axiales para controlar fatiga) con ${stretchCount} ejercicio(s) de máxima tensión en estiramiento.`,
    isDeload
      ? 'Modo Descarga (Deload): -40% de series manteniendo carga y trabajando a RIR 3 para disipar fatiga acumulada.'
      : Object.keys(knownWeights).length > 0
      ? 'Cargas ajustadas automáticamente (+2.5% sobrecarga progresiva) con descansos científicos (>=150s en compuestos, RIR 0-2).'
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
