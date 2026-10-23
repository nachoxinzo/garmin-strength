import { EXERCISE_CATALOG, CatalogExercise, EquipmentType, MovementPattern } from './exercise-catalog';

export interface ExerciseAlternative {
  exercise: CatalogExercise;
  matchScore: number; // 0 a 100
  reason: string;
  recommendedWeightKg?: number;
}

/**
 * Obtener ejercicios biomecánicamente equivalentes cuando una máquina no existe o está ocupada
 */
export function getSimilarExercises(
  sourceExerciseId: string,
  currentWeightKg: number = 0,
  filterEquipment?: EquipmentType
): ExerciseAlternative[] {
  const source = EXERCISE_CATALOG.find(e => e.id === sourceExerciseId);
  if (!source) return [];

  const alternatives: ExerciseAlternative[] = [];

  for (const candidate of EXERCISE_CATALOG) {
    if (candidate.id === source.id) continue;

    // Filtro opcional por equipamiento
    if (filterEquipment && candidate.equipment !== filterEquipment) continue;

    let score = 0;
    let reason = '';

    // Coincidencia exacta de patrón de movimiento (ej: Tracción Vertical, Sentadilla)
    if (candidate.pattern === source.pattern) {
      score += 70;
      reason = `Mismo patrón motor (${source.pattern})`;
    } else if (candidate.muscleGroup === source.muscleGroup) {
      score += 40;
      reason = `Mismo grupo muscular principal (${source.muscleGroup})`;
    } else {
      continue; // No es relevante
    }

    // Nivel de intensidad / Tier (compuesto pesado vs aislamiento)
    if (candidate.tier === source.tier) {
      score += 20;
    } else if (Math.abs(candidate.tier - source.tier) === 1) {
      score += 10;
    }

    // Variedad de equipamiento (si la máquina está ocupada, premiar alternativas en peso libre/polea)
    if (source.equipment === 'Máquina' && candidate.equipment !== 'Máquina') {
      score += 10;
    }

    // Estimación de peso sugerido según equipamiento
    const convertedWeight = convertWeightForEquipment(
      currentWeightKg,
      source.equipment,
      candidate.equipment
    );

    alternatives.push({
      exercise: candidate,
      matchScore: Math.min(100, score),
      reason,
      recommendedWeightKg: convertedWeight
    });
  }

  // Ordenar por afinidad
  return alternatives.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Convierte el peso de forma lógica al cambiar de equipamiento
 * (Ej: Barra de 80kg -> Mancuernas de ~35kg cada una; Máquina a Peso libre)
 */
export function convertWeightForEquipment(
  weightKg: number,
  sourceEquip: EquipmentType,
  targetEquip: EquipmentType
): number {
  if (weightKg <= 0) return 0;
  if (sourceEquip === targetEquip) return weightKg;

  let converted = weightKg;

  // De Barra a Mancuernas (dividir entre 2 y descontar ~10% por estabilizadores)
  if (sourceEquip === 'Barra' && targetEquip === 'Mancuernas') {
    converted = (weightKg / 2) * 0.9;
  }
  // De Mancuernas a Barra (multiplicar por 2 y sumar ~10%)
  else if (sourceEquip === 'Mancuernas' && targetEquip === 'Barra') {
    converted = weightKg * 2 * 1.1;
  }
  // De Máquina a Peso Libre (las máquinas guían el movimiento y usan poleas desmultiplicadoras)
  else if (sourceEquip === 'Máquina' && (targetEquip === 'Barra' || targetEquip === 'Mancuernas')) {
    converted = targetEquip === 'Barra' ? weightKg * 0.85 : (weightKg * 0.85) / 2;
  }
  // De Peso Libre a Máquina
  else if ((sourceEquip === 'Barra' || sourceEquip === 'Mancuernas') && targetEquip === 'Máquina') {
    converted = sourceEquip === 'Barra' ? weightKg * 1.15 : weightKg * 2 * 1.15;
  }
  // Peso corporal
  else if (targetEquip === 'Peso Corporal') {
    return 0;
  }

  // Redondear a múltiplos de 2.5 kg o 1 kg
  return Math.max(0, Math.round(converted / 2.5) * 2.5);
}
