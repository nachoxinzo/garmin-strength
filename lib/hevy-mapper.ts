import { EXERCISE_CATALOG, CatalogExercise } from './exercise-catalog';

function findById(id: string): CatalogExercise {
  return EXERCISE_CATALOG.find((e) => e.id === id) || EXERCISE_CATALOG[0];
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Mapea cualquier nombre de ejercicio de Hevy (Inglés o Español, API o CSV)
 * al ejercicio equivalente validado en el catálogo oficial de Garmin Connect.
 */
export function mapHevyToGarminCatalog(hevyName: string): CatalogExercise {
  if (!hevyName || !hevyName.trim()) {
    return EXERCISE_CATALOG[0];
  }

  const n = normalizeText(hevyName);

  // Detectar equipamiento explícito en el título de Hevy (ej. "(Dumbbell)", "(Machine)", "(Cable)")
  const isDumbbell =
    n.includes('dumbbell') || n.includes('mancuerna') || n.includes('db ') || n.includes('(db)');
  const isCable =
    n.includes('cable') || n.includes('polea') || n.includes('rope') || n.includes('cuerda');
  const isMachine =
    n.includes('machine') ||
    n.includes('maquina') ||
    n.includes('smith') ||
    n.includes('multipower') ||
    n.includes('leverage') ||
    n.includes('iso-lateral') ||
    n.includes('isolateral');
  const isEZBar = n.includes('ez bar') || n.includes('ez-bar') || n.includes('barra z');

  // 0. Coincidencia directa con algún nombre o ID del catálogo
  const exactCatalog = EXERCISE_CATALOG.find(
    (e) => normalizeText(e.name) === n || normalizeText(e.id) === n
  );
  if (exactCatalog) return exactCatalog;

  // ==========================================
  // 1. PECHO
  // ==========================================
  if (
    n.includes('pec deck') ||
    n.includes('butterfly') ||
    n.includes('contractor') ||
    ((n.includes('fly') || n.includes('apertura')) && isMachine)
  ) {
    return findById('pec_deck_machine');
  }
  if (
    n.includes('crossover') ||
    n.includes('cruce') ||
    ((n.includes('fly') || n.includes('apertura')) && isCable)
  ) {
    return findById('cable_crossover_chest');
  }
  if ((n.includes('fly') || n.includes('apertura')) && (n.includes('incline') || n.includes('inclinad'))) {
    return findById('incline_flye_dumbbell');
  }
  if ((n.includes('fly') || n.includes('apertura')) && !n.includes('rear') && !n.includes('reverse') && !n.includes('inverso') && !n.includes('posterior')) {
    return findById('flye_dumbbell');
  }
  if (
    (n.includes('bench press') || n.includes('chest press') || n.includes('press de banca') || n.includes('press banca') || n.includes('press de pecho') || n.includes('press inclinado') || n.includes('incline press')) &&
    (n.includes('incline') || n.includes('inclinad'))
  ) {
    if (isMachine) return findById('incline_chest_press_machine');
    if (isDumbbell) return findById('bench_press_incline_dumbbell');
    return findById('bench_press_incline_barbell');
  }
  if (
    (n.includes('bench press') || n.includes('chest press') || n.includes('press de banca') || n.includes('press declinado')) &&
    (n.includes('decline') || n.includes('declinad'))
  ) {
    if (isDumbbell) return findById('bench_press_decline_dumbbell');
    return findById('bench_press_decline_barbell');
  }
  if (
    (n.includes('bench press') || n.includes('press de banca') || n.includes('press banca')) &&
    (n.includes('close grip') || n.includes('agarre cerrado') || n.includes('estrecho'))
  ) {
    return findById('close_grip_bench_press');
  }
  if (
    n.includes('bench press') ||
    n.includes('chest press') ||
    n.includes('press de banca') ||
    n.includes('press banca') ||
    n.includes('press de pecho') ||
    n.includes('press plano')
  ) {
    if (isCable) return findById('cable_chest_press');
    if (isMachine) return findById('chest_press_machine');
    if (isDumbbell) return findById('bench_press_dumbbell');
    return findById('bench_press_barbell');
  }
  if (n.includes('push up') || n.includes('push-up') || n.includes('pushup') || n.includes('flexion')) {
    return findById('push_up');
  }
  if ((n.includes('dip') || n.includes('fondo')) && (n.includes('chest') || n.includes('pecho') || n.includes('paralela'))) {
    return findById('dips_chest');
  }

  // ==========================================
  // 2. ESPALDA
  // ==========================================
  if (n.includes('face pull') || n.includes('facepull')) {
    return findById('face_pull');
  }
  if (
    (n.includes('straight arm') || n.includes('brazos rectos') || n.includes('pullover') || n.includes('pull-over')) &&
    (isCable || n.includes('pulldown') || n.includes('jalon'))
  ) {
    return findById('straight_arm_pulldown');
  }
  if (n.includes('pulldown') || n.includes('pull down') || n.includes('pull-down') || n.includes('jalon')) {
    if (isMachine) return findById('lat_pulldown_machine');
    if (n.includes('reverse') || n.includes('underhand') || n.includes('supin')) return findById('lat_pulldown_reverse');
    if (n.includes('close') || n.includes('narrow') || n.includes('estrecho') || n.includes('neutro') || n.includes('v-bar')) {
      return findById('lat_pulldown_close');
    }
    if (n.includes('wide') || n.includes('ancho')) return findById('lat_pulldown_wide');
    return findById('lat_pulldown');
  }
  if (n.includes('chin up') || n.includes('chin-up') || n.includes('chinup') || (n.includes('dominada') && n.includes('supin'))) {
    return findById('chin_up');
  }
  if (n.includes('pull up') || n.includes('pull-up') || n.includes('pullup') || n.includes('dominada')) {
    if (n.includes('neutral') || n.includes('neutro')) return findById('neutral_grip_pull_up');
    return findById('pull_up');
  }
  if (
    n.includes('romanian deadlift') ||
    n.includes('rdl') ||
    n.includes('stiff leg') ||
    n.includes('straight leg deadlift') ||
    n.includes('peso muerto rumano') ||
    n.includes('piernas rigidas')
  ) {
    if (isDumbbell) return findById('romanian_deadlift_dumbbell');
    return findById('deadlift_straight_leg');
  }
  if (n.includes('sumo deadlift') || n.includes('peso muerto sumo')) {
    return findById('deadlift_sumo');
  }
  if (n.includes('rack pull')) {
    return findById('rack_pull');
  }
  if (n.includes('deadlift') || n.includes('peso muerto')) {
    return findById('deadlift_barbell');
  }
  if (n.includes('t-bar row') || n.includes('t bar row') || n.includes('remo en punta') || n.includes('barra t')) {
    return findById('t_bar_row');
  }
  if (n.includes('pendlay')) {
    return findById('pendlay_row');
  }
  if (n.includes('upright row') || n.includes('remo al menton') || n.includes('remo al cuello')) {
    return findById('upright_row_barbell');
  }
  if (n.includes('row') || n.includes('remo')) {
    if (isCable || n.includes('gironda')) {
      if (n.includes('single arm') || n.includes('one arm') || n.includes('una mano') || n.includes('unilateral')) {
        return findById('single_arm_cable_row');
      }
      if (n.includes('wide') || n.includes('ancho')) return findById('wide_grip_cable_row');
      return findById('seated_cable_row');
    }
    if (isMachine) return findById('machine_row');
    if (isDumbbell) {
      if (n.includes('chest supported') || n.includes('incline') || n.includes('pecho apoyado')) {
        return findById('chest_supported_dumbbell_row');
      }
      return findById('dumbbell_row');
    }
    if (n.includes('reverse') || n.includes('underhand') || n.includes('supin') || n.includes('yates')) {
      return findById('reverse_grip_barbell_row');
    }
    return findById('barbell_row');
  }
  if (n.includes('back extension') || n.includes('hyperextension') || n.includes('hiperextension') || n.includes('lumbar')) {
    return findById('back_extension');
  }

  // ==========================================
  // 3. PIERNAS Y GLÚTEO
  // ==========================================
  if (n.includes('hip thrust') || n.includes('empuje de cadera')) {
    return findById('hip_thrust_barbell');
  }
  if (n.includes('glute bridge') || n.includes('puente de gluteo')) {
    return findById('glute_bridge_barbell');
  }
  if (n.includes('pull through') || n.includes('pull-through')) {
    return findById('cable_pull_through');
  }
  if (n.includes('abduction') || n.includes('abduccion') || n.includes('abductor')) {
    return findById('hip_abduction_machine');
  }
  if (n.includes('adduction') || n.includes('aduccion') || n.includes('aductor')) {
    return findById('hip_adduction_machine');
  }
  if (n.includes('leg press') || n.includes('prensa')) {
    return findById('leg_press');
  }
  if (n.includes('hack squat') || n.includes('sentadilla hack') || n.includes('jaca')) {
    return findById('hack_squat_machine');
  }
  if (n.includes('bulgarian') || n.includes('bulgara')) {
    if (n.includes('barbell') || n.includes('barra') || isMachine) {
      return findById('barbell_bulgarian_split_squat');
    }
    return findById('bulgarian_split_squat');
  }
  if (n.includes('goblet')) {
    return findById('goblet_squat_dumbbell');
  }
  if (n.includes('front squat') || n.includes('sentadilla frontal')) {
    return findById('squat_front_barbell');
  }
  if (n.includes('sumo squat') || n.includes('sentadilla sumo')) {
    return findById('sumo_squat');
  }
  if (n.includes('leg extension') || n.includes('extension de cuadriceps') || n.includes('extension de pierna') || n.includes('cuadriceps en maquina')) {
    return findById('leg_extension_machine');
  }
  if (n.includes('leg curl') || n.includes('hamstring curl') || n.includes('curl femoral') || n.includes('isquio')) {
    if (n.includes('seated') || n.includes('sentado')) {
      return findById('seated_leg_curl_machine');
    }
    return findById('leg_curl_machine');
  }
  if (n.includes('good morning') || n.includes('buenos dias')) {
    return findById('good_morning_barbell');
  }
  if (n.includes('step up') || n.includes('step-up') || n.includes('subida al cajon')) {
    return findById('step_up_dumbbell');
  }
  if (n.includes('lunge') || n.includes('zancada') || n.includes('split squat')) {
    if (n.includes('walking') || n.includes('caminando')) return findById('walking_lunge_dumbbell');
    if (n.includes('barbell') || n.includes('barra')) return findById('lunge_barbell');
    return findById('lunge_dumbbell');
  }
  if (n.includes('squat') || n.includes('sentadilla')) {
    if (isDumbbell) return findById('goblet_squat_dumbbell');
    return findById('squat_back_barbell');
  }
  if (n.includes('calf') || n.includes('gemelo') || n.includes('talon') || n.includes('soleo')) {
    if (n.includes('seated') || n.includes('sentado') || n.includes('soleo')) {
      return findById('calf_raise_seated');
    }
    if (isDumbbell) return findById('calf_raise_dumbbell');
    return findById('calf_raise_standing');
  }

  // ==========================================
  // 4. HOMBROS
  // ==========================================
  if (n.includes('arnold')) {
    return findById('arnold_press');
  }
  if (
    n.includes('rear delt') ||
    n.includes('reverse fly') ||
    n.includes('pajaro') ||
    n.includes('deltoides posterior') ||
    n.includes('contractor inverso') ||
    n.includes('peck deck inverso')
  ) {
    if (isMachine) return findById('rear_delt_fly_machine');
    if (isCable) return findById('rear_delt_fly_cable');
    return findById('rear_delt_fly_dumbbell');
  }
  if (n.includes('lateral raise') || n.includes('elevaciones laterales') || n.includes('elevacion lateral') || n.includes('vuelos laterales')) {
    if (isCable) return findById('lateral_raise_cable');
    if (isMachine) return findById('lateral_raise_machine');
    return findById('lateral_raise_dumbbell');
  }
  if (n.includes('front raise') || n.includes('elevaciones frontales') || n.includes('elevacion frontal')) {
    if (isCable) return findById('front_raise_cable');
    return findById('front_raise_dumbbell');
  }
  if (n.includes('shrug') || n.includes('encogimiento') || n.includes('trapecio')) {
    if (isDumbbell) return findById('shrug_dumbbell');
    return findById('shrug_barbell');
  }
  if (
    n.includes('shoulder press') ||
    n.includes('overhead press') ||
    n.includes('military press') ||
    n.includes('ohp') ||
    n.includes('press militar') ||
    n.includes('press de hombro') ||
    n.includes('press hombro')
  ) {
    if (isMachine) return findById('shoulder_press_machine');
    if (isDumbbell) {
      if (n.includes('standing') || n.includes('de pie')) return findById('standing_dumbbell_shoulder_press');
      return findById('dumbbell_shoulder_press');
    }
    if (n.includes('seated') || n.includes('sentado')) return findById('seated_barbell_shoulder_press');
    return findById('military_press');
  }

  // ==========================================
  // 5. BRAZOS (BÍCEPS Y TRÍCEPS)
  // ==========================================
  if (n.includes('skullcrusher') || n.includes('skull crusher') || n.includes('press frances') || n.includes('rompecraneos') || (n.includes('lying') && n.includes('tricep'))) {
    return findById('skull_crusher_barbell');
  }
  if (n.includes('kickback') || n.includes('patada de tricep')) {
    return findById('triceps_kickback_dumbbell');
  }
  if (
    (n.includes('tricep') || n.includes('extension')) &&
    (n.includes('overhead') || n.includes('tras nuca') || n.includes('por encima'))
  ) {
    if (isCable) return findById('triceps_overhead_cable');
    return findById('triceps_overhead_dumbbell');
  }
  if (n.includes('pushdown') || n.includes('pressdown') || n.includes('tricep') || n.includes('triceps')) {
    if (n.includes('dip') || n.includes('fondo')) return findById('triceps_dip_weighted');
    if (n.includes('rope') || n.includes('cuerda')) return findById('triceps_rope_pushdown');
    if (isDumbbell) return findById('triceps_overhead_dumbbell');
    return findById('triceps_pushdown_cable');
  }
  if (n.includes('dip') || n.includes('fondo')) {
    return findById('triceps_dip_weighted');
  }
  if (n.includes('preacher') || n.includes('predicador') || n.includes('scott')) {
    if (isDumbbell || isMachine) return findById('preacher_curl_dumbbell');
    return findById('preacher_curl_ez_bar');
  }
  if (n.includes('concentration curl') || n.includes('curl concentrado')) {
    return findById('concentration_curl_dumbbell');
  }
  if (n.includes('hammer curl') || n.includes('curl martillo')) {
    if (isCable) return findById('cable_hammer_curl');
    return findById('hammer_curl_dumbbell');
  }
  if (n.includes('incline curl') || n.includes('incline dumbbell curl') || (n.includes('curl') && n.includes('inclinad'))) {
    return findById('incline_dumbbell_curl');
  }
  if (n.includes('reverse curl') || n.includes('curl inverso')) {
    return findById('reverse_barbell_curl');
  }
  if (n.includes('curl') || n.includes('bicep')) {
    if (isCable) return findById('cable_biceps_curl');
    if (isEZBar) return findById('biceps_curl_ez_bar');
    if (isDumbbell) return findById('biceps_curl_dumbbell');
    return findById('biceps_curl_barbell');
  }

  // ==========================================
  // 6. CORE / ABDOMEN
  // ==========================================
  if (n.includes('woodchop') || n.includes('lenador') || n.includes('oblicuo en polea')) {
    return findById('cable_woodchopper');
  }
  if (n.includes('ab wheel') || n.includes('rollout') || n.includes('rueda abdominal')) {
    return findById('ab_wheel_rollout');
  }
  if (n.includes('russian twist') || n.includes('giro ruso') || n.includes('giros rusos')) {
    return findById('russian_twist');
  }
  if (n.includes('hanging') || n.includes('colgado') || n.includes('leg raise') || n.includes('elevacion de piernas') || n.includes('knee raise') || n.includes('elevacion de rodillas')) {
    if (n.includes('knee') || n.includes('rodilla')) return findById('hanging_knee_raise');
    return findById('hanging_leg_raise');
  }
  if (n.includes('plank') || n.includes('plancha')) {
    if (n.includes('side') || n.includes('lateral')) return findById('side_plank');
    return findById('plank');
  }
  if (n.includes('crunch') || n.includes('abdominal') || n.includes('sit up') || n.includes('sit-up')) {
    if (isCable) return findById('cable_crunch');
    if (n.includes('bicycle') || n.includes('bicicleta')) return findById('bicycle_crunch');
    return findById('crunch');
  }

  // ==========================================
  // 7. FALLBACK INTELIGENTE CONSERVANDO EL NOMBRE ORIGINAL DE HEVY
  // ==========================================
  const fallbackBase = findById('bench_press_dumbbell');
  return {
    ...fallbackBase,
    id: `custom_${n.replace(/[^a-z0-9]+/g, '_').slice(0, 32)}`,
    name: hevyName.trim()
  };
}

// Alias de compatibilidad
export const matchHevyExerciseToGarmin = mapHevyToGarminCatalog;
