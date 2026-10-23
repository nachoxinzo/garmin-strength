export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: 'Pecho' | 'Espalda' | 'Piernas' | 'Hombros' | 'Brazos' | 'Core';
  category: string;
  garminName: string;
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // --- PECHO ---
  {
    id: 'bench_press_barbell',
    name: 'Press de banca plano con barra',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'BARBELL_BENCH_PRESS',
  },
  {
    id: 'bench_press_incline_barbell',
    name: 'Press de banca inclinado con barra',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'INCLINE_BARBELL_BENCH_PRESS',
  },
  {
    id: 'bench_press_dumbbell',
    name: 'Press con mancuernas en banco plano',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'DUMBBELL_BENCH_PRESS',
  },
  {
    id: 'bench_press_incline_dumbbell',
    name: 'Press inclinado con mancuernas',
    muscleGroup: 'Pecho',
    category: 'BENCH_PRESS',
    garminName: 'INCLINE_DUMBBELL_BENCH_PRESS',
  },
  {
    id: 'flye_dumbbell',
    name: 'Aperturas con mancuernas',
    muscleGroup: 'Pecho',
    category: 'FLYE',
    garminName: 'DUMBBELL_FLYE',
  },
  {
    id: 'dips_chest',
    name: 'Fondos en paralelas (Dips)',
    muscleGroup: 'Pecho',
    category: 'TRICEPS_EXTENSION',
    garminName: 'BODY_WEIGHT_DIP',
  },

  // --- ESPALDA ---
  {
    id: 'deadlift_barbell',
    name: 'Peso muerto convencional',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'BARBELL_DEADLIFT',
  },
  {
    id: 'deadlift_straight_leg',
    name: 'Peso muerto rumano / piernas rígidas',
    muscleGroup: 'Espalda',
    category: 'DEADLIFT',
    garminName: 'BARBELL_STRAIGHT_LEG_DEADLIFT',
  },
  {
    id: 'pull_up',
    name: 'Dominadas en barra (Pull-ups)',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'PULL_UP',
  },
  {
    id: 'lat_pulldown',
    name: 'Jalón al pecho en polea alta',
    muscleGroup: 'Espalda',
    category: 'PULL_UP',
    garminName: 'LAT_PULLDOWN',
  },
  {
    id: 'dumbbell_row',
    name: 'Remo con mancuerna a una mano',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'DUMBBELL_ROW',
  },
  {
    id: 'face_pull',
    name: 'Face Pull en polea',
    muscleGroup: 'Espalda',
    category: 'ROW',
    garminName: 'FACE_PULL',
  },

  // --- PIERNAS ---
  {
    id: 'squat_back_barbell',
    name: 'Sentadilla trasera con barra',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'BARBELL_BACK_SQUAT',
  },
  {
    id: 'squat_front_barbell',
    name: 'Sentadilla frontal con barra',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'BARBELL_FRONT_SQUAT',
  },
  {
    id: 'leg_press',
    name: 'Prensa inclinada de piernas',
    muscleGroup: 'Piernas',
    category: 'SQUAT',
    garminName: 'LEG_PRESS',
  },
  {
    id: 'lunge_dumbbell',
    name: 'Zancadas con mancuernas (Lunges)',
    muscleGroup: 'Piernas',
    category: 'LUNGE',
    garminName: 'DUMBBELL_LUNGE',
  },
  {
    id: 'calf_raise_standing',
    name: 'Elevación de talones de pie (Gemelos)',
    muscleGroup: 'Piernas',
    category: 'CALF_RAISE',
    garminName: 'STANDING_CALF_RAISE',
  },

  // --- HOMBROS ---
  {
    id: 'military_press',
    name: 'Press militar de pie con barra',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'MILITARY_PRESS',
  },
  {
    id: 'overhead_barbell_press',
    name: 'Press de hombros por encima de la cabeza',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'OVERHEAD_BARBELL_PRESS',
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Press de hombros sentado con mancuernas',
    muscleGroup: 'Hombros',
    category: 'SHOULDER_PRESS',
    garminName: 'DUMBBELL_SHOULDER_PRESS',
  },
  {
    id: 'lateral_raise_dumbbell',
    name: 'Elevaciones laterales con mancuernas',
    muscleGroup: 'Hombros',
    category: 'LATERAL_RAISE',
    garminName: 'DUMBBELL_LATERAL_RAISE',
  },

  // --- BRAZOS ---
  {
    id: 'biceps_curl_barbell',
    name: 'Curl de bíceps con barra',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'BARBELL_BICEPS_CURL',
  },
  {
    id: 'biceps_curl_dumbbell',
    name: 'Curl de bíceps con mancuernas',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'DUMBBELL_BICEPS_CURL',
  },
  {
    id: 'hammer_curl_dumbbell',
    name: 'Curl martillo con mancuernas',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'DUMBBELL_HAMMER_CURL',
  },
  {
    id: 'cable_biceps_curl',
    name: 'Curl de bíceps en polea',
    muscleGroup: 'Brazos',
    category: 'CURL',
    garminName: 'CABLE_BICEPS_CURL',
  },
  {
    id: 'triceps_dip_weighted',
    name: 'Fondos para tríceps',
    muscleGroup: 'Brazos',
    category: 'TRICEPS_EXTENSION',
    garminName: 'BODY_WEIGHT_DIP',
  },

  // --- CORE ---
  {
    id: 'plank',
    name: 'Plancha isométrica abdominal',
    muscleGroup: 'Core',
    category: 'PLANK',
    garminName: 'PLANK',
  },
  {
    id: 'crunch',
    name: 'Encogimientos abdominales (Crunch)',
    muscleGroup: 'Core',
    category: 'CRUNCH',
    garminName: 'CRUNCH',
  },
];
