export interface WarmupRampSet {
  weightKg: number;
  reps: number;
  label: string;
}

function roundTo2_5(kg: number): number {
  return Math.max(0, Math.round(kg / 2.5) * 2.5);
}

/**
 * Calcula una rampa científica de series de aproximación antes de la carga efectiva,
 * optimizando la potenciación post-activación (PAP) sin generar fatiga previa.
 */
export function generateWarmupRamp(
  targetWeightKg: number,
  isBarbell: boolean
): WarmupRampSet[] {
  if (targetWeightKg < 25) return [];

  const ramp: WarmupRampSet[] = [];
  const baseBar = isBarbell ? 20 : roundTo2_5(targetWeightKg * 0.45);

  // Serie 1: Activación ligera (~45-50% o barra vacía)
  ramp.push({
    weightKg: baseBar,
    reps: 8,
    label: isBarbell ? 'Barra vacía' : '50% aprox.',
  });

  // Serie 2: Aproximación media (~70%)
  const midWeight = roundTo2_5(targetWeightKg * 0.7);
  if (midWeight > baseBar && midWeight < targetWeightKg) {
    ramp.push({
      weightKg: midWeight,
      reps: 4,
      label: '70% aprox.',
    });
  }

  // Serie 3: Potenciación (~85%) si la carga es alta (>= 60 kg)
  if (targetWeightKg >= 60) {
    const highWeight = roundTo2_5(targetWeightKg * 0.85);
    if (highWeight > midWeight && highWeight < targetWeightKg) {
      ramp.push({
        weightKg: highWeight,
        reps: 2,
        label: '85% PAP',
      });
    }
  }

  return ramp;
}

/**
 * Calcula 1 única serie óptima de calentamiento (~65-70% a 5 reps, o barra vacía en cargas ligeras)
 * para activar sin generar fatiga previa.
 */
export function generateSingleWarmupSet(
  targetWeightKg: number,
  isBarbell: boolean
): WarmupRampSet | null {
  if (targetWeightKg < 25) return null;

  if (isBarbell && targetWeightKg <= 35) {
    return {
      weightKg: 20,
      reps: 6,
      label: 'Barra vacía',
    };
  }

  const raw = roundTo2_5(targetWeightKg * 0.68);
  const weightKg = isBarbell ? Math.max(20, Math.min(raw, targetWeightKg - 2.5)) : Math.min(raw, targetWeightKg - 2.5);
  return {
    weightKg: Math.max(0, weightKg),
    reps: 5,
    label: 'Calentamiento (~68%)',
  };
}
