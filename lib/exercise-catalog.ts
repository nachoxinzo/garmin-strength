export type MuscleGroup = 'Pecho' | 'Espalda' | 'Piernas' | 'Hombros' | 'Brazos' | 'Core';
export type EquipmentType = 'Barra' | 'Mancuernas' | 'Polea' | 'Máquina' | 'Peso Corporal';
export type MovementPattern = 
  | 'Empuje Horizontal'
  | 'Empuje Inclinado'
  | 'Empuje Vertical'
  | 'Tracción Horizontal'
  | 'Tracción Vertical'
  | 'Sentadilla / Cuádriceps'
  | 'Bisagra / Cadena Posterior'
  | 'Aislamiento Deltoides'
  | 'Aislamiento Pectoral'
  | 'Bíceps'
  | 'Tríceps'
  | 'Core'
  | 'Gemelos';

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  category: string;
  garminName: string;
  equipment: EquipmentType;
  pattern: MovementPattern;
  tier: 1 | 2 | 3; // 1: Compuesto pesado principal, 2: Compuesto secundario, 3: Aislamiento / Accesorios
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // --- PECHO ---
  {
    id: 'bench_press_barbell',
    name: 'Press de banca plano con barra',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'BARBELL_BENCH_PRESS',
    equipment: 'Barra',
    pattern: 'Empuje Horizontal',
    tier: 1
  },
  {
    id: 'bench_press_dumbbell',
    name: 'Press plano con mancuernas',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'DUMBBELL_BENCH_PRESS',
    equipment: 'Mancuernas',
    pattern: 'Empuje Horizontal',
    tier: 1
  },
  {
    id: 'chest_press_machine',
    name: 'Press de pecho en máquina',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'CHEST_PRESS',
    equipment: 'Máquina',
    pattern: 'Empuje Horizontal',
    tier: 2
  },
  {
    id: 'bench_press_incline_barbell',
    name: 'Press inclinado con barra',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'INCLINE_BARBELL_BENCH_PRESS',
    equipment: 'Barra',
    pattern: 'Empuje Inclinado',
    tier: 1
  },
  {
    id: 'bench_press_incline_dumbbell',
    name: 'Press inclinado con mancuernas',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'INCLINE_DUMBBELL_BENCH_PRESS',
    equipment: 'Mancuernas',
    pattern: 'Empuje Inclinado',
    tier: 2
  },
  {
    id: 'incline_chest_press_machine',
    name: 'Press de pecho inclinado en máquina',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'INCLINE_CHEST_PRESS',
    equipment: 'Máquina',
    pattern: 'Empuje Inclinado',
    tier: 2
  },
  {
    id: 'flye_dumbbell',
    name: 'Aperturas con mancuernas',
    muscleGroup: 'Pecho',
    category: 'FLYE',
    garminName: 'DUMBBELL_FLYE',
    equipment: 'Mancuernas',
    pattern: 'Aislamiento Pectoral',
    tier: 3
  },
  {
    id: 'cable_crossover_chest',
    name: 'Cruces de poleas en polea alta/media',
    muscleGroup: 'Pecho',
    category: 'FLYE',
    garminName: 'CABLE_CROSSOVER',
    equipment: 'Polea',
    pattern: 'Aislamiento Pectoral',
    tier: 3
  },
  {
    id: 'pec_deck_machine',
    name: 'Contractor de pecho / Pec Deck',
    muscleGroup: 'Pecho',
    category: 'FLYE',
    garminName: 'PEC_DECK',
    equipment: 'Máquina',
    pattern: 'Aislamiento Pectoral',
    tier: 3
  },
  {
    id: 'dips_chest',
    name: 'Fondos en paralelas (Dips)',
    muscleGroup: 'Pecho',
    category: 'TRICEPS_EXTENSION',
    garminName: 'BODY_WEIGHT_DIP',
    equipment: 'Peso Corporal',
    pattern: 'Empuje Horizontal',
    tier: 2
  },
  {
    id: 'push_up',
    name: 'Flexiones de brazos (Push-ups)',
    muscleGroup: 'Pecho',
    category: 'PUSH_UP',
    garminName: 'PUSH_UP',
    equipment: 'Peso Corporal',
    pattern: 'Empuje Horizontal',
    tier: 3
  },

  // --- ESPALDA ---
  {
    id: 'deadlift_barbell',
    name: 'Peso muerto convencional',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'BARBELL_DEADLIFT',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 1
  },
  {
    id: 'deadlift_straight_leg',
    name: 'Peso muerto rumano / piernas rígidas',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'BARBELL_STRAIGHT_LEG_DEADLIFT',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 1
  },
  {
    id: 'pull_up',
    name: 'Dominadas en barra (Pull-ups)',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'PULL_UP',
    equipment: 'Peso Corporal',
    pattern: 'Tracción Vertical',
    tier: 1
  },
  {
    id: 'lat_pulldown',
    name: 'Jalón al pecho en polea alta',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'LAT_PULLDOWN',
    equipment: 'Polea',
    pattern: 'Tracción Vertical',
    tier: 2
  },
  {
    id: 'lat_pulldown_machine',
    name: 'Jalón vertical en máquina divergente',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'LEVERAGE_HIGH_ROW',
    equipment: 'Máquina',
    pattern: 'Tracción Vertical',
    tier: 2
  },
  {
    id: 'barbell_row',
    name: 'Remo con barra inclinado (Pendlay / 90°)',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'BARBELL_ROW',
    equipment: 'Barra',
    pattern: 'Tracción Horizontal',
    tier: 1
  },
  {
    id: 'dumbbell_row',
    name: 'Remo con mancuerna a una mano',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'DUMBBELL_ROW',
    equipment: 'Mancuernas',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 'seated_cable_row',
    name: 'Remo sentado en polea baja',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'SEATED_CABLE_ROW',
    equipment: 'Polea',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 'machine_row',
    name: 'Remo en máquina con apoyo de pecho',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'MACHINE_ROW',
    equipment: 'Máquina',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 'face_pull',
    name: 'Face Pull en polea',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'FACE_PULL',
    equipment: 'Polea',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },

  // --- PIERNAS ---
  {
    id: 'squat_back_barbell',
    name: 'Sentadilla trasera con barra',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'BARBELL_BACK_SQUAT',
    equipment: 'Barra',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 1
  },
  {
    id: 'squat_front_barbell',
    name: 'Sentadilla frontal con barra',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'BARBELL_FRONT_SQUAT',
    equipment: 'Barra',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 1
  },
  {
    id: 'hack_squat_machine',
    name: 'Sentadilla Hack en máquina',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'HACK_SQUAT',
    equipment: 'Máquina',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 1
  },
  {
    id: 'leg_press',
    name: 'Prensa inclinada de piernas',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'LEG_PRESS',
    equipment: 'Máquina',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'goblet_squat_dumbbell',
    name: 'Sentadilla Goblet con mancuerna',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'GOBLET_SQUAT',
    equipment: 'Mancuernas',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Sentadilla búlgara con mancuernas',
    muscleGroup: 'Piernas',
    category: 'LUNGE',
    garminName: 'BULGARIAN_SPLIT_SQUAT',
    equipment: 'Mancuernas',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'leg_extension_machine',
    name: 'Extensión de cuádriceps en máquina',
    muscleGroup: 'Piernas',
    category: 'LEG_CURL',
    garminName: 'LEG_EXTENSION',
    equipment: 'Máquina',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 3
  },
  {
    id: 'leg_curl_machine',
    name: 'Curl femoral tumbado/sentado en máquina',
    muscleGroup: 'Piernas',
    category: 'LEG_CURL',
    garminName: 'LEG_CURL',
    equipment: 'Máquina',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 3
  },
  {
    id: 'hip_thrust_barbell',
    name: 'Hip Thrust con barra (Glúteo)',
    muscleGroup: 'Piernas',
    category: 'HIP_THRUST',
    garminName: 'BARBELL_HIP_THRUST',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 1
  },
  {
    id: 'lunge_dumbbell',
    name: 'Zancadas con mancuernas (Lunges)',
    muscleGroup: 'Piernas',
    category: 'LUNGE',
    garminName: 'DUMBBELL_LUNGE',
    equipment: 'Mancuernas',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'calf_raise_standing',
    name: 'Elevación de talones de pie (Gemelos)',
    muscleGroup: 'Piernas',
    category: 'CALF_RAISE',
    garminName: 'STANDING_CALF_RAISE',
    equipment: 'Máquina',
    pattern: 'Gemelos',
    tier: 3
  },
  {
    id: 'calf_raise_seated',
    name: 'Elevación de talones sentado',
    muscleGroup: 'Piernas',
    category: 'CALF_RAISE',
    garminName: 'SEATED_CALF_RAISE',
    equipment: 'Máquina',
    pattern: 'Gemelos',
    tier: 3
  },

  // --- HOMBROS ---
  {
    id: 'military_press',
    name: 'Press militar de pie con barra',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'MILITARY_PRESS',
    equipment: 'Barra',
    pattern: 'Empuje Vertical',
    tier: 1
  },
  {
    id: 'overhead_barbell_press',
    name: 'Press de hombros con barra',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'OVERHEAD_BARBELL_PRESS',
    equipment: 'Barra',
    pattern: 'Empuje Vertical',
    tier: 1
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Press de hombros sentado con mancuernas',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'DUMBBELL_SHOULDER_PRESS',
    equipment: 'Mancuernas',
    pattern: 'Empuje Vertical',
    tier: 2
  },
  {
    id: 'shoulder_press_machine',
    name: 'Press de hombros en máquina',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'LEVERAGE_SHOULDER_PRESS',
    equipment: 'Máquina',
    pattern: 'Empuje Vertical',
    tier: 2
  },
  {
    id: 'lateral_raise_dumbbell',
    name: 'Elevaciones laterales con mancuernas',
    muscleGroup: 'Hombros',
    category: 'LATERAL_RAISE',
    garminName: 'DUMBBELL_LATERAL_RAISE',
    equipment: 'Mancuernas',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'lateral_raise_cable',
    name: 'Elevaciones laterales en polea baja',
    muscleGroup: 'Hombros',
    category: 'LATERAL_RAISE',
    garminName: 'CABLE_LATERAL_RAISE',
    equipment: 'Polea',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },

  // --- BRAZOS ---
  {
    id: 'biceps_curl_barbell',
    name: 'Curl de bíceps con barra',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'BARBELL_BICEPS_CURL',
    equipment: 'Barra',
    pattern: 'Bíceps',
    tier: 2
  },
  {
    id: 'biceps_curl_dumbbell',
    name: 'Curl de bíceps con mancuernas',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'DUMBBELL_BICEPS_CURL',
    equipment: 'Mancuernas',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'hammer_curl_dumbbell',
    name: 'Curl martillo con mancuernas',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'DUMBBELL_HAMMER_CURL',
    equipment: 'Mancuernas',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'cable_biceps_curl',
    name: 'Curl de bíceps en polea',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'CABLE_BICEPS_CURL',
    equipment: 'Polea',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'triceps_pushdown_cable',
    name: 'Extensión de tríceps en polea (Cuerda/Barra)',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'CABLE_TRICEPS_PUSHDOWN',
    equipment: 'Polea',
    pattern: 'Tríceps',
    tier: 3
  },
  {
    id: 'triceps_dip_weighted',
    name: 'Fondos para tríceps',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'BODY_WEIGHT_DIP',
    equipment: 'Peso Corporal',
    pattern: 'Tríceps',
    tier: 2
  },
  {
    id: 'skull_crusher_barbell',
    name: 'Press francés / Rompecráneos con barra Z',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'BARBELL_SKULL_CRUSHER',
    equipment: 'Barra',
    pattern: 'Tríceps',
    tier: 3
  },

  // --- CORE ---
  {
    id: 'plank',
    name: 'Plancha isométrica abdominal',
    muscleGroup: 'Core',
    category: 'PLANK',
    garminName: 'PLANK',
    equipment: 'Peso Corporal',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'crunch',
    name: 'Encogimientos abdominales (Crunch)',
    muscleGroup: 'Core',
    category: 'CRUNCH',
    garminName: 'CRUNCH',
    equipment: 'Peso Corporal',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'cable_woodchopper',
    name: 'Giros oblicuos en polea (Woodchopper)',
    muscleGroup: 'Core',
    category: 'CHOP',
    garminName: 'CABLE_WOODCHOPPER',
    equipment: 'Polea',
    pattern: 'Core',
    tier: 3
  }
];
