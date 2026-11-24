export interface ExerciseSetLog {
  date: string;          // YYYY-MM-DD
  workoutTitle: string;
  exerciseTitle: string;
  setIndex: number;
  setType: string;
  weightKg: number;
  reps: number;
  setVolume: number;     // weightKg * reps
  estimated1RM: number;  // weightKg * (1 + reps / 30)
}

export interface ExerciseSessionProgress {
  date: string;
  formattedDate: string;
  workoutTitle: string;
  maxWeight: number;
  totalVolume: number;
  bestSetVolume: number;
  bestEstimated1RM: number;
  setsCount: number;
  totalReps: number;
}

export interface ExerciseStatsSummary {
  exerciseTitle: string;
  totalSessions: number;
  allTimeMaxWeight: { weight: number; date: string };
  allTimeEstimated1RM: { e1rm: number; date: string; weight: number; reps: number };
  allTimeMaxSetVolume: { volume: number; date: string; weight: number; reps: number };
  allTimeTotalVolume: number;
  progression: ExerciseSessionProgress[];
}

// Fórmula de Epley para estimar el 1RM
export function calculateEstimated1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * Procesa el CSV exportado de Hevy y genera un historial cronológico completo para analíticas
 */
export function extractProgressFromHevyCSV(csvContent: string): {
  exercises: string[];
  exerciseStatsMap: Record<string, ExerciseStatsSummary>;
  globalVolumeByDate: Record<string, number>;
} {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return { exercises: [], exerciseStatsMap: {}, globalVolumeByDate: {} };
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const titleIdx = headers.indexOf('title');
  const startTimeIdx = headers.indexOf('start_time');
  const exerciseTitleIdx = headers.indexOf('exercise_title');
  const setTypeIdx = headers.indexOf('set_type');
  const weightIdx = headers.indexOf('weight_kg');
  const repsIdx = headers.indexOf('reps');

  if (exerciseTitleIdx === -1) {
    return { exercises: [], exerciseStatsMap: {}, globalVolumeByDate: {} };
  }

  // Mapa temporal: Ejercicio -> Fecha -> Logs del día
  const rawData: Record<string, Record<string, { workoutTitle: string; sets: { weight: number; reps: number }[] }>> = {};
  const globalVolumeByDate: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length <= exerciseTitleIdx) continue;

    const exerciseTitle = cols[exerciseTitleIdx]?.trim();
    if (!exerciseTitle) continue;

    const startTime = startTimeIdx !== -1 && cols[startTimeIdx] ? cols[startTimeIdx].trim() : '';
    const date = startTime ? startTime.slice(0, 10) : 'Sin fecha';
    const workoutTitle = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx].trim() : 'Entrenamiento';
    const weight = weightIdx !== -1 ? Math.max(0, parseFloat(cols[weightIdx]) || 0) : 0;
    const reps = repsIdx !== -1 ? Math.max(0, parseInt(cols[repsIdx]) || 0) : 0;
    const setType = setTypeIdx !== -1 ? cols[setTypeIdx]?.trim().toLowerCase() : 'normal';

    // Opcional: ignorar series de calentamiento para récords de peso, o incluirlas si reps > 0
    if (reps === 0) continue;

    const volume = weight * reps;
    globalVolumeByDate[date] = (globalVolumeByDate[date] || 0) + volume;

    if (!rawData[exerciseTitle]) {
      rawData[exerciseTitle] = {};
    }
    if (!rawData[exerciseTitle][date]) {
      rawData[exerciseTitle][date] = {
        workoutTitle,
        sets: []
      };
    }

    rawData[exerciseTitle][date].sets.push({ weight, reps });
  }

  // Consolidar analíticas por ejercicio
  const exerciseStatsMap: Record<string, ExerciseStatsSummary> = {};

  Object.entries(rawData).forEach(([exerciseTitle, datesMap]) => {
    const sortedDates = Object.keys(datesMap).sort(); // Orden cronológico ascendente
    const progression: ExerciseSessionProgress[] = [];

    let maxWeightRecord = { weight: 0, date: '' };
    let max1RMRecord = { e1rm: 0, date: '', weight: 0, reps: 0 };
    let maxSetVolumeRecord = { volume: 0, date: '', weight: 0, reps: 0 };
    let cumVolume = 0;

    sortedDates.forEach(date => {
      const session = datesMap[date];
      let sessionMaxWeight = 0;
      let sessionTotalVolume = 0;
      let sessionBestSetVolume = 0;
      let sessionBest1RM = 0;
      let sessionTotalReps = 0;

      session.sets.forEach(s => {
        const setVol = s.weight * s.reps;
        const e1rm = calculateEstimated1RM(s.weight, s.reps);

        sessionTotalVolume += setVol;
        sessionTotalReps += s.reps;

        if (s.weight > sessionMaxWeight) sessionMaxWeight = s.weight;
        if (setVol > sessionBestSetVolume) sessionBestSetVolume = setVol;
        if (e1rm > sessionBest1RM) sessionBest1RM = e1rm;

        // Comprobar récords históricos (PRs)
        if (s.weight > maxWeightRecord.weight) {
          maxWeightRecord = { weight: s.weight, date };
        }
        if (e1rm > max1RMRecord.e1rm) {
          max1RMRecord = { e1rm, date, weight: s.weight, reps: s.reps };
        }
        if (setVol > maxSetVolumeRecord.volume) {
          maxSetVolumeRecord = { volume: setVol, date, weight: s.weight, reps: s.reps };
        }
      });

      cumVolume += sessionTotalVolume;

      const dateObj = new Date(date);
      const formattedDate = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : date;

      progression.push({
        date,
        formattedDate,
        workoutTitle: session.workoutTitle,
        maxWeight: sessionMaxWeight,
        totalVolume: sessionTotalVolume,
        bestSetVolume: sessionBestSetVolume,
        bestEstimated1RM: sessionBest1RM,
        setsCount: session.sets.length,
        totalReps: sessionTotalReps
      });
    });

    exerciseStatsMap[exerciseTitle] = {
      exerciseTitle,
      totalSessions: progression.length,
      allTimeMaxWeight: maxWeightRecord,
      allTimeEstimated1RM: max1RMRecord,
      allTimeMaxSetVolume: maxSetVolumeRecord,
      allTimeTotalVolume: cumVolume,
      progression
    };
  });

  const exercises = Object.keys(exerciseStatsMap).sort((a, b) => {
    // Ordenar ejercicios por los que tienen más sesiones registradas
    return exerciseStatsMap[b].totalSessions - exerciseStatsMap[a].totalSessions;
  });

  return {
    exercises,
    exerciseStatsMap,
    globalVolumeByDate
  };
}

