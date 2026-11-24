import { EquipmentType } from './exercise-catalog';
import {
  ExperienceLevel,
  generateScientificRoutine,
  TrainingGoal,
} from './scientific-workout-generator';
import { getKnownExerciseWeights, loadMyGymProfile } from './smart-workout-engine';
import { StrengthRoutine } from './types';

export type WeekDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEK_DAYS: { key: WeekDayKey; label: string; short: string; jsDay: number }[] = [
  { key: 'mon', label: 'Lunes', short: 'Lun', jsDay: 1 },
  { key: 'tue', label: 'Martes', short: 'Mar', jsDay: 2 },
  { key: 'wed', label: 'Miércoles', short: 'Mié', jsDay: 3 },
  { key: 'thu', label: 'Jueves', short: 'Jue', jsDay: 4 },
  { key: 'fri', label: 'Viernes', short: 'Vie', jsDay: 5 },
  { key: 'sat', label: 'Sábado', short: 'Sáb', jsDay: 6 },
  { key: 'sun', label: 'Domingo', short: 'Dom', jsDay: 0 },
];

export type WeeklyPlanMap = Partial<Record<WeekDayKey, StrengthRoutine>>;
export type WeeklySplitStyle = 'auto' | 'upper_lower' | 'ppl' | 'full_body' | 'ppl_upper';

export interface CustomWeeklyPlanOptions {
  selectedDays: WeekDayKey[];
  splitStyle: WeeklySplitStyle;
  goal: TrainingGoal;
  level: ExperienceLevel;
  durationMinutes: 45 | 60 | 75 | 90;
  useGymProfile?: boolean;
}

const WEEKLY_PLAN_STORAGE_KEY = 'garmin_strength_weekly_plan_v1';

export function loadWeeklyPlan(): WeeklyPlanMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(WEEKLY_PLAN_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as WeeklyPlanMap;
  } catch {
    return {};
  }
}

export function saveWeeklyPlan(plan: WeeklyPlanMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WEEKLY_PLAN_STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // ignore
  }
}

export function getTodayWeekKey(): WeekDayKey {
  const jsDay = new Date().getDay();
  const found = WEEK_DAYS.find((d) => d.jsDay === jsDay);
  return found ? found.key : 'mon';
}

export function buildPresetWeeklyPlan(preset: 'ppl_3' | 'upper_lower_4' | 'full_body_3'): WeeklyPlanMap {
  if (preset === 'ppl_3') {
    return buildCustomWeeklyPlan({
      selectedDays: ['mon', 'wed', 'fri'],
      splitStyle: 'ppl',
      goal: 'hypertrophy',
      level: 'intermediate',
      durationMinutes: 60,
      useGymProfile: true,
    });
  }
  if (preset === 'upper_lower_4') {
    return buildCustomWeeklyPlan({
      selectedDays: ['mon', 'tue', 'thu', 'fri'],
      splitStyle: 'upper_lower',
      goal: 'hypertrophy',
      level: 'intermediate',
      durationMinutes: 60,
      useGymProfile: true,
    });
  }
  return buildCustomWeeklyPlan({
    selectedDays: ['mon', 'wed', 'fri'],
    splitStyle: 'full_body',
    goal: 'hypertrophy',
    level: 'intermediate',
    durationMinutes: 60,
    useGymProfile: true,
  });
}

type SessionSpec = {
  split: 'ppl' | 'upper_lower' | 'full_body';
  sessionDay: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body_a' | 'full_body_b';
  label: string;
  goalOverride?: TrainingGoal;
};

