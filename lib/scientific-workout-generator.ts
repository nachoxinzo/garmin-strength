import { EXERCISE_CATALOG, CatalogExercise, EquipmentType } from './exercise-catalog';
import { isExerciseAllowedForProfile, TrainingEnvironment } from './smart-workout-engine';
import { StrengthRoutine, WorkoutExerciseBlock } from './types';

export type TrainingSplit = 'ppl' | 'upper_lower' | 'full_body';
export type TrainingGoal = 'hypertrophy' | 'strength' | 'powerbuilding';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface GeneratorOptions {
  split: TrainingSplit;
  sessionDay: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body_a' | 'full_body_b';
  goal: TrainingGoal;
  level: ExperienceLevel;
  durationMinutes: 45 | 60 | 75 | 90;
  preferredEquipment?: EquipmentType[];
  environment?: TrainingEnvironment;
}

/**
 * Genera una rutina basada en evidencia científica de hipertrofia y fuerza
 * (Schoenfeld et al., 2016-2021; Helms et al. Muscle and Strength Pyramids)
 */
export function generateScientificRoutine(options: GeneratorOptions): StrengthRoutine {
  const {
    split,
    sessionDay,
    goal,
    level,
    durationMinutes,
    preferredEquipment,
    environment = 'gym',
  } = options;

  // 1. Determinar número de ejercicios según duración y nivel
  let targetExerciseCount = 5;
  if (durationMinutes === 45) targetExerciseCount = 4;
  else if (durationMinutes === 60) targetExerciseCount = 5;
  else if (durationMinutes === 75) targetExerciseCount = 6;
  else if (durationMinutes === 90) targetExerciseCount = 7;

  // 2. Parámetros de series y repeticiones según objetivo y material
  const getScheme = (tier: 1 | 2 | 3, equipment: EquipmentType) => {
    if (equipment === 'Peso Corporal') {
      if (goal === 'strength') {
        return { sets: tier === 1 ? 4 : 3, reps: 8, restSeconds: 75 };
      }
      return {
        sets: 3,
        reps: tier === 1 ? 12 : 15,
        restSeconds: tier === 1 ? 75 : 60,
      };
    }
    if (goal === 'strength') {
      if (tier === 1) return { sets: 4, reps: 5, restSeconds: 150 };
      if (tier === 2) return { sets: 3, reps: 6, restSeconds: 120 };
      return { sets: 3, reps: 8, restSeconds: 90 };
    }
    if (goal === 'powerbuilding') {
      if (tier === 1) return { sets: 4, reps: 5, restSeconds: 120 };
      if (tier === 2) return { sets: 3, reps: 8, restSeconds: 90 };
      return { sets: 3, reps: 12, restSeconds: 60 };
    }
    // Hypertrophy (por defecto)
    if (tier === 1) return { sets: 3, reps: 8, restSeconds: 90 };
    if (tier === 2) return { sets: 3, reps: 10, restSeconds: 75 };
    return { sets: 3, reps: 12, restSeconds: 60 };
  };

  // 3. Seleccionar ejercicios respetando estrictamente equipamiento y entorno (Gimnasio vs En Casa)
  const selectedExercises: CatalogExercise[] = [];
  const filterProfile = {
    availableEquipment:
      preferredEquipment && preferredEquipment.length > 0
        ? preferredEquipment
        : (['Barra', 'Mancuernas', 'Polea', 'Máquina', 'Peso Corporal'] as EquipmentType[]),
    avoidLowerBackFatigue: false,
    gymName: '',
    environment,
  };

  const allowedPool = EXERCISE_CATALOG.filter((e) =>
    isExerciseAllowedForProfile(e, filterProfile)
  );
  const workingPool = allowedPool.length > 0 ? allowedPool : EXERCISE_CATALOG;

  const pickExercise = (
    filterFn: (e: CatalogExercise) => boolean,
    fallbackMuscle?: CatalogExercise['muscleGroup']
  ) => {
    const candidates = workingPool.filter(filterFn);
    const unpicked = candidates.filter((c) => !selectedExercises.some((s) => s.id === c.id));
    if (unpicked.length > 0) {
      selectedExercises.push(unpicked[0]);
      return;
    }
    if (fallbackMuscle) {
      const sameMuscle = workingPool.filter(
        (c) =>
          c.muscleGroup === fallbackMuscle && !selectedExercises.some((s) => s.id === c.id)
      );
      if (sameMuscle.length > 0) {
        selectedExercises.push(sameMuscle[0]);
      }
    }
  };

  // --- LÓGICA DE PROGRAMACIÓN CIENTÍFICA POR SESIÓN ---
  if (sessionDay === 'push') {
    pickExercise((e) => e.pattern === 'Empuje Horizontal' && e.tier === 1, 'Pecho');
    pickExercise((e) => e.pattern === 'Empuje Vertical' && (e.tier === 1 || e.tier === 2), 'Hombros');
    pickExercise((e) => e.pattern === 'Empuje Inclinado', 'Pecho');
    pickExercise((e) => e.pattern === 'Aislamiento Deltoides', 'Hombros');
    if (targetExerciseCount >= 5) {
      pickExercise((e) => e.pattern === 'Tríceps', 'Brazos');
    }
    if (targetExerciseCount >= 6) {
      pickExercise((e) => e.pattern === 'Aislamiento Pectoral', 'Pecho');
    }
  } else if (sessionDay === 'pull') {
    pickExercise((e) => e.pattern === 'Tracción Vertical' && e.tier === 1, 'Espalda');
    pickExercise((e) => e.pattern === 'Tracción Horizontal' && e.tier === 1, 'Espalda');
    pickExercise((e) => e.pattern === 'Tracción Vertical' && e.tier === 2, 'Espalda');
    pickExercise(
      (e) => e.id === 'face_pull' || e.pattern === 'Aislamiento Deltoides',
      'Hombros'
    );
    if (targetExerciseCount >= 5) {
      pickExercise((e) => e.pattern === 'Bíceps', 'Brazos');
    }
    if (targetExerciseCount >= 6) {
      pickExercise(
        (e) => e.id === 'hammer_curl_dumbbell' || e.pattern === 'Tracción Horizontal',
        'Espalda'
      );
    }
  } else if (sessionDay === 'legs') {
    pickExercise((e) => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 1, 'Piernas');
    pickExercise((e) => e.pattern === 'Bisagra / Cadena Posterior' && e.tier === 1, 'Piernas');
    pickExercise((e) => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 2, 'Piernas');
    pickExercise(
      (e) => e.id === 'leg_curl_machine' || e.pattern === 'Bisagra / Cadena Posterior',
      'Piernas'
    );
    if (targetExerciseCount >= 5) {
      pickExercise((e) => e.pattern === 'Gemelos', 'Piernas');
    }
    if (targetExerciseCount >= 6) {
      pickExercise(
        (e) => e.id === 'leg_extension_machine' || e.pattern === 'Sentadilla / Cuádriceps',
        'Piernas'
      );
    }
  } else if (sessionDay === 'upper') {
    pickExercise((e) => e.pattern === 'Empuje Horizontal' && e.tier === 1, 'Pecho');
    pickExercise((e) => e.pattern === 'Tracción Vertical', 'Espalda');
    pickExercise(
      (e) => e.pattern === 'Empuje Inclinado' || e.pattern === 'Empuje Vertical',
      'Hombros'
    );
    pickExercise((e) => e.pattern === 'Tracción Horizontal', 'Espalda');
    if (targetExerciseCount >= 5) {
      pickExercise((e) => e.pattern === 'Bíceps', 'Brazos');
    }
    if (targetExerciseCount >= 6) {
      pickExercise((e) => e.pattern === 'Tríceps', 'Brazos');
    }
  } else if (sessionDay === 'lower') {
    pickExercise((e) => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 1, 'Piernas');
    pickExercise((e) => e.pattern === 'Bisagra / Cadena Posterior', 'Piernas');
    pickExercise((e) => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 2, 'Piernas');
    pickExercise((e) => e.pattern === 'Gemelos', 'Piernas');
    if (targetExerciseCount >= 5) {
      pickExercise((e) => e.pattern === 'Core', 'Core');
    }
  } else {
    // Full Body
    pickExercise((e) => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 1, 'Piernas');
    pickExercise((e) => e.pattern === 'Empuje Horizontal' && e.tier === 1, 'Pecho');
    pickExercise((e) => e.pattern === 'Tracción Vertical', 'Espalda');
    pickExercise((e) => e.pattern === 'Bisagra / Cadena Posterior', 'Piernas');
    if (targetExerciseCount >= 5) {
      pickExercise((e) => e.pattern === 'Empuje Vertical', 'Hombros');
    }
    if (targetExerciseCount >= 6) {
      pickExercise((e) => e.pattern === 'Core', 'Core');
    }
  }

  // Rellenar si targetExerciseCount quedó corto dentro del pool permitido
  while (selectedExercises.length < targetExerciseCount && selectedExercises.length < workingPool.length) {
    const next = workingPool.find((e) => !selectedExercises.some((s) => s.id === e.id));
    if (!next) break;
    selectedExercises.push(next);
  }

  // 4. Convertir en Bloques de Ejercicios
  const blocks: WorkoutExerciseBlock[] = selectedExercises.map((exercise, index) => {
    const scheme = getScheme(exercise.tier, exercise.equipment);
    return {
      id: `gen-block-${Date.now()}-${index}`,
      exercise,
      sets: scheme.sets,
      reps: scheme.reps,
      weightKg: 0,
      suggestedWeightKg: 0,
      restSeconds: scheme.restSeconds,
    };
  });

  const isHome = environment === 'home_minimal' || environment === 'home_no_equipment';
  const sessionTitles: Record<string, string> = {
    push: isHome ? 'Casa Empuje' : 'Empuje (Pecho/Hombro)',
    pull: isHome ? 'Casa Tirón' : 'Tirón (Espalda/Bíceps)',
    legs: isHome ? 'Casa Pierna' : 'Pierna Completa',
    upper: isHome ? 'Casa Torso' : 'Torso Completo',
    lower: isHome ? 'Casa Pierna/Core' : 'Pierna & Core',
    full_body_a: isHome ? 'Casa FullBody A' : 'Cuerpo Completo A',
    full_body_b: isHome ? 'Casa FullBody B' : 'Cuerpo Completo B',
  };

  return {
    id: `routine-sci-${Date.now()}`,
    name: sessionTitles[sessionDay] || (isHome ? 'Casa Rutina' : 'Rutina Científica'),
    warmupSeconds: 300,
    cooldownSeconds: 180,
    blocks,
  };
}
