export interface PlateItem {
  weightKg: number;
  count: number;
  colorClass: string;
}

export interface BarbellBreakdown {
  barWeightKg: number;
  perSide: PlateItem[];
  achievableTotalKg: number;
  remainderKg: number;
}

const STANDARD_PLATES: { weight: number; colorClass: string }[] = [
  { weight: 25, colorClass: 'bg-rose-600 text-white' },
  { weight: 20, colorClass: 'bg-blue-600 text-white' },
  { weight: 15, colorClass: 'bg-amber-500 text-slate-950' },
  { weight: 10, colorClass: 'bg-emerald-600 text-white' },
  { weight: 5, colorClass: 'bg-slate-200 text-slate-900 border border-slate-300' },
  { weight: 2.5, colorClass: 'bg-slate-700 text-white' },
  { weight: 1.25, colorClass: 'bg-slate-500 text-white' },
];

/**
 * Calcula los discos necesarios a cada lado de una barra olímpica (20 kg por defecto)
 * para alcanzar el peso objetivo.
 */
export function calculateBarbellPlates(
  totalWeightKg: number,
  barWeightKg = 20
): BarbellBreakdown | null {
  if (totalWeightKg < barWeightKg) {
    return null;
  }

  let remainingPerSide = (totalWeightKg - barWeightKg) / 2;
  const perSide: PlateItem[] = [];

  for (const plate of STANDARD_PLATES) {
    if (remainingPerSide >= plate.weight - 0.001) {
      const count = Math.floor((remainingPerSide + 0.001) / plate.weight);
      if (count > 0) {
        perSide.push({
          weightKg: plate.weight,
          count,
          colorClass: plate.colorClass,
        });
        remainingPerSide = Math.round((remainingPerSide - count * plate.weight) * 100) / 100;
      }
    }
  }

  const loadedPerSide = perSide.reduce((acc, p) => acc + p.weightKg * p.count, 0);
  const achievableTotalKg = barWeightKg + loadedPerSide * 2;

  return {
    barWeightKg,
    perSide,
    achievableTotalKg,
    remainderKg: Math.round((totalWeightKg - achievableTotalKg) * 100) / 100,
  };
}