// Parser simple de línea CSV
function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.replace(/^"|"$/g, '').trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.replace(/^"|"$/g, '').trim());
  return result;
}

export interface WeeklyTonnagePoint {
  weekKey: string;
  label: string;
  totalVolumeKg: number;
  sessionsCount: number;
  deltaPct: number | null;
}

export interface HeatmapDay {
  date: string;
  strengthVolume: number;
  hasStrength: boolean;
  hasCardio: boolean;
}

export interface LinearTrendResult {
  slope: number;
  startY: number;
  endY: number;
  direction: 'up' | 'flat' | 'down';
  deltaPct: number;
  isPlateau: boolean;
}

function getIsoWeekMonday(dateStr: string): string | null {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
  if (isNaN(d.getTime())) return null;
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Agrupa el volumen global por semana (Lunes-Domingo) para mostrar tendencia de tonelaje.
 */
export function computeWeeklyTonnageTrend(
  globalVolumeByDate: Record<string, number>,
  maxWeeks = 10
): WeeklyTonnagePoint[] {
  const weekMap = new Map<string, { totalVolumeKg: number; sessionsCount: number }>();

  for (const [dateStr, vol] of Object.entries(globalVolumeByDate)) {
    const weekKey = getIsoWeekMonday(dateStr);
    if (!weekKey) continue;
    const prev = weekMap.get(weekKey) || { totalVolumeKg: 0, sessionsCount: 0 };
    weekMap.set(weekKey, {
      totalVolumeKg: prev.totalVolumeKg + vol,
      sessionsCount: prev.sessionsCount + (vol > 0 ? 1 : 0),
    });
  }

  const sortedWeeks = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxWeeks);

  return sortedWeeks.map(([weekKey, stats], idx) => {
    const d = new Date(`${weekKey}T12:00:00Z`);
    const label = !isNaN(d.getTime())
      ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      : weekKey;
    const prevVol = idx > 0 ? sortedWeeks[idx - 1][1].totalVolumeKg : 0;
    const deltaPct =
      idx > 0 && prevVol > 0
        ? Math.round(((stats.totalVolumeKg - prevVol) / prevVol) * 1000) / 10
        : null;

    return {
      weekKey,
      label,
      totalVolumeKg: Math.round(stats.totalVolumeKg),
      sessionsCount: stats.sessionsCount,
      deltaPct,
    };
  });
}

