import { EXERCISE_CATALOG } from './exercise-catalog';
import { calculateEstimated1RM } from './progress-analyzer';
import { ExerciseProgressRecord } from './progressive-overload-engine';
import {
  GARMIN_IMPORT_MARKER,
  parseCsvRow,
} from './strength-sync-merger';
import {
  BodyWeightSummary,
  CalendarActivityDay,
  DaySessionsBundle,
  DisciplineBreakdownItem,
  HeartRateZoneBucket,
  HrZoneNumber,
  MetricDelta,
  PersonalRecordItem,
  StrengthDayExerciseDetail,
  StrengthDaySession,
  SummaryStats,
} from './summary-types';
import { GarminActivitySummary } from './types';

const SHORT_WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const SHORT_MONTHS_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const EMPTY_BODY_WEIGHT: BodyWeightSummary = {
  hasData: false,
  currentKg: null,
  startKg: null,
  deltaKg: null,
  minKg: null,
  maxKg: null,
  series: [],
};

export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getMondayOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const jsDay = copy.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  copy.setDate(copy.getDate() + mondayOffset);
  return copy;
}

function formatShortRangeLabel(start: Date, end: Date): string {
  const sDay = start.getDate();
  const eDay = end.getDate();
  const sMonth = SHORT_MONTHS_ES[start.getMonth()];
  const eMonth = SHORT_MONTHS_ES[end.getMonth()];
  const year = end.getFullYear();
  if (sMonth === eMonth) {
    return `${sDay} – ${eDay} ${eMonth} ${year}`;
  }
  return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${year}`;
}

function computeDelta(current: number, previous: number | null): MetricDelta {
  if (previous === null || previous <= 0) {
    return { current, previous: previous && previous > 0 ? previous : null, deltaPct: null };
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  return { current, previous, deltaPct: pct };
}

function resolveMuscleGroup(exerciseTitle: string): string {
  const lower = exerciseTitle.trim().toLowerCase();
  if (!lower) return 'General';

  const exact = EXERCISE_CATALOG.find((e) => e.name.toLowerCase() === lower);
  if (exact) return exact.muscleGroup;

  const partial = EXERCISE_CATALOG.find(
    (e) =>
      lower.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(lower)
  );
  if (partial) return partial.muscleGroup;

  if (
    lower.includes('sentadilla') ||
    lower.includes('squat') ||
    lower.includes('prensa') ||
    lower.includes('zancada') ||
    lower.includes('femoral') ||
    lower.includes('cuádriceps') ||
    lower.includes('gemelo') ||
    lower.includes('split')
  ) {
    return 'Piernas';
  }
  if (
    lower.includes('banca') ||
    lower.includes('bench') ||
    lower.includes('pecho') ||
    lower.includes('aperturas') ||
    lower.includes('fly') ||
    lower.includes('fondos')
  ) {
    return 'Pecho';
  }
  if (
    lower.includes('remo') ||
    lower.includes('row') ||
    lower.includes('jalón') ||
    lower.includes('dominada') ||
    lower.includes('pull')
  ) {
    return 'Espalda';
  }
  if (
    lower.includes('peso muerto') ||
    lower.includes('deadlift') ||
    lower.includes('hip thrust')
  ) {
    return 'Piernas';
  }
  if (
    lower.includes('militar') ||
    lower.includes('hombro') ||
    lower.includes('lateral') ||
    lower.includes('shoulder') ||
    lower.includes('ohp') ||
    lower.includes('face pull') ||
    lower.includes('rotation')
  ) {
    return 'Hombros';
  }
  if (lower.includes('bíceps') || lower.includes('curl') || lower.includes('tríceps')) {
    return 'Brazos';
  }
  if (lower.includes('crunch') || lower.includes('plancha') || lower.includes('elevación de piernas')) {
    return 'Core';
  }
  return 'General';
}

function classifyAvgHrZone(avgHr: number): HrZoneNumber {
  if (avgHr < 120) return 1;
  if (avgHr < 140) return 2;
  if (avgHr < 157) return 3;
  if (avgHr < 173) return 4;
  return 5;
}

const ZONE_META: Record<HrZoneNumber, { label: string; bpmRange: string }> = {
  1: { label: 'Z1 Recuperación', bpmRange: '< 120 bpm' },
  2: { label: 'Z2 Aeróbico Base', bpmRange: '120–139 bpm' },
  3: { label: 'Z3 Tempo', bpmRange: '140–156 bpm' },
  4: { label: 'Z4 Umbral', bpmRange: '157–172 bpm' },
  5: { label: 'Z5 Máxima', bpmRange: '≥ 173 bpm' },
};

function computeHrZonesFromActivities(activities: GarminActivitySummary[]): HeartRateZoneBucket[] {
  const minsByZone: Record<HrZoneNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalWithHr = 0;

  for (const act of activities) {
    if (!act.avgHr || act.avgHr <= 0 || act.durationMinutes <= 0) continue;
    const z = classifyAvgHrZone(act.avgHr);
    minsByZone[z] += act.durationMinutes;
    totalWithHr += act.durationMinutes;
  }

  if (totalWithHr <= 0) return [];

  return ([1, 2, 3, 4, 5] as HrZoneNumber[]).map((zone) => {
    const minutes = Math.round(minsByZone[zone]);
    const pct = Math.round((minsByZone[zone] / totalWithHr) * 100);
    return {
      zone,
      label: ZONE_META[zone].label,
      bpmRange: ZONE_META[zone].bpmRange,
      minutes,
      pct,
      source: 'estimated_from_avg_hr',
    };
  });
}

interface ParsedCsvSetRow {
  date: string;
  workoutTitle: string;
  exerciseTitle: string;
  weightKg: number;
  reps: number;
  rpe?: number;
  isGarminImport: boolean;
}

function buildStrengthSessionsByDate(
  csvRaw: string,
  liveHistory: Record<string, ExerciseProgressRecord>,
  todayIso: string
): Record<string, StrengthDaySession[]> {
  const rowsByDate = new Map<string, ParsedCsvSetRow[]>();
  const appAuthoritativeDates = new Set<string>();

  if (csvRaw && csvRaw.trim().length > 0) {
    const lines = csvRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length >= 2) {
      const headers = parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
      const titleIdx = headers.indexOf('title');
      const startTimeIdx = headers.indexOf('start_time');
      const exIdx = headers.indexOf('exercise_title');
      const notesIdx = headers.indexOf('exercise_notes');
      const weightIdx = headers.indexOf('weight_kg');
      const repsIdx = headers.indexOf('reps');
      const rpeIdx = headers.indexOf('rpe');

      if (exIdx !== -1) {
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvRow(lines[i]);
          const exerciseTitle = cols[exIdx]?.trim();
          if (!exerciseTitle) continue;

          const date = startTimeIdx !== -1 ? String(cols[startTimeIdx] || '').trim().slice(0, 10) : '';
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayIso) continue;

          const reps = repsIdx !== -1 ? Math.max(0, parseInt(cols[repsIdx], 10) || 0) : 0;
          if (reps <= 0) continue;

          const weightKg = weightIdx !== -1 ? Math.max(0, parseFloat(cols[weightIdx]) || 0) : 0;
          const rpeRaw = rpeIdx !== -1 ? parseFloat(cols[rpeIdx]) : NaN;
          const rpe = !isNaN(rpeRaw) && rpeRaw > 0 ? rpeRaw : undefined;
          const workoutTitle =
            titleIdx !== -1 ? cols[titleIdx]?.trim() || 'Entrenamiento' : 'Entrenamiento';
          const notes = notesIdx !== -1 ? String(cols[notesIdx] || '').trim().toLowerCase() : '';
          const isGarminImport = notes === GARMIN_IMPORT_MARKER;

          if (!isGarminImport) {
            appAuthoritativeDates.add(date);
          }

          const arr = rowsByDate.get(date) || [];
          arr.push({
            date,
            workoutTitle,
            exerciseTitle,
            weightKg,
            reps,
            rpe,
            isGarminImport,
          });
          rowsByDate.set(date, arr);
        }
      }
    }
  }

  for (const rec of Object.values(liveHistory)) {
    const date = String(rec.lastDate || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayIso && rec.lastReps > 0 && rec.lastSets > 0) {
      appAuthoritativeDates.add(date);
    }
  }

  const byDateAndTitle = new Map<
    string,
    {
      date: string;
      workoutTitle: string;
      source: 'supabase_hevy' | 'live_tracker' | 'garmin_import';
      exercises: Map<string, { weightKg: number; reps: number; setIndex: number; rpe?: number }[]>;
    }
  >();

  const existingExerciseOnDate = new Set<string>();

  rowsByDate.forEach((rows, date) => {
    const hasAppSets = appAuthoritativeDates.has(date);

    for (const row of rows) {
      // Regla de prioridad: si ese día hay fuerza registrada en la App, omitir series auto-importadas de Garmin
      if (hasAppSets && row.isGarminImport) continue;

      const sessionKey = `${date}||${row.workoutTitle}`;
      let session = byDateAndTitle.get(sessionKey);
      if (!session) {
        session = {
          date,
          workoutTitle: row.workoutTitle,
          source: row.isGarminImport ? 'garmin_import' : 'supabase_hevy',
          exercises: new Map(),
        };
        byDateAndTitle.set(sessionKey, session);
      }

      const list = session.exercises.get(row.exerciseTitle) || [];
      list.push({
        setIndex: list.length + 1,
        weightKg: row.weightKg,
        reps: row.reps,
        rpe: row.rpe,
      });
      session.exercises.set(row.exerciseTitle, list);
      existingExerciseOnDate.add(`${date}||${row.exerciseTitle.toLowerCase()}`);
    }
  });

  // Combinar registros realizados en Entreno en Vivo que aún no estén en CSV/Supabase
  for (const rec of Object.values(liveHistory)) {
    const date = String(rec.lastDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayIso) continue;
    if (rec.lastReps <= 0 || rec.lastSets <= 0) continue;

    const catalogItem = EXERCISE_CATALOG.find((e) => e.id === rec.exerciseId);
    const exName = catalogItem ? catalogItem.name : rec.exerciseId;
    if (existingExerciseOnDate.has(`${date}||${exName.toLowerCase()}`)) continue;

    const sessionKey = `${date}||Entreno en Vivo`;
    let session = byDateAndTitle.get(sessionKey);
    if (!session) {
      session = {
        date,
        workoutTitle: 'Entreno en Vivo',
        source: 'live_tracker',
        exercises: new Map(),
      };
      byDateAndTitle.set(sessionKey, session);
    }

    const sets = Array.from({ length: rec.lastSets }, (_, i) => ({
      setIndex: i + 1,
      weightKg: rec.lastWeightKg,
      reps: rec.lastReps,
    }));
    session.exercises.set(exName, sets);
  }

  const result: Record<string, StrengthDaySession[]> = {};
  byDateAndTitle.forEach((raw, key) => {
    let totalVolumeKg = 0;
    let totalSets = 0;
    const exercises: StrengthDayExerciseDetail[] = [];

    raw.exercises.forEach((sets, name) => {
      let exVol = 0;
      let best1RM = 0;
      for (const s of sets) {
        exVol += s.weightKg * s.reps;
        const e1rm = calculateEstimated1RM(s.weightKg, s.reps);
        if (e1rm > best1RM) best1RM = e1rm;
      }
      totalVolumeKg += exVol;
      totalSets += sets.length;
      exercises.push({
        name,
        muscleGroup: resolveMuscleGroup(name),
        totalVolumeKg: Math.round(exVol),
        bestEstimated1RM: Math.round(best1RM * 10) / 10,
        sets,
      });
    });

    if (!result[raw.date]) result[raw.date] = [];
    result[raw.date].push({
      id: key,
      date: raw.date,
      workoutTitle: raw.workoutTitle,
      source: raw.source,
      totalVolumeKg: Math.round(totalVolumeKg),
      totalSets,
      exercises,
    });
  });

  return result;
}

function buildDayActivitySummary(
  date: string,
  dayNumber: number,
  shortWeekday: string,
  isFuture: boolean,
  bundle?: DaySessionsBundle,
  allGarminActsForDay: GarminActivitySummary[] = []
): CalendarActivityDay {
  if (isFuture || (!bundle && allGarminActsForDay.length === 0)) {
    return {
      date,
      dayNumber,
      shortWeekday,
      type: 'none',
      strengthVolumeKg: 0,
      garminMinutes: 0,
      garminDistanceKm: 0,
      sessionsCount: 0,
      isFuture,
    };
  }

  const strengthSessions = bundle?.strengthSessions || [];
  const remainingGarminActs = bundle?.garminActivities || [];

  const strengthVolumeKg = Math.round(
    strengthSessions.reduce((acc, s) => acc + s.totalVolumeKg, 0)
  );
  const garminMinutes = Math.round(
    allGarminActsForDay.reduce((acc, a) => acc + (a.durationMinutes || 0), 0)
  );
  const garminDistanceKm =
    Math.round(
      allGarminActsForDay.reduce((acc, a) => acc + (a.distanceKm || 0), 0) * 100
    ) / 100;

  const hasStrength =
    strengthSessions.length > 0 ||
    allGarminActsForDay.some((a) => a.sportCategory === 'Fuerza');
  const hasGarminCardio = allGarminActsForDay.some((a) => a.sportCategory !== 'Fuerza');

  const type =
    hasStrength && hasGarminCardio
      ? 'both'
      : hasStrength
      ? 'strength'
      : hasGarminCardio
      ? 'garmin'
      : 'none';

  // Conteo unificado: sesiones de fuerza (ya emparejadas con su actividad Garmin si aplica) + resto de Garmin
  const sessionsCount = strengthSessions.length + remainingGarminActs.length;
  const topActivityLabel =
    strengthSessions[0]?.workoutTitle || allGarminActsForDay[0]?.name || undefined;

  return {
    date,
    dayNumber,
    shortWeekday,
    type,
    strengthVolumeKg,
    garminMinutes,
    garminDistanceKm,
    sessionsCount,
    topActivityLabel,
    isFuture: false,
  };
}

function extractPRsInRange(
  daySessionsMap: Record<string, DaySessionsBundle>,
  startIso: string,
  endIso: string
): PersonalRecordItem[] {
  const bestInWindow = new Map<
    string,
    {
      exerciseTitle: string;
      muscleGroup: string;
      maxWeightKg: number;
      repsAtMax: number;
      estimated1RMKg: number;
      achievedAt: string;
    }
  >();
  const bestBeforeWindow = new Map<string, number>();

  const allDates = Object.keys(daySessionsMap).sort();
  for (const date of allDates) {
    const bundle = daySessionsMap[date];
    for (const session of bundle.strengthSessions) {
      for (const ex of session.exercises) {
        for (const s of ex.sets) {
          if (s.weightKg <= 0 || s.reps <= 0) continue;
          const e1rm = calculateEstimated1RM(s.weightKg, s.reps);
          const key = ex.name.toLowerCase();

          if (date < startIso) {
            const prev = bestBeforeWindow.get(key) || 0;
            if (e1rm > prev) bestBeforeWindow.set(key, e1rm);
          } else if (date >= startIso && date <= endIso) {
            const curr = bestInWindow.get(key);
            if (
              !curr ||
              e1rm > curr.estimated1RMKg ||
              (e1rm === curr.estimated1RMKg && s.weightKg > curr.maxWeightKg)
            ) {
              bestInWindow.set(key, {
                exerciseTitle: ex.name,
                muscleGroup: ex.muscleGroup,
                maxWeightKg: s.weightKg,
                repsAtMax: s.reps,
                estimated1RMKg: Math.round(e1rm * 10) / 10,
                achievedAt: date,
              });
            }
          }
        }
      }
    }
  }

  const list: PersonalRecordItem[] = [];
  bestInWindow.forEach((item, key) => {
    const prevBest = bestBeforeWindow.get(key) ?? null;
    const delta =
      prevBest !== null && item.estimated1RMKg > prevBest
        ? Math.round((item.estimated1RMKg - prevBest) * 10) / 10
        : null;
    list.push({
      id: `${key}-${item.achievedAt}`,
      exerciseTitle: item.exerciseTitle,
      muscleGroup: item.muscleGroup,
      maxWeightKg: item.maxWeightKg,
      repsAtMax: item.repsAtMax,
      estimated1RMKg: item.estimated1RMKg,
      previousBest1RMKg: prevBest,
      delta1RMKg: delta,
      achievedAt: item.achievedAt,
      relativeStrengthRatio: null,
    });
  });

  return list
    .sort((a, b) => b.estimated1RMKg - a.estimated1RMKg || b.maxWeightKg - a.maxWeightKg)
    .slice(0, 5);
}

export interface BuildRealSummaryInput {
  csvRaw: string;
  liveHistory: Record<string, ExerciseProgressRecord>;
  garminActivities: GarminActivitySummary[];
  targetWeeklyDays?: number;
  selectedYear?: number;
  selectedMonthIndex?: number;
  hasSupabaseSource?: boolean;
}

export function buildRealSummaryStats({
  csvRaw,
  liveHistory,
  garminActivities,
  targetWeeklyDays = 4,
  selectedYear,
  selectedMonthIndex,
  hasSupabaseSource = false,
}: BuildRealSummaryInput): SummaryStats {
  const now = new Date();
  const todayIso = toLocalIsoDate(now);
  const year = selectedYear ?? now.getFullYear();
  const monthIndex = selectedMonthIndex ?? now.getMonth();

  const strengthByDate = buildStrengthSessionsByDate(csvRaw, liveHistory, todayIso);
  const allGarminByDate: Record<string, GarminActivitySummary[]> = {};

  for (const act of garminActivities) {
    const date = String(act.startTimeLocal || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayIso) continue;
    if (!allGarminByDate[date]) allGarminByDate[date] = [];
    allGarminByDate[date].push(act);
  }

  // Emparejar actividades Garmin de "Fuerza" con la sesión de fuerza del mismo día (cero sesiones duplicadas)
  const allDatesSet = new Set([
    ...Object.keys(strengthByDate),
    ...Object.keys(allGarminByDate),
  ]);
  const daySessionsMap: Record<string, DaySessionsBundle> = {};

  allDatesSet.forEach((date) => {
    const strengthSessions = (strengthByDate[date] || []).map((s) => ({ ...s }));
    const garminActs = [...(allGarminByDate[date] || [])];

    if (strengthSessions.length > 0) {
      const garminStrengthIdx = garminActs.findIndex((a) => a.sportCategory === 'Fuerza');
      if (garminStrengthIdx !== -1) {
        const [pairedGarminAct] = garminActs.splice(garminStrengthIdx, 1);
        strengthSessions[0].linkedGarminActivity = pairedGarminAct;
      }
    }

    daySessionsMap[date] = {
      strengthSessions,
      garminActivities: garminActs,
    };
  });

  // ============================================================================
  // 1. VISTA SEMANAL (Lunes a Domingo de la semana actual, nunca días futuros)
  // ============================================================================
  const weekStart = getMondayOfWeek(now);
  const weekEnd = addDays(weekStart, 6);
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekEnd = addDays(weekStart, -1);
  const prevWeekStartIso = toLocalIsoDate(prevWeekStart);
  const prevWeekEndIso = toLocalIsoDate(prevWeekEnd);

  const daysStrip: CalendarActivityDay[] = Array.from({ length: 7 }, (_, idx) => {
    const d = addDays(weekStart, idx);
    const iso = toLocalIsoDate(d);
    const isFuture = iso > todayIso;
    return buildDayActivitySummary(
      iso,
      d.getDate(),
      SHORT_WEEKDAYS[idx],
      isFuture,
      daySessionsMap[iso],
      allGarminByDate[iso] || []
    );
  });

  const activeDays = daysStrip.filter((d) => !d.isFuture && d.type !== 'none').length;
  let weeklyStrengthSessions = 0;
  let weeklyGarminSessions = 0;
  let weeklyStrengthVol = 0;
  let weeklyGarminMins = 0;
  let weeklyGarminKm = 0;
  let weeklyCalories = 0;
  const weeklyGarminActs: GarminActivitySummary[] = [];

  for (const d of daysStrip) {
    if (d.isFuture) continue;
    const bundle = daySessionsMap[d.date];
    const allGarminForDay = allGarminByDate[d.date] || [];

    if (bundle) {
      weeklyStrengthSessions += bundle.strengthSessions.length;
      weeklyStrengthVol += d.strengthVolumeKg;
      weeklyGarminSessions += bundle.garminActivities.length;
    }

    for (const act of allGarminForDay) {
      weeklyGarminActs.push(act);
      weeklyGarminMins += act.durationMinutes || 0;
      weeklyGarminKm += act.distanceKm || 0;
      weeklyCalories += act.calories || 0;
    }
  }

  let prevStrengthVol = 0;
  let prevGarminMins = 0;
  let prevGarminKm = 0;
  for (const [date, bundle] of Object.entries(daySessionsMap)) {
    if (date < prevWeekStartIso || date > prevWeekEndIso) continue;
    for (const s of bundle.strengthSessions) prevStrengthVol += s.totalVolumeKg;
  }
  for (const [date, acts] of Object.entries(allGarminByDate)) {
    if (date < prevWeekStartIso || date > prevWeekEndIso) continue;
    for (const a of acts) {
      prevGarminMins += a.durationMinutes || 0;
      prevGarminKm += a.distanceKm || 0;
    }
  }

  // Racha de semanas activas consecutivas
  let streakWeeks = 0;
  for (let w = 0; w < 52; w++) {
    const ws = addDays(weekStart, -7 * w);
    const we = addDays(ws, 6);
    const wsIso = toLocalIsoDate(ws);
    const weIso = toLocalIsoDate(we) > todayIso ? todayIso : toLocalIsoDate(we);
    const hasAny = Array.from(allDatesSet).some((d) => d >= wsIso && d <= weIso);
    if (hasAny) {
      streakWeeks++;
    } else if (w === 0) {
      continue;
    } else {
      break;
    }
  }

  const sevenDaysAgoIso = toLocalIsoDate(addDays(now, -6));
  const recentPRs = extractPRsInRange(daySessionsMap, sevenDaysAgoIso, todayIso).slice(0, 3);

  // ============================================================================
  // 2. VISTA MENSUAL
  // ============================================================================
  const firstDayOfMonth = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingEmptyDays = (firstDayOfMonth.getDay() + 6) % 7;
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  const prevMonthDate = new Date(year, monthIndex - 1, 1, 12, 0, 0, 0);
  const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(
    prevMonthDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const calendarDays: CalendarActivityDay[] = Array.from({ length: daysInMonth }, (_, idx) => {
    const dayNum = idx + 1;
    const d = new Date(year, monthIndex, dayNum, 12, 0, 0, 0);
    const iso = toLocalIsoDate(d);
    const isFuture = iso > todayIso;
    const weekdayIdx = (d.getDay() + 6) % 7;
    return buildDayActivitySummary(
      iso,
      dayNum,
      SHORT_WEEKDAYS[weekdayIdx],
      isFuture,
      daySessionsMap[iso],
      allGarminByDate[iso] || []
    );
  });

  let monthActiveDays = 0;
  let monthStrengthSessions = 0;
  let monthGarminSessions = 0;
  let monthVolumeKg = 0;
  let monthGarminMins = 0;
  let monthGarminKm = 0;

  const disciplineCounts = new Map<
    string,
    { label: string; sessions: number; minutes: number; volumeKg: number; category: 'strength' | 'garmin' }
  >();
  const muscleVolumeCounts = new Map<string, { sessions: number; volumeKg: number }>();

  const weeklyBuckets = [
    { weekLabel: 'Sem 1', strengthVolumeKg: 0, garminMinutes: 0, sessions: 0, avgBodyWeightKg: null as number | null },
    { weekLabel: 'Sem 2', strengthVolumeKg: 0, garminMinutes: 0, sessions: 0, avgBodyWeightKg: null as number | null },
    { weekLabel: 'Sem 3', strengthVolumeKg: 0, garminMinutes: 0, sessions: 0, avgBodyWeightKg: null as number | null },
    { weekLabel: 'Sem 4+', strengthVolumeKg: 0, garminMinutes: 0, sessions: 0, avgBodyWeightKg: null as number | null },
  ];

  for (const day of calendarDays) {
    if (day.isFuture) continue;
    if (day.type !== 'none') monthActiveDays++;

    const weekIdx = Math.min(3, Math.floor((day.dayNumber - 1) / 7));
    const bundle = daySessionsMap[day.date];
    const allGarminForDay = allGarminByDate[day.date] || [];

    weeklyBuckets[weekIdx].strengthVolumeKg += day.strengthVolumeKg;
    weeklyBuckets[weekIdx].garminMinutes += day.garminMinutes;
    weeklyBuckets[weekIdx].sessions += day.sessionsCount;
    monthVolumeKg += day.strengthVolumeKg;

    for (const act of allGarminForDay) {
      monthGarminMins += act.durationMinutes || 0;
      monthGarminKm += act.distanceKm || 0;
    }

    if (!bundle) continue;
    monthStrengthSessions += bundle.strengthSessions.length;
    monthGarminSessions += bundle.garminActivities.length;

    for (const s of bundle.strengthSessions) {
      const discKey = s.source === 'garmin_import' ? 'Fuerza (Garmin)' : 'Fuerza (App)';
      const existing = disciplineCounts.get(discKey) || {
        label: discKey,
        sessions: 0,
        minutes: 0,
        volumeKg: 0,
        category: 'strength' as const,
      };
      existing.sessions += 1;
      existing.volumeKg += s.totalVolumeKg;
      existing.minutes += s.linkedGarminActivity?.durationMinutes || 0;
      disciplineCounts.set(discKey, existing);

      const seenMusclesInSession = new Set<string>();
      for (const ex of s.exercises) {
        const m = muscleVolumeCounts.get(ex.muscleGroup) || { sessions: 0, volumeKg: 0 };
        m.volumeKg += ex.totalVolumeKg;
        if (!seenMusclesInSession.has(ex.muscleGroup)) {
          m.sessions += 1;
          seenMusclesInSession.add(ex.muscleGroup);
        }
        muscleVolumeCounts.set(ex.muscleGroup, m);
      }
    }

    for (const act of bundle.garminActivities) {
      const key = `${act.sportCategory} (Garmin)`;
      const cat: 'strength' | 'garmin' =
        act.sportCategory === 'Fuerza' ? 'strength' : 'garmin';
      const existing = disciplineCounts.get(key) || {
        label: key,
        sessions: 0,
        minutes: 0,
        volumeKg: 0,
        category: cat,
      };
      existing.sessions += 1;
      existing.minutes += act.durationMinutes || 0;
      disciplineCounts.set(key, existing);
    }
  }

  let prevMonthVol = 0;
  for (const [date, bundle] of Object.entries(daySessionsMap)) {
    if (!date.startsWith(prevMonthPrefix)) continue;
    for (const s of bundle.strengthSessions) prevMonthVol += s.totalVolumeKg;
  }

  const totalDisciplineSessions = Math.max(
    1,
    Array.from(disciplineCounts.values()).reduce((a, b) => a + b.sessions, 0)
  );
  const disciplineBreakdown: DisciplineBreakdownItem[] = Array.from(
    disciplineCounts.entries()
  )
    .map(([key, v]) => ({
      key,
      label: v.label,
      sessions: v.sessions,
      minutes: Math.round(v.minutes),
      volumeKg: v.volumeKg > 0 ? Math.round(v.volumeKg) : undefined,
      pct: Math.round((v.sessions / totalDisciplineSessions) * 100),
      category: v.category,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const totalMuscleVol = Math.max(
    1,
    Array.from(muscleVolumeCounts.values()).reduce((a, b) => a + b.volumeKg, 0)
  );
  const muscleGroupBreakdown: DisciplineBreakdownItem[] = Array.from(
    muscleVolumeCounts.entries()
  )
    .map(([key, v]) => ({
      key,
      label: key,
      sessions: v.sessions,
      minutes: 0,
      volumeKg: Math.round(v.volumeKg),
      pct: Math.round((v.volumeKg / totalMuscleVol) * 100),
      category: 'strength' as const,
    }))
    .sort((a, b) => (b.volumeKg || 0) - (a.volumeKg || 0));

  const monthTopPRs = extractPRsInRange(
    daySessionsMap,
    `${monthPrefix}-01`,
    `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`
  );

  // ============================================================================
  // 3. VISTA ANUAL
  // ============================================================================
  const yearPrefix = `${year}-`;
  const monthlyComparison = SHORT_MONTHS_ES.map((shortLabel, idx) => ({
    monthIndex: idx,
    shortLabel,
    strengthSessions: 0,
    garminSessions: 0,
    tonnesLifted: 0,
    garminHours: 0,
    avgBodyWeightKg: null as number | null,
  }));

  let annualStrengthSessions = 0;
  let annualGarminSessions = 0;
  let annualVolumeKg = 0;
  let annualGarminMins = 0;
  let annualGarminKm = 0;
  const annualGarminActs: GarminActivitySummary[] = [];
  const activeDatesInYear: string[] = [];

  for (const [date, bundle] of Object.entries(daySessionsMap)) {
    if (!date.startsWith(yearPrefix) || date > todayIso) continue;
    const mIdx = parseInt(date.slice(5, 7), 10) - 1;
    if (mIdx < 0 || mIdx > 11) continue;

    if (bundle.strengthSessions.length > 0 || bundle.garminActivities.length > 0) {
      activeDatesInYear.push(date);
    }

    for (const s of bundle.strengthSessions) {
      annualStrengthSessions += 1;
      annualVolumeKg += s.totalVolumeKg;
      monthlyComparison[mIdx].strengthSessions += 1;
      monthlyComparison[mIdx].tonnesLifted += s.totalVolumeKg / 1000;
    }

    for (const act of bundle.garminActivities) {
      annualGarminSessions += 1;
      monthlyComparison[mIdx].garminSessions += 1;
    }
  }

  for (const [date, acts] of Object.entries(allGarminByDate)) {
    if (!date.startsWith(yearPrefix) || date > todayIso) continue;
    const mIdx = parseInt(date.slice(5, 7), 10) - 1;
    if (mIdx < 0 || mIdx > 11) continue;

    for (const act of acts) {
      annualGarminActs.push(act);
      annualGarminMins += act.durationMinutes || 0;
      annualGarminKm += act.distanceKm || 0;
      monthlyComparison[mIdx].garminHours += (act.durationMinutes || 0) / 60;
    }
  }

  for (const m of monthlyComparison) {
    m.tonnesLifted = Math.round(m.tonnesLifted * 10) / 10;
    m.garminHours = Math.round(m.garminHours * 10) / 10;
  }

  activeDatesInYear.sort();
  let longestStreakDays = 0;
  let currentDayStreak = 0;
  let prevDayDate: Date | null = null;
  for (const iso of activeDatesInYear) {
    const d = parseLocalIsoDate(iso);
    if (prevDayDate) {
      const diffDays = Math.round((d.getTime() - prevDayDate.getTime()) / (1000 * 60 * 60 * 24));
      currentDayStreak = diffDays === 1 ? currentDayStreak + 1 : 1;
    } else {
      currentDayStreak = 1;
    }
    if (currentDayStreak > longestStreakDays) longestStreakDays = currentDayStreak;
    prevDayDate = d;
  }

  let bestMonth: { label: string; sessions: number; tonnes: number } | null = null;
  for (const m of monthlyComparison) {
    const totalSes = m.strengthSessions + m.garminSessions;
    if (totalSes === 0 && m.tonnesLifted === 0) continue;
    if (
      !bestMonth ||
      totalSes > bestMonth.sessions ||
      (totalSes === bestMonth.sessions && m.tonnesLifted > bestMonth.tonnes)
    ) {
      bestMonth = {
        label: MONTH_NAMES_ES[m.monthIndex],
        sessions: totalSes,
        tonnes: m.tonnesLifted,
      };
    }
  }

  const hallOfFamePRs = extractPRsInRange(
    daySessionsMap,
    `${year}-01-01`,
    `${year}-12-31`
  );

  return {
    dataSource: hasSupabaseSource ? 'supabase_garmin' : 'live_real',
    lastUpdatedAt: new Date().toISOString(),
    daySessionsMap,
    weekly: {
      periodLabel: formatShortRangeLabel(weekStart, weekEnd),
      activeDays,
      targetDays: targetWeeklyDays,
      strengthSessions: weeklyStrengthSessions,
      garminSessions: weeklyGarminSessions,
      strengthVolumeKg: computeDelta(
        Math.round(weeklyStrengthVol),
        prevStrengthVol > 0 ? Math.round(prevStrengthVol) : null
      ),
      garminMinutes: computeDelta(
        Math.round(weeklyGarminMins),
        prevGarminMins > 0 ? Math.round(prevGarminMins) : null
      ),
      garminDistanceKm: computeDelta(
        Math.round(weeklyGarminKm * 10) / 10,
        prevGarminKm > 0 ? Math.round(prevGarminKm * 10) / 10 : null
      ),
      caloriesBurned: Math.round(weeklyCalories),
      streakWeeks,
      daysStrip,
      hrZones: computeHrZonesFromActivities(weeklyGarminActs),
      bodyWeight: EMPTY_BODY_WEIGHT,
      recentPRs,
    },
    monthly: {
      year,
      monthIndex,
      monthLabel: `${MONTH_NAMES_ES[monthIndex]} ${year}`,
      activeDays: monthActiveDays,
      totalSessions: monthStrengthSessions + monthGarminSessions,
      strengthSessions: monthStrengthSessions,
      garminSessions: monthGarminSessions,
      totalVolumeKg: computeDelta(
        Math.round(monthVolumeKg),
        prevMonthVol > 0 ? Math.round(prevMonthVol) : null
      ),
      totalGarminMinutes: Math.round(monthGarminMins),
      totalGarminDistanceKm: Math.round(monthGarminKm * 10) / 10,
      leadingEmptyDays,
      calendarDays,
      weeklyEvolution: weeklyBuckets,
      disciplineBreakdown,
      muscleGroupBreakdown,
      bodyWeight: EMPTY_BODY_WEIGHT,
      topPRs: monthTopPRs,
    },
    annual: {
      year,
      totalSessions: annualStrengthSessions + annualGarminSessions,
      strengthSessions: annualStrengthSessions,
      garminSessions: annualGarminSessions,
      totalTonnesLifted: Math.round((annualVolumeKg / 1000) * 10) / 10,
      totalGarminHours: Math.round((annualGarminMins / 60) * 10) / 10,
      totalGarminDistanceKm: Math.round(annualGarminKm * 10) / 10,
      longestStreakDays,
      longestStreakWeeks: streakWeeks,
      bestMonth,
      monthlyComparison,
      hrZones: computeHrZonesFromActivities(annualGarminActs),
      bodyWeight: EMPTY_BODY_WEIGHT,
      hallOfFamePRs,
    },
  };
}