function resolveSessionsSequence(count: number, splitStyle: WeeklySplitStyle): SessionSpec[] {
  const effectiveStyle: WeeklySplitStyle =
    splitStyle === 'auto'
      ? count <= 3
        ? count === 3
          ? 'ppl'
          : 'full_body'
        : count === 4
        ? 'upper_lower'
        : count === 5
        ? 'ppl_upper'
        : 'ppl'
      : splitStyle;

  if (effectiveStyle === 'upper_lower') {
    const seq: SessionSpec[] = [
      { split: 'upper_lower', sessionDay: 'upper', label: 'Torso A' },
      { split: 'upper_lower', sessionDay: 'lower', label: 'Pierna A' },
      { split: 'upper_lower', sessionDay: 'upper', label: 'Torso B', goalOverride: 'powerbuilding' },
      { split: 'upper_lower', sessionDay: 'lower', label: 'Pierna B', goalOverride: 'powerbuilding' },
      { split: 'upper_lower', sessionDay: 'upper', label: 'Torso C' },
      { split: 'upper_lower', sessionDay: 'lower', label: 'Pierna C' },
    ];
    return seq.slice(0, count);
  }

  if (effectiveStyle === 'ppl_upper') {
    const seq: SessionSpec[] = [
      { split: 'ppl', sessionDay: 'push', label: 'Empuje (Push)' },
      { split: 'ppl', sessionDay: 'pull', label: 'Tracción (Pull)' },
      { split: 'ppl', sessionDay: 'legs', label: 'Pierna (Legs)' },
      { split: 'upper_lower', sessionDay: 'upper', label: 'Torso Completo' },
      { split: 'upper_lower', sessionDay: 'lower', label: 'Pierna / Cadera' },
      { split: 'ppl', sessionDay: 'push', label: 'Empuje B' },
    ];
    return seq.slice(0, count);
  }

  if (effectiveStyle === 'ppl') {
    const seq: SessionSpec[] = [
      { split: 'ppl', sessionDay: 'push', label: 'Empuje A' },
      { split: 'ppl', sessionDay: 'pull', label: 'Tracción A' },
      { split: 'ppl', sessionDay: 'legs', label: 'Pierna A' },
      { split: 'ppl', sessionDay: 'push', label: 'Empuje B' },
      { split: 'ppl', sessionDay: 'pull', label: 'Tracción B' },
      { split: 'ppl', sessionDay: 'legs', label: 'Pierna B' },
    ];
    return seq.slice(0, count);
  }

  // Full Body
  const seq: SessionSpec[] = [
    { split: 'full_body', sessionDay: 'full_body_a', label: 'Full Body A' },
    { split: 'full_body', sessionDay: 'full_body_b', label: 'Full Body B' },
    { split: 'full_body', sessionDay: 'full_body_a', label: 'Full Body C' },
    { split: 'full_body', sessionDay: 'full_body_b', label: 'Full Body D' },
    { split: 'full_body', sessionDay: 'full_body_a', label: 'Full Body E' },
    { split: 'full_body', sessionDay: 'full_body_b', label: 'Full Body F' },
  ];
  return seq.slice(0, count);
}

/**
 * Construye un plan semanal a medida según los días exactos seleccionados (2 a 6 días),
 * respetando el equipamiento de Mi Gimnasio y las cargas conocidas.
 */
export function buildCustomWeeklyPlan(options: CustomWeeklyPlanOptions): WeeklyPlanMap {
  const orderedDays = WEEK_DAYS.map((d) => d.key).filter((k) => options.selectedDays.includes(k));
  if (orderedDays.length === 0) return {};

  const preferredEquipment: EquipmentType[] | undefined = options.useGymProfile
    ? loadMyGymProfile().availableEquipment
    : undefined;
  const knownWeights = getKnownExerciseWeights();
  const sequence = resolveSessionsSequence(orderedDays.length, options.splitStyle);

  const plan: WeeklyPlanMap = {};

  orderedDays.forEach((dayKey, idx) => {
    const spec = sequence[idx];
    const routine = generateScientificRoutine({
      split: spec.split,
      sessionDay: spec.sessionDay,
      goal: spec.goalOverride || options.goal,
      level: options.level,
      durationMinutes: options.durationMinutes,
      preferredEquipment,
    });

    // Aplicar pesos conocidos y nombre limpio <= 16 chars
    const enrichedBlocks = routine.blocks.map((b, bIdx) => {
      const known = knownWeights[b.exercise.id];
      return {
        ...b,
        id: `plan-${dayKey}-${Date.now()}-${bIdx}`,
        weightKg: known || b.weightKg,
      };
    });

    plan[dayKey] = {
      ...routine,
      id: `plan-${dayKey}-${Date.now()}`,
      name: spec.label.slice(0, 16),
      blocks: enrichedBlocks,
    };
  });

  return plan;
}