/**
 * Construye una matriz de consistencia de los últimos 84 días (de izquierda a derecha,
 * Lunes a Domingo, y de arriba hacia abajo) separando Fuerza (local/Hevy/Garmin) y Cardio.
 */
export function computeConsistencyHeatmap(
  globalVolumeByDate: Record<string, number>,
  garminCardioDates: string[] = [],
  garminStrengthDates: string[] = []
): {
  days: (HeatmapDay | null)[];
  activeLast30Days: number;
  avgSessionsPerWeek: number;
} {
  const cardioSet = new Set(garminCardioDates.map((d) => d.slice(0, 10)));
  const garminStrengthSet = new Set(garminStrengthDates.map((d) => d.slice(0, 10)));
  const rawDays: HeatmapDay[] = [];
  const today = new Date();
  let activeLast30Days = 0;
  let totalActive84 = 0;

  for (let offset = 83; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const iso = d.toISOString().slice(0, 10);
    const strengthVolume = Math.round(globalVolumeByDate[iso] || 0);
    const hasStrength = strengthVolume > 0 || garminStrengthSet.has(iso);
    const hasCardio = cardioSet.has(iso);
    const isActive = hasStrength || hasCardio;

    if (isActive) {
      totalActive84++;
      if (offset < 30) activeLast30Days++;
    }

    rawDays.push({ date: iso, strengthVolume, hasStrength, hasCardio });
  }

  // Alinear la primera fila a Lunes=0 .. Domingo=6 para lectura izquierda->derecha y arriba->abajo
  const firstDate = rawDays[0] ? new Date(`${rawDays[0].date}T12:00:00Z`) : today;
  const leadingEmpty = (firstDate.getUTCDay() + 6) % 7;
  const days: (HeatmapDay | null)[] = [
    ...Array.from({ length: leadingEmpty }, () => null),
    ...rawDays,
  ];

  return {
    days,
    activeLast30Days,
    avgSessionsPerWeek: Math.round((totalActive84 / 12) * 10) / 10,
  };
}

/**
 * Regresión lineal simple + detección de estancamiento (plateau) en las últimas 3 sesiones.
 */
export function computeLinearTrend(values: number[]): LinearTrendResult | null {
  const n = values.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const startY = intercept;
  const endY = intercept + slope * (n - 1);

  const deltaPct = startY > 0 ? Math.round(((endY - startY) / startY) * 1000) / 10 : 0;
  const direction: 'up' | 'flat' | 'down' =
    deltaPct > 1.5 ? 'up' : deltaPct < -1.5 ? 'down' : 'flat';

  let isPlateau = false;
  if (n >= 3) {
    const last3 = values.slice(-3);
    const max3 = Math.max(...last3);
    const min3 = Math.min(...last3);
    if (max3 > 0 && (max3 - min3) / max3 <= 0.015) {
      isPlateau = true;
    }
  }

  return { slope, startY, endY, direction, deltaPct, isPlateau };
}
