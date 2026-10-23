import { EXERCISE_CATALOG, CatalogExercise, EquipmentType } from './exercise-catalog';
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
}

/**
 * Genera una rutina basada en evidencia científica de hipertrofia y fuerza
 * (Schoenfeld et al., 2016-2021; Helms et al. Muscle and Strength Pyramids)
 */
export function generateScientificRoutine(options: GeneratorOptions): StrengthRoutine {
  const { split, sessionDay, goal, level, durationMinutes, preferredEquipment } = options;

  // 1. Determinar número de ejercicios según duración y nivel
  let targetExerciseCount = 5;
  if (durationMinutes === 45) targetExerciseCount = 4;
  else if (durationMinutes === 60) targetExerciseCount = 5;
  else if (durationMinutes === 75) targetExerciseCount = 6;
  else if (durationMinutes === 90) targetExerciseCount = 7;

  // 2. Parámetros de series y repeticiones según objetivo
  const getScheme = (tier: 1 | 2 | 3) => {
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

  // 3. Seleccionar ejercicios según la sesión
  const selectedExercises: CatalogExercise[] = [];

  const filterByEquipment = (exercises: CatalogExercise[]) => {
    if (!preferredEquipment || preferredEquipment.length === 0) return exercises;
    const filtered = exercises.filter(e => preferredEquipment.includes(e.equipment));
    return filtered.length > 0 ? filtered : exercises;
  };

  const pickExercise = (filterFn: (e: CatalogExercise) => boolean) => {
    const candidates = filterByEquipment(EXERCISE_CATALOG.filter(filterFn));
    const unpicked = candidates.filter(c => !selectedExercises.some(s => s.id === c.id));
    if (unpicked.length > 0) {
      selectedExercises.push(unpicked[0]);
    }
  };

  // --- LÓGICA DE PROGRAMACIÓN CIENTÍFICA POR SESIÓN ---
  if (sessionDay === 'push') {
    // 1. Compuesto Pesado Pecho
    pickExercise(e => e.pattern === 'Empuje Horizontal' && e.tier === 1);
    // 2. Compuesto Pesado Hombro
    pickExercise(e => e.pattern === 'Empuje Vertical' && (e.tier === 1 || e.tier === 2));
    // 3. Compuesto Inclinado / Pecho Secundario
    pickExercise(e => e.pattern === 'Empuje Inclinado');
    // 4. Aislamiento Deltoides Lateral (Crucial para anchura clavicular)
    pickExercise(e => e.pattern === 'Aislamiento Deltoides');
    // 5. Tríceps (Extensión)
    if (targetExerciseCount >= 5) {
      pickExercise(e => e.pattern === 'Tríceps');
    }
    // 6. Aislamiento Pectoral (Aperturas / Cruces en estiramiento)
    if (targetExerciseCount >= 6) {
      pickExercise(e => e.pattern === 'Aislamiento Pectoral');
    }
  } else if (sessionDay === 'pull') {
    // 1. Tracción Vertical Pesada (Dorsal ancho)
    pickExercise(e => e.pattern === 'Tracción Vertical' && e.tier === 1);
    // 2. Tracción Horizontal Pesada (Grosor de espalda)
    pickExercise(e => e.pattern === 'Tracción Horizontal' && e.tier === 1);
    // 3. Tracción Vertical Secundaria / Jalón
    pickExercise(e => e.pattern === 'Tracción Vertical' && e.tier === 2);
    // 4. Deltoides Posterior / Trapecios (Face Pull)
    pickExercise(e => e.id === 'face_pull' || e.pattern === 'Aislamiento Deltoides');
    // 5. Bíceps (Flexión de codo)
    if (targetExerciseCount >= 5) {
      pickExercise(e => e.pattern === 'Bíceps');
    }
    // 6. Remo de aislamiento o Bíceps martillo
    if (targetExerciseCount >= 6) {
      pickExercise(e => e.id === 'hammer_curl_dumbbell' || e.pattern === 'Tracción Horizontal');
    }
  } else if (sessionDay === 'legs') {
    // 1. Sentadilla / Cuádriceps Pesado
    pickExercise(e => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 1);
    // 2. Bisagra de Cadera / Isquiosurales Pesado (Peso muerto / Hip Thrust)
    pickExercise(e => e.pattern === 'Bisagra / Cadena Posterior' && e.tier === 1);
    // 3. Cuádriceps Secundario (Prensa o Búlgara)
    pickExercise(e => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 2);
    // 4. Isquiosurales Aislamiento (Curl femoral)
    pickExercise(e => e.id === 'leg_curl_machine' || e.pattern === 'Bisagra / Cadena Posterior');
    // 5. Gemelos
    if (targetExerciseCount >= 5) {
      pickExercise(e => e.pattern === 'Gemelos');
    }
    // 6. Extensión de cuádriceps
    if (targetExerciseCount >= 6) {
      pickExercise(e => e.id === 'leg_extension_machine');
    }
  } else if (sessionDay === 'upper') {
    // 1. Empuje Horizontal
    pickExercise(e => e.pattern === 'Empuje Horizontal' && e.tier === 1);
    // 2. Tracción Vertical
    pickExercise(e => e.pattern === 'Tracción Vertical');
    // 3. Empuje Inclinado o Vertical
    pickExercise(e => e.pattern === 'Empuje Inclinado' || e.pattern === 'Empuje Vertical');
    // 4. Tracción Horizontal
    pickExercise(e => e.pattern === 'Tracción Horizontal');
    // 5. Brazos (Bíceps o Tríceps)
    if (targetExerciseCount >= 5) {
      pickExercise(e => e.pattern === 'Bíceps');
    }
    if (targetExerciseCount >= 6) {
      pickExercise(e => e.pattern === 'Tríceps');
    }
  } else if (sessionDay === 'lower') {
    // 1. Sentadilla Pesada
    pickExercise(e => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 1);
    // 2. Peso Muerto Rumano / Isquios
    pickExercise(e => e.pattern === 'Bisagra / Cadena Posterior');
    // 3. Prensa / Unilateral
    pickExercise(e => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 2);
    // 4. Gemelos
    pickExercise(e => e.pattern === 'Gemelos');
    // 5. Core
    if (targetExerciseCount >= 5) {
      pickExercise(e => e.pattern === 'Core');
    }
  } else {
    // Full Body
    pickExercise(e => e.pattern === 'Sentadilla / Cuádriceps' && e.tier === 1);
    pickExercise(e => e.pattern === 'Empuje Horizontal' && e.tier === 1);
    pickExercise(e => e.pattern === 'Tracción Vertical');
    pickExercise(e => e.pattern === 'Bisagra / Cadena Posterior');
    if (targetExerciseCount >= 5) {
      pickExercise(e => e.pattern === 'Empuje Vertical');
    }
    if (targetExerciseCount >= 6) {
      pickExercise(e => e.pattern === 'Core');
    }
  }

  // 4. Convertir en Bloques de Ejercicios
  const blocks: WorkoutExerciseBlock[] = selectedExercises.map((exercise, index) => {
    const scheme = getScheme(exercise.tier);
    return {
      id: `gen-block-${Date.now()}-${index}`,
      exercise,
      sets: scheme.sets,
      reps: scheme.reps,
      weightKg: 0, // 0 para que el usuario o el sugeridor de Hevy asigne el peso real
      suggestedWeightKg: 0,
      restSeconds: scheme.restSeconds
    };
  });

  const sessionTitles: Record<string, string> = {
    push: 'Empuje (Pecho/Hombro)',
    pull: 'Tirón (Espalda/Bíceps)',
    legs: 'Pierna Completa',
    upper: 'Torso Completo',
    lower: 'Pierna & Core',
    full_body_a: 'Cuerpo Completo A',
    full_body_b: 'Cuerpo Completo B'
  };

  return {
    id: `routine-sci-${Date.now()}`,
    name: sessionTitles[sessionDay] || 'Rutina Científica',
    warmupSeconds: 300,
    cooldownSeconds: 180,
    blocks
  };
}
