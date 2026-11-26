import { CatalogExercise } from './exercise-catalog';

export type AnatomicalMuscleId =
  | 'chest'
  | 'upper_back'
  | 'traps'
  | 'lower_back'
  | 'abs'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export const MUSCLE_LABELS: Record<AnatomicalMuscleId, string> = {
  chest: 'Pectorales',
  upper_back: 'Dorsales / Espalda',
  traps: 'Trapecios',
  lower_back: 'Lumbares',
  abs: 'Abdomen / Core',
  shoulders: 'Deltoides',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  glutes: 'Glúteos',
  quads: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  adductors: 'Aductores',
  calves: 'Gemelos',
};

export interface ExerciseMuscleProfile {
  primary: AnatomicalMuscleId[];
  secondary: AnatomicalMuscleId[];
  /**
   * peak_at_1: contracción máxima cuando c -> 1 (ej. curl arriba, tracción al cuerpo, extensión piernas)
   * peak_at_0: contracción máxima cuando c -> 0 o retorno al bloqueo (ej. empuje desde abajo hacia arriba)
   * isometric: tensión sostenida continua (planchas)
   */
  activationMode: 'peak_at_1' | 'peak_at_0' | 'isometric';
}

const EXERCISE_MUSCLE_BY_ID: Record<string, ExerciseMuscleProfile> = {
  // PECHO
  bench_press_barbell: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' },
  bench_press_dumbbell: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' },
  chest_press_machine: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' },
  bench_press_incline_barbell: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' },
  bench_press_incline_dumbbell: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' },
  incline_chest_press_machine: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' },
  bench_press_decline_barbell: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' },
  bench_press_decline_dumbbell: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' },
  close_grip_bench_press: { primary: ['triceps', 'chest'], secondary: ['shoulders'], activationMode: 'peak_at_0' },
  cable_chest_press: { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_1' },
  flye_dumbbell: { primary: ['chest'], secondary: ['shoulders'], activationMode: 'peak_at_0' },
  incline_flye_dumbbell: { primary: ['chest'], secondary: ['shoulders'], activationMode: 'peak_at_0' },
  cable_crossover_chest: { primary: ['chest'], secondary: ['shoulders'], activationMode: 'peak_at_1' },
  pec_deck_machine: { primary: ['chest'], secondary: ['shoulders'], activationMode: 'peak_at_1' },
  dips_chest: { primary: ['chest', 'triceps'], secondary: ['shoulders'], activationMode: 'peak_at_0' },
  push_up: { primary: ['chest'], secondary: ['shoulders', 'triceps', 'abs'], activationMode: 'peak_at_0' },

  // ESPALDA
  deadlift_barbell: { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['quads', 'traps', 'forearms'], activationMode: 'peak_at_1' },
  deadlift_sumo: { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['quads', 'adductors', 'traps', 'forearms'], activationMode: 'peak_at_1' },
  deadlift_straight_leg: { primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'abs'], activationMode: 'peak_at_1' },
  romanian_deadlift_dumbbell: { primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'abs'], activationMode: 'peak_at_1' },
  rack_pull: { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['quads', 'traps', 'forearms'], activationMode: 'peak_at_1' },
  pull_up: { primary: ['upper_back'], secondary: ['biceps', 'forearms'], activationMode: 'peak_at_1' },
  chin_up: { primary: ['upper_back', 'biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  neutral_grip_pull_up: { primary: ['upper_back'], secondary: ['biceps', 'forearms'], activationMode: 'peak_at_1' },
  lat_pulldown: { primary: ['upper_back'], secondary: ['biceps', 'forearms'], activationMode: 'peak_at_1' },
  lat_pulldown_wide: { primary: ['upper_back'], secondary: ['biceps', 'forearms'], activationMode: 'peak_at_1' },
  lat_pulldown_close: { primary: ['upper_back'], secondary: ['biceps', 'forearms'], activationMode: 'peak_at_1' },
  lat_pulldown_reverse: { primary: ['upper_back', 'biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  lat_pulldown_machine: { primary: ['upper_back'], secondary: ['biceps', 'forearms'], activationMode: 'peak_at_1' },
  straight_arm_pulldown: { primary: ['upper_back'], secondary: ['triceps', 'abs'], activationMode: 'peak_at_1' },
  barbell_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'lower_back'], activationMode: 'peak_at_1' },
  pendlay_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'lower_back'], activationMode: 'peak_at_1' },
  reverse_grip_barbell_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'lower_back'], activationMode: 'peak_at_1' },
  t_bar_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'lower_back'], activationMode: 'peak_at_1' },
  dumbbell_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'lower_back'], activationMode: 'peak_at_1' },
  chest_supported_dumbbell_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'shoulders'], activationMode: 'peak_at_1' },
  seated_cable_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'lower_back'], activationMode: 'peak_at_1' },
  wide_grip_cable_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'shoulders'], activationMode: 'peak_at_1' },
  single_arm_cable_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'lower_back'], activationMode: 'peak_at_1' },
  machine_row: { primary: ['upper_back'], secondary: ['biceps', 'traps', 'shoulders'], activationMode: 'peak_at_1' },
  face_pull: { primary: ['shoulders'], secondary: ['upper_back', 'traps'], activationMode: 'peak_at_1' },
  back_extension: { primary: ['lower_back', 'glutes'], secondary: ['hamstrings'], activationMode: 'peak_at_1' },

  // PIERNAS
  squat_back_barbell: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  squat_front_barbell: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  hack_squat_machine: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'], activationMode: 'peak_at_1' },
  leg_press: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'], activationMode: 'peak_at_1' },
  goblet_squat_dumbbell: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  sumo_squat: { primary: ['quads', 'glutes', 'adductors'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  bulgarian_split_squat: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  barbell_bulgarian_split_squat: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  lunge_dumbbell: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  lunge_barbell: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  walking_lunge_dumbbell: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  step_up_dumbbell: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' },
  leg_extension_machine: { primary: ['quads'], secondary: [], activationMode: 'peak_at_1' },
  leg_curl_machine: { primary: ['hamstrings'], secondary: ['calves'], activationMode: 'peak_at_1' },
  seated_leg_curl_machine: { primary: ['hamstrings'], secondary: ['calves'], activationMode: 'peak_at_1' },
  good_morning_barbell: { primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'abs'], activationMode: 'peak_at_1' },
  hip_thrust_barbell: { primary: ['glutes'], secondary: ['hamstrings', 'abs'], activationMode: 'peak_at_1' },
  glute_bridge_barbell: { primary: ['glutes'], secondary: ['hamstrings', 'abs'], activationMode: 'peak_at_1' },
  cable_pull_through: { primary: ['glutes'], secondary: ['hamstrings', 'abs'], activationMode: 'peak_at_1' },
  hip_abduction_machine: { primary: ['glutes'], secondary: ['abs'], activationMode: 'peak_at_1' },
  hip_adduction_machine: { primary: ['adductors'], secondary: ['quads'], activationMode: 'peak_at_1' },
  calf_raise_standing: { primary: ['calves'], secondary: [], activationMode: 'peak_at_1' },
  calf_raise_seated: { primary: ['calves'], secondary: [], activationMode: 'peak_at_1' },
  calf_raise_dumbbell: { primary: ['calves'], secondary: [], activationMode: 'peak_at_1' },

  // HOMBROS
  military_press: { primary: ['shoulders'], secondary: ['triceps', 'traps', 'abs'], activationMode: 'peak_at_1' },
  overhead_barbell_press: { primary: ['shoulders'], secondary: ['triceps', 'traps', 'abs'], activationMode: 'peak_at_1' },
  seated_barbell_shoulder_press: { primary: ['shoulders'], secondary: ['triceps', 'traps', 'abs'], activationMode: 'peak_at_1' },
  dumbbell_shoulder_press: { primary: ['shoulders'], secondary: ['triceps', 'traps', 'abs'], activationMode: 'peak_at_1' },
  standing_dumbbell_shoulder_press: { primary: ['shoulders'], secondary: ['triceps', 'traps', 'abs'], activationMode: 'peak_at_1' },
  arnold_press: { primary: ['shoulders'], secondary: ['triceps', 'traps', 'abs'], activationMode: 'peak_at_1' },
  shoulder_press_machine: { primary: ['shoulders'], secondary: ['triceps', 'traps', 'abs'], activationMode: 'peak_at_1' },
  lateral_raise_dumbbell: { primary: ['shoulders'], secondary: ['traps'], activationMode: 'peak_at_1' },
  lateral_raise_cable: { primary: ['shoulders'], secondary: ['traps'], activationMode: 'peak_at_1' },
  lateral_raise_machine: { primary: ['shoulders'], secondary: ['traps'], activationMode: 'peak_at_1' },
  front_raise_dumbbell: { primary: ['shoulders'], secondary: ['traps'], activationMode: 'peak_at_1' },
  front_raise_cable: { primary: ['shoulders'], secondary: ['traps'], activationMode: 'peak_at_1' },
  rear_delt_fly_dumbbell: { primary: ['shoulders'], secondary: ['upper_back', 'traps'], activationMode: 'peak_at_1' },
  rear_delt_fly_machine: { primary: ['shoulders'], secondary: ['upper_back', 'traps'], activationMode: 'peak_at_1' },
  rear_delt_fly_cable: { primary: ['shoulders'], secondary: ['upper_back', 'traps'], activationMode: 'peak_at_1' },
  upright_row_barbell: { primary: ['shoulders', 'traps'], secondary: ['biceps'], activationMode: 'peak_at_1' },
  shrug_barbell: { primary: ['traps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  shrug_dumbbell: { primary: ['traps'], secondary: ['forearms'], activationMode: 'peak_at_1' },

  // BRAZOS
  biceps_curl_barbell: { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  biceps_curl_ez_bar: { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  biceps_curl_dumbbell: { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  incline_dumbbell_curl: { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  hammer_curl_dumbbell: { primary: ['biceps', 'forearms'], secondary: [], activationMode: 'peak_at_1' },
  preacher_curl_ez_bar: { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  preacher_curl_dumbbell: { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  concentration_curl_dumbbell: { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  cable_biceps_curl: { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' },
  cable_hammer_curl: { primary: ['biceps', 'forearms'], secondary: [], activationMode: 'peak_at_1' },
  reverse_barbell_curl: { primary: ['biceps', 'forearms'], secondary: [], activationMode: 'peak_at_1' },
  triceps_pushdown_cable: { primary: ['triceps'], secondary: ['shoulders'], activationMode: 'peak_at_1' },
  triceps_rope_pushdown: { primary: ['triceps'], secondary: ['shoulders'], activationMode: 'peak_at_1' },
  triceps_overhead_cable: { primary: ['triceps'], secondary: ['shoulders'], activationMode: 'peak_at_1' },
  triceps_overhead_dumbbell: { primary: ['triceps'], secondary: ['shoulders'], activationMode: 'peak_at_1' },
  skull_crusher_barbell: { primary: ['triceps'], secondary: ['shoulders'], activationMode: 'peak_at_1' },
  triceps_kickback_dumbbell: { primary: ['triceps'], secondary: ['shoulders'], activationMode: 'peak_at_1' },
  triceps_dip_weighted: { primary: ['triceps'], secondary: ['chest', 'shoulders'], activationMode: 'peak_at_0' },

  // CORE
  plank: { primary: ['abs'], secondary: ['lower_back', 'shoulders'], activationMode: 'isometric' },
  side_plank: { primary: ['abs'], secondary: ['lower_back', 'shoulders'], activationMode: 'isometric' },
  crunch: { primary: ['abs'], secondary: ['lower_back'], activationMode: 'peak_at_1' },
  cable_crunch: { primary: ['abs'], secondary: ['lower_back'], activationMode: 'peak_at_1' },
  bicycle_crunch: { primary: ['abs'], secondary: ['lower_back'], activationMode: 'peak_at_1' },
  hanging_leg_raise: { primary: ['abs'], secondary: ['lower_back', 'forearms'], activationMode: 'peak_at_1' },
  hanging_knee_raise: { primary: ['abs'], secondary: ['lower_back', 'forearms'], activationMode: 'peak_at_1' },
  ab_wheel_rollout: { primary: ['abs'], secondary: ['lower_back', 'shoulders'], activationMode: 'peak_at_1' },
  russian_twist: { primary: ['abs'], secondary: ['lower_back'], activationMode: 'peak_at_1' },
  cable_woodchopper: { primary: ['abs'], secondary: ['lower_back', 'shoulders'], activationMode: 'peak_at_1' },
};

export function resolveExerciseMuscles(exercise: CatalogExercise): ExerciseMuscleProfile {
  const byId = EXERCISE_MUSCLE_BY_ID[exercise.id];
  if (byId) return byId;

  switch (exercise.pattern) {
    case 'Empuje Horizontal':
    case 'Empuje Inclinado':
      return { primary: ['chest'], secondary: ['shoulders', 'triceps'], activationMode: 'peak_at_0' };
    case 'Aislamiento Pectoral':
      return { primary: ['chest'], secondary: ['shoulders'], activationMode: 'peak_at_1' };
    case 'Empuje Vertical':
      return { primary: ['shoulders'], secondary: ['triceps', 'traps', 'abs'], activationMode: 'peak_at_1' };
    case 'Tracción Horizontal':
      return { primary: ['upper_back'], secondary: ['biceps', 'traps', 'lower_back'], activationMode: 'peak_at_1' };
    case 'Tracción Vertical':
      return { primary: ['upper_back'], secondary: ['biceps', 'forearms'], activationMode: 'peak_at_1' };
    case 'Sentadilla / Cuádriceps':
      return { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'], activationMode: 'peak_at_1' };
    case 'Bisagra / Cadena Posterior':
      return { primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'abs'], activationMode: 'peak_at_1' };
    case 'Aislamiento Deltoides':
      return { primary: ['shoulders'], secondary: ['traps'], activationMode: 'peak_at_1' };
    case 'Bíceps':
      return { primary: ['biceps'], secondary: ['forearms'], activationMode: 'peak_at_1' };
    case 'Tríceps':
      return { primary: ['triceps'], secondary: ['shoulders'], activationMode: 'peak_at_1' };
    case 'Gemelos':
      return { primary: ['calves'], secondary: [], activationMode: 'peak_at_1' };
    case 'Core':
    default:
      return { primary: ['abs'], secondary: ['lower_back'], activationMode: 'peak_at_1' };
  }
}
