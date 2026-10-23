import { EXERCISE_CATALOG, CatalogExercise } from './exercise-catalog';

// Normaliza texto eliminando acentos, paréntesis y pasando a minúsculas
function cleanText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mapea de forma inteligente un nombre de ejercicio de Hevy al catálogo verificado de Garmin
 */
export function matchHevyExerciseToGarmin(hevyTitle: string): CatalogExercise {
  const clean = cleanText(hevyTitle);

  // 1. Mapeos directos por patrones comunes de Hevy
  if (clean.includes('incline') && clean.includes('dumbbell')) {
    return findCatalog('bench_press_incline_dumbbell');
  }
  if (clean.includes('incline') && (clean.includes('barbell') || clean.includes('bench'))) {
    return findCatalog('bench_press_incline_barbell');
  }
  if (clean.includes('bench press') && clean.includes('dumbbell')) {
    return findCatalog('bench_press_dumbbell');
  }
  if (clean.includes('bench press') || (clean.includes('press') && clean.includes('banca'))) {
    return findCatalog('bench_press_barbell');
  }
  if (clean.includes('fly') || clean.includes('apertura')) {
    return findCatalog('flye_dumbbell');
  }
  if (clean.includes('dip') || clean.includes('fondo')) {
    return findCatalog('dips_chest');
  }

  // Piernas
  if (clean.includes('front squat') || clean.includes('sentadilla frontal')) {
    return findCatalog('squat_front_barbell');
  }
  if (clean.includes('squat') || clean.includes('sentadilla')) {
    return findCatalog('squat_back_barbell');
  }
  if (clean.includes('leg press') || clean.includes('prensa')) {
    return findCatalog('leg_press');
  }
  if (clean.includes('lunge') || clean.includes('zancada')) {
    return findCatalog('lunge_dumbbell');
  }
  if (clean.includes('calf') || clean.includes('gemelo') || clean.includes('talon')) {
    return findCatalog('calf_raise_standing');
  }

  // Espalda
  if (clean.includes('romanian') || clean.includes('stiff') || clean.includes('rumano')) {
    return findCatalog('deadlift_straight_leg');
  }
  if (clean.includes('deadlift') || clean.includes('peso muerto')) {
    return findCatalog('deadlift_barbell');
  }
  if (clean.includes('chin up') || clean.includes('pull up') || clean.includes('dominada')) {
    return findCatalog('pull_up');
  }
  if (clean.includes('lat pulldown') || clean.includes('jalon')) {
    return findCatalog('lat_pulldown');
  }
  if (clean.includes('face pull')) {
    return findCatalog('face_pull');
  }
  if (clean.includes('row') || clean.includes('remo')) {
    return findCatalog('dumbbell_row');
  }

  // Hombros
  if (clean.includes('lateral raise') || clean.includes('elevacion lateral')) {
    return findCatalog('lateral_raise_dumbbell');
  }
  if (clean.includes('military press') || clean.includes('militar')) {
    return findCatalog('military_press');
  }
  if (clean.includes('overhead') || clean.includes('shoulder press')) {
    if (clean.includes('dumbbell')) {
      return findCatalog('dumbbell_shoulder_press');
    }
    return findCatalog('overhead_barbell_press');
  }

  // Brazos
  if (clean.includes('hammer') || clean.includes('martillo')) {
    return findCatalog('hammer_curl_dumbbell');
  }
  if (clean.includes('curl')) {
    if (clean.includes('cable') || clean.includes('polea')) {
      return findCatalog('cable_biceps_curl');
    }
    if (clean.includes('dumbbell') || clean.includes('mancuerna')) {
      return findCatalog('biceps_curl_dumbbell');
    }
    return findCatalog('biceps_curl_barbell');
  }

  // Core
  if (clean.includes('plank') || clean.includes('plancha')) {
    return findCatalog('plank');
  }
  if (clean.includes('crunch') || clean.includes('abdominal')) {
    return findCatalog('crunch');
  }

  // Fallback: buscar coincidencia parcial con el catálogo
  const fallback = EXERCISE_CATALOG.find(ex => {
    const exClean = cleanText(ex.name);
    return clean.includes(exClean) || exClean.includes(clean);
  });

  return fallback || EXERCISE_CATALOG[0]; // Retorna press de banca por defecto si no hay coincidencia
}

function findCatalog(id: string): CatalogExercise {
  return EXERCISE_CATALOG.find(e => e.id === id) || EXERCISE_CATALOG[0];
}
