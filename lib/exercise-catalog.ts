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

/**
 * Catálogo oficial validado 100% contra garminconnect-js/exercises y @garmin/fitsdk
 */
export const EXERCISE_CATALOG: CatalogExercise[] = [
  // ==========================================
  // PECHO
  // ==========================================
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
    name: 'Press de banca plano con mancuernas',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'DUMBBELL_BENCH_PRESS',
    equipment: 'Mancuernas',
    pattern: 'Empuje Horizontal',
    tier: 1
  },
  {
    id: 'chest_press_machine',
    name: 'Press de pecho en máquina / Multipower',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'SMITH_MACHINE_BENCH_PRESS',
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
    name: 'Press de pecho inclinado en máquina / Multipower',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'INCLINE_SMITH_MACHINE_BENCH_PRESS',
    equipment: 'Máquina',
    pattern: 'Empuje Inclinado',
    tier: 2
  },
  {
    id: 'bench_press_decline_barbell',
    name: 'Press declinado con barra',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'DECLINE_BARBELL_BENCH_PRESS',
    equipment: 'Barra',
    pattern: 'Empuje Horizontal',
    tier: 2
  },
  {
    id: 'bench_press_decline_dumbbell',
    name: 'Press declinado con mancuernas',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'DECLINE_DUMBBELL_BENCH_PRESS',
    equipment: 'Mancuernas',
    pattern: 'Empuje Horizontal',
    tier: 2
  },
  {
    id: 'close_grip_bench_press',
    name: 'Press de banca agarre cerrado',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'CLOSE_GRIP_BARBELL_BENCH_PRESS',
    equipment: 'Barra',
    pattern: 'Empuje Horizontal',
    tier: 2
  },
  {
    id: 'cable_chest_press',
    name: 'Press de pecho en polea',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'SINGLE_ARM_CABLE_CHEST_PRESS',
    equipment: 'Polea',
    pattern: 'Empuje Horizontal',
    tier: 2
  },
  {
    id: 'flye_dumbbell',
    name: 'Aperturas planas con mancuernas',
    muscleGroup: 'Pecho',
    category: 'FLYE',
    garminName: 'DUMBBELL_FLYE',
    equipment: 'Mancuernas',
    pattern: 'Aislamiento Pectoral',
    tier: 3
  },
  {
    id: 'incline_flye_dumbbell',
    name: 'Aperturas inclinadas con mancuernas',
    muscleGroup: 'Pecho',
    category: 'FLYE',
    garminName: 'INCLINE_DUMBBELL_FLYE',
    equipment: 'Mancuernas',
    pattern: 'Aislamiento Pectoral',
    tier: 3
  },
  {
    id: 'cable_crossover_chest',
    name: 'Cruces de poleas (Cable Crossover)',
    muscleGroup: 'Pecho',
    category: 'FLYE',
    garminName: 'CABLE_CROSSOVER',
    equipment: 'Polea',
    pattern: 'Aislamiento Pectoral',
    tier: 3
  },
  {
    id: 'pec_deck_machine',
    name: 'Contractor de pecho / Pec Deck (Butterfly)',
    muscleGroup: 'Pecho',
    category: 'FLYE',
    garminName: 'CABLE_CROSSOVER',
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

  // ==========================================
  // ESPALDA
  // ==========================================
  {
    id: 'deadlift_barbell',
    name: 'Peso muerto convencional con barra',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'BARBELL_DEADLIFT',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 1
  },
  {
    id: 'deadlift_sumo',
    name: 'Peso muerto Sumo con barra',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'SUMO_DEADLIFT',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 1
  },
  {
    id: 'deadlift_straight_leg',
    name: 'Peso muerto rumano con barra (RDL)',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'ROMANIAN_DEADLIFT',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 1
  },
  {
    id: 'romanian_deadlift_dumbbell',
    name: 'Peso muerto rumano con mancuernas',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'DUMBBELL_STRAIGHT_LEG_DEADLIFT',
    equipment: 'Mancuernas',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 2
  },
  {
    id: 'rack_pull',
    name: 'Rack Pull con barra',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'RACK_PULL',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 2
  },
  {
    id: 'pull_up',
    name: 'Dominadas pronas (Pull-ups)',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'PULL_UP',
    equipment: 'Peso Corporal',
    pattern: 'Tracción Vertical',
    tier: 1
  },
  {
    id: 'chin_up',
    name: 'Dominadas supinas (Chin-ups)',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'CHIN_UP',
    equipment: 'Peso Corporal',
    pattern: 'Tracción Vertical',
    tier: 1
  },
  {
    id: 'neutral_grip_pull_up',
    name: 'Dominadas agarre neutro',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'NEUTRAL_GRIP_PULL_UP',
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
    id: 'lat_pulldown_wide',
    name: 'Jalón al pecho agarre ancho',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'WIDE_GRIP_LAT_PULLDOWN',
    equipment: 'Polea',
    pattern: 'Tracción Vertical',
    tier: 2
  },
  {
    id: 'lat_pulldown_close',
    name: 'Jalón al pecho agarre estrecho / neutro',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'CLOSE_GRIP_LAT_PULLDOWN',
    equipment: 'Polea',
    pattern: 'Tracción Vertical',
    tier: 2
  },
  {
    id: 'lat_pulldown_reverse',
    name: 'Jalón al pecho agarre supino',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'REVERSE_GRIP_PULLDOWN',
    equipment: 'Polea',
    pattern: 'Tracción Vertical',
    tier: 2
  },
  {
    id: 'lat_pulldown_machine',
    name: 'Jalón vertical en máquina divergente / Iso-Lateral',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'LAT_PULLDOWN',
    equipment: 'Máquina',
    pattern: 'Tracción Vertical',
    tier: 2
  },
  {
    id: 'straight_arm_pulldown',
    name: 'Pullover en polea alta con brazos rectos',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'STRAIGHT_ARM_PULLDOWN',
    equipment: 'Polea',
    pattern: 'Tracción Vertical',
    tier: 3
  },
  {
    id: 'barbell_row',
    name: 'Remo con barra inclinado (90°)',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'BARBELL_ROW',
    equipment: 'Barra',
    pattern: 'Tracción Horizontal',
    tier: 1
  },
  {
    id: 'pendlay_row',
    name: 'Remo Pendlay con barra',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'BENT_OVER_ROW_WITH_BARBELL',
    equipment: 'Barra',
    pattern: 'Tracción Horizontal',
    tier: 1
  },
  {
    id: 'reverse_grip_barbell_row',
    name: 'Remo con barra agarre supino (Yates Row)',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'REVERSE_GRIP_BARBELL_ROW',
    equipment: 'Barra',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 't_bar_row',
    name: 'Remo en punta / Barra T (T-Bar Row)',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'T_BAR_ROW',
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
    id: 'chest_supported_dumbbell_row',
    name: 'Remo con mancuernas pecho apoyado en banco',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'CHEST_SUPPORTED_DUMBBELL_ROW',
    equipment: 'Mancuernas',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 'seated_cable_row',
    name: 'Remo sentado en polea baja (Gironda)',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'SEATED_CABLE_ROW',
    equipment: 'Polea',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 'wide_grip_cable_row',
    name: 'Remo sentado en polea agarre ancho',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'WIDE_GRIP_SEATED_CABLE_ROW',
    equipment: 'Polea',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 'single_arm_cable_row',
    name: 'Remo unilateral en polea',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'SINGLE_ARM_CABLE_ROW',
    equipment: 'Polea',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 'machine_row',
    name: 'Remo en máquina con apoyo de pecho / Iso-Lateral',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'WEIGHTED_ROW',
    equipment: 'Máquina',
    pattern: 'Tracción Horizontal',
    tier: 2
  },
  {
    id: 'face_pull',
    name: 'Face Pull en polea alta',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'FACE_PULL',
    equipment: 'Polea',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'back_extension',
    name: 'Hiperextensiones lumbares (Back Extension)',
    muscleGroup: 'Espalda',
    category: 'HYPEREXTENSION',
    garminName: 'SPINE_EXTENSION',
    equipment: 'Peso Corporal',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 3
  },

  // ==========================================
  // PIERNAS
  // ==========================================
  {
    id: 'squat_back_barbell',
    name: 'Sentadilla trasera con barra (Back Squat)',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'BARBELL_BACK_SQUAT',
    equipment: 'Barra',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 1
  },
  {
    id: 'squat_front_barbell',
    name: 'Sentadilla frontal con barra (Front Squat)',
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
    garminName: 'BARBELL_HACK_SQUAT',
    equipment: 'Máquina',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 1
  },
  {
    id: 'leg_press',
    name: 'Prensa de piernas inclinada (Leg Press)',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'LEG_PRESS',
    equipment: 'Máquina',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'goblet_squat_dumbbell',
    name: 'Sentadilla Goblet con mancuerna / pesa rusa',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'GOBLET_SQUAT',
    equipment: 'Mancuernas',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'sumo_squat',
    name: 'Sentadilla Sumo',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'SUMO_SQUAT',
    equipment: 'Mancuernas',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Sentadilla búlgara con mancuernas',
    muscleGroup: 'Piernas',
    category: 'LUNGE',
    garminName: 'DUMBBELL_BULGARIAN_SPLIT_SQUAT',
    equipment: 'Mancuernas',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'barbell_bulgarian_split_squat',
    name: 'Sentadilla búlgara con barra / Multipower',
    muscleGroup: 'Piernas',
    category: 'LUNGE',
    garminName: 'BARBELL_BULGARIAN_SPLIT_SQUAT',
    equipment: 'Barra',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
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
    id: 'lunge_barbell',
    name: 'Zancadas con barra',
    muscleGroup: 'Piernas',
    category: 'LUNGE',
    garminName: 'BARBELL_LUNGE',
    equipment: 'Barra',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'walking_lunge_dumbbell',
    name: 'Zancadas caminando con mancuernas',
    muscleGroup: 'Piernas',
    category: 'LUNGE',
    garminName: 'WALKING_DUMBBELL_LUNGE',
    equipment: 'Mancuernas',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'step_up_dumbbell',
    name: 'Subida al cajón con mancuernas (Step-Up)',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'DUMBBELL_STEP_UP',
    equipment: 'Mancuernas',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 2
  },
  {
    id: 'leg_extension_machine',
    name: 'Extensión de cuádriceps en máquina',
    muscleGroup: 'Piernas',
    category: 'BANDED_EXERCISES',
    garminName: 'LEG_EXTENSION',
    equipment: 'Máquina',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 3
  },
  {
    id: 'leg_curl_machine',
    name: 'Curl femoral tumbado en máquina',
    muscleGroup: 'Piernas',
    category: 'LEG_CURL',
    garminName: 'WEIGHTED_LEG_CURL',
    equipment: 'Máquina',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 3
  },
  {
    id: 'seated_leg_curl_machine',
    name: 'Curl femoral sentado en máquina',
    muscleGroup: 'Piernas',
    category: 'LEG_CURL',
    garminName: 'LEG_CURL',
    equipment: 'Máquina',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 3
  },
  {
    id: 'good_morning_barbell',
    name: 'Buenos días con barra (Good Morning)',
    muscleGroup: 'Piernas',
    category: 'LEG_CURL',
    garminName: 'BAR_GOOD_MORNING',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 2
  },
  {
    id: 'hip_thrust_barbell',
    name: 'Hip Thrust con barra en banco (Glúteo)',
    muscleGroup: 'Piernas',
    category: 'HIP_RAISE',
    garminName: 'BARBELL_HIP_THRUST_WITH_BENCH',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 1
  },
  {
    id: 'glute_bridge_barbell',
    name: 'Puente de glúteo con barra en suelo',
    muscleGroup: 'Piernas',
    category: 'HIP_RAISE',
    garminName: 'BARBELL_HIP_THRUST_ON_FLOOR',
    equipment: 'Barra',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 2
  },
  {
    id: 'cable_pull_through',
    name: 'Pull Through de glúteo en polea baja',
    muscleGroup: 'Piernas',
    category: 'CHOP',
    garminName: 'CABLE_PULL_THROUGH',
    equipment: 'Polea',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 3
  },
  {
    id: 'hip_abduction_machine',
    name: 'Abducción de cadera / Glúteo en máquina',
    muscleGroup: 'Piernas',
    category: 'HIP_STABILITY',
    garminName: 'WEIGHTED_STANDING_HIP_ABDUCTION',
    equipment: 'Máquina',
    pattern: 'Bisagra / Cadena Posterior',
    tier: 3
  },
  {
    id: 'hip_adduction_machine',
    name: 'Aducción de cadera (Aductores) en máquina',
    muscleGroup: 'Piernas',
    category: 'HIP_STABILITY',
    garminName: 'WEIGHTED_STANDING_ADDUCTION',
    equipment: 'Máquina',
    pattern: 'Sentadilla / Cuádriceps',
    tier: 3
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
    name: 'Elevación de talones sentado en máquina',
    muscleGroup: 'Piernas',
    category: 'CALF_RAISE',
    garminName: 'SEATED_CALF_RAISE',
    equipment: 'Máquina',
    pattern: 'Gemelos',
    tier: 3
  },
  {
    id: 'calf_raise_dumbbell',
    name: 'Elevación de talones con mancuernas',
    muscleGroup: 'Piernas',
    category: 'CALF_RAISE',
    garminName: 'STANDING_DUMBBELL_CALF_RAISE',
    equipment: 'Mancuernas',
    pattern: 'Gemelos',
    tier: 3
  },

  // ==========================================
  // HOMBROS
  // ==========================================
  {
    id: 'military_press',
    name: 'Press militar de pie con barra (OHP)',
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
    id: 'seated_barbell_shoulder_press',
    name: 'Press de hombros sentado con barra',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'SEATED_BARBELL_SHOULDER_PRESS',
    equipment: 'Barra',
    pattern: 'Empuje Vertical',
    tier: 1
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Press de hombros sentado con mancuernas',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'SEATED_DUMBBELL_SHOULDER_PRESS',
    equipment: 'Mancuernas',
    pattern: 'Empuje Vertical',
    tier: 2
  },
  {
    id: 'standing_dumbbell_shoulder_press',
    name: 'Press de hombros de pie con mancuernas',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'DUMBBELL_SHOULDER_PRESS',
    equipment: 'Mancuernas',
    pattern: 'Empuje Vertical',
    tier: 2
  },
  {
    id: 'arnold_press',
    name: 'Press Arnold con mancuernas',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'ARNOLD_PRESS',
    equipment: 'Mancuernas',
    pattern: 'Empuje Vertical',
    tier: 2
  },
  {
    id: 'shoulder_press_machine',
    name: 'Press de hombros en máquina / Multipower',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'SMITH_MACHINE_OVERHEAD_PRESS',
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
    garminName: 'ONE_ARM_CABLE_LATERAL_RAISE',
    equipment: 'Polea',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'lateral_raise_machine',
    name: 'Elevaciones laterales sentado / en máquina',
    muscleGroup: 'Hombros',
    category: 'LATERAL_RAISE',
    garminName: 'SEATED_LATERAL_RAISE',
    equipment: 'Máquina',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'front_raise_dumbbell',
    name: 'Elevaciones frontales con mancuernas',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'DUMBBELL_FRONT_RAISE',
    equipment: 'Mancuernas',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'front_raise_cable',
    name: 'Elevaciones frontales en polea',
    muscleGroup: 'Hombros',
    category: 'LATERAL_RAISE',
    garminName: 'CABLE_FRONT_RAISE',
    equipment: 'Polea',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'rear_delt_fly_dumbbell',
    name: 'Pájaros con mancuernas (Deltoides posterior)',
    muscleGroup: 'Hombros',
    category: 'LATERAL_RAISE',
    garminName: 'BENT_OVER_LATERAL_RAISE',
    equipment: 'Mancuernas',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'rear_delt_fly_machine',
    name: 'Deltoides posterior en máquina / Contractor inverso',
    muscleGroup: 'Hombros',
    category: 'FLYE',
    garminName: 'INCLINE_REVERSE_FLYE',
    equipment: 'Máquina',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'rear_delt_fly_cable',
    name: 'Cruces inversos en polea (Deltoides posterior)',
    muscleGroup: 'Hombros',
    category: 'FLYE',
    garminName: 'SINGLE_ARM_STANDING_CABLE_REVERSE_FLYE',
    equipment: 'Polea',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'upright_row_barbell',
    name: 'Remo al mentón con barra',
    muscleGroup: 'Hombros',
    category: 'SHRUG',
    garminName: 'BARBELL_UPRIGHT_ROW',
    equipment: 'Barra',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'shrug_barbell',
    name: 'Encogimientos de trapecio con barra (Shrugs)',
    muscleGroup: 'Hombros',
    category: 'SHRUG',
    garminName: 'BARBELL_SHRUG',
    equipment: 'Barra',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },
  {
    id: 'shrug_dumbbell',
    name: 'Encogimientos de trapecio con mancuernas',
    muscleGroup: 'Hombros',
    category: 'SHRUG',
    garminName: 'DUMBBELL_SHRUG',
    equipment: 'Mancuernas',
    pattern: 'Aislamiento Deltoides',
    tier: 3
  },

  // ==========================================
  // BRAZOS (BÍCEPS & TRÍCEPS)
  // ==========================================
  {
    id: 'biceps_curl_barbell',
    name: 'Curl de bíceps con barra recta',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'BARBELL_BICEPS_CURL',
    equipment: 'Barra',
    pattern: 'Bíceps',
    tier: 2
  },
  {
    id: 'biceps_curl_ez_bar',
    name: 'Curl de bíceps con barra Z',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'STANDING_EZ_BAR_BICEPS_CURL',
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
    id: 'incline_dumbbell_curl',
    name: 'Curl de bíceps en banco inclinado con mancuernas',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'INCLINE_DUMBBELL_BICEPS_CURL',
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
    id: 'preacher_curl_ez_bar',
    name: 'Curl predicador (Banco Scott) con barra Z',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'EZ_BAR_PREACHER_CURL',
    equipment: 'Barra',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'preacher_curl_dumbbell',
    name: 'Curl predicador a una mano / en máquina',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'ONE_ARM_PREACHER_CURL',
    equipment: 'Mancuernas',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'concentration_curl_dumbbell',
    name: 'Curl concentrado con mancuerna',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'ONE_ARM_CONCENTRATION_CURL',
    equipment: 'Mancuernas',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'cable_biceps_curl',
    name: 'Curl de bíceps en polea baja',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'CABLE_BICEPS_CURL',
    equipment: 'Polea',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'cable_hammer_curl',
    name: 'Curl martillo en polea con cuerda',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'CABLE_HAMMER_CURL',
    equipment: 'Polea',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'reverse_barbell_curl',
    name: 'Curl de bíceps agarre inverso (Antebrazo)',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'REVERSE_EZ_BAR_CURL',
    equipment: 'Barra',
    pattern: 'Bíceps',
    tier: 3
  },
  {
    id: 'triceps_pushdown_cable',
    name: 'Extensión de tríceps en polea con barra',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'TRICEPS_PRESSDOWN',
    equipment: 'Polea',
    pattern: 'Tríceps',
    tier: 3
  },
  {
    id: 'triceps_rope_pushdown',
    name: 'Extensión de tríceps en polea con cuerda',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'ROPE_PRESSDOWN',
    equipment: 'Polea',
    pattern: 'Tríceps',
    tier: 3
  },
  {
    id: 'triceps_overhead_cable',
    name: 'Extensión de tríceps tras nuca en polea',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'CABLE_OVERHEAD_TRICEPS_EXTENSION',
    equipment: 'Polea',
    pattern: 'Tríceps',
    tier: 3
  },
  {
    id: 'triceps_overhead_dumbbell',
    name: 'Extensión de tríceps tras nuca con mancuerna',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'OVERHEAD_DUMBBELL_TRICEPS_EXTENSION',
    equipment: 'Mancuernas',
    pattern: 'Tríceps',
    tier: 3
  },
  {
    id: 'skull_crusher_barbell',
    name: 'Press francés / Rompecráneos con barra Z',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'LYING_EZ_BAR_TRICEPS_EXTENSION',
    equipment: 'Barra',
    pattern: 'Tríceps',
    tier: 2
  },
  {
    id: 'triceps_kickback_dumbbell',
    name: 'Patada de tríceps con mancuerna / polea',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'DUMBBELL_KICKBACK',
    equipment: 'Mancuernas',
    pattern: 'Tríceps',
    tier: 3
  },
  {
    id: 'triceps_dip_weighted',
    name: 'Fondos para tríceps',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'WEIGHTED_DIP',
    equipment: 'Peso Corporal',
    pattern: 'Tríceps',
    tier: 2
  },

  // ==========================================
  // CORE / ABDOMEN
  // ==========================================
  {
    id: 'plank',
    name: 'Plancha abdominal isométrica (Plank)',
    muscleGroup: 'Core',
    category: 'PLANK',
    garminName: 'PLANK',
    equipment: 'Peso Corporal',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'side_plank',
    name: 'Plancha lateral (Side Plank)',
    muscleGroup: 'Core',
    category: 'PLANK',
    garminName: 'SIDE_PLANK',
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
    id: 'cable_crunch',
    name: 'Crunch abdominal en polea alta',
    muscleGroup: 'Core',
    category: 'CRUNCH',
    garminName: 'KNEELING_CABLE_CRUNCH',
    equipment: 'Polea',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'bicycle_crunch',
    name: 'Crunch bicicleta (Oblicuos)',
    muscleGroup: 'Core',
    category: 'CRUNCH',
    garminName: 'BICYCLE_CRUNCH',
    equipment: 'Peso Corporal',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'hanging_leg_raise',
    name: 'Elevación de piernas colgado en barra',
    muscleGroup: 'Core',
    category: 'LEG_RAISE',
    garminName: 'HANGING_LEG_RAISE',
    equipment: 'Peso Corporal',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'hanging_knee_raise',
    name: 'Elevación de rodillas colgado',
    muscleGroup: 'Core',
    category: 'LEG_RAISE',
    garminName: 'HANGING_KNEE_RAISE',
    equipment: 'Peso Corporal',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'ab_wheel_rollout',
    name: 'Rueda abdominal (Ab Wheel Rollout)',
    muscleGroup: 'Core',
    category: 'CORE',
    garminName: 'KNEELING_AB_WHEEL',
    equipment: 'Peso Corporal',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'russian_twist',
    name: 'Giros rusos (Russian Twist)',
    muscleGroup: 'Core',
    category: 'CORE',
    garminName: 'RUSSIAN_TWIST',
    equipment: 'Peso Corporal',
    pattern: 'Core',
    tier: 3
  },
  {
    id: 'cable_woodchopper',
    name: 'Giros oblicuos en polea (Woodchopper)',
    muscleGroup: 'Core',
    category: 'CHOP',
    garminName: 'CABLE_WOODCHOP',
    equipment: 'Polea',
    pattern: 'Core',
    tier: 3
  }
];
