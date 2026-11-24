import { StrengthRoutine } from './types';
import { generateScientificRoutine } from './scientific-workout-generator';

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
    return {
      mon: generateScientificRoutine({ split: 'ppl', sessionDay: 'push', goal: 'hypertrophy', level: 'intermediate', durationMinutes: 60 }),
      wed: generateScientificRoutine({ split: 'ppl', sessionDay: 'pull', goal: 'hypertrophy', level: 'intermediate', durationMinutes: 60 }),
      fri: generateScientificRoutine({ split: 'ppl', sessionDay: 'legs', goal: 'hypertrophy', level: 'intermediate', durationMinutes: 60 }),
    };
  }
  if (preset === 'upper_lower_4') {
    return {
      mon: generateScientificRoutine({ split: 'upper_lower', sessionDay: 'upper', goal: 'hypertrophy', level: 'intermediate', durationMinutes: 60 }),
      tue: generateScientificRoutine({ split: 'upper_lower', sessionDay: 'lower', goal: 'hypertrophy', level: 'intermediate', durationMinutes: 60 }),
      thu: generateScientificRoutine({ split: 'upper_lower', sessionDay: 'upper', goal: 'powerbuilding', level: 'intermediate', durationMinutes: 60 }),
      fri: generateScientificRoutine({ split: 'upper_lower', sessionDay: 'lower', goal: 'powerbuilding', level: 'intermediate', durationMinutes: 60 }),
    };
  }
  return {
    mon: generateScientificRoutine({ split: 'full_body', sessionDay: 'full_body_a', goal: 'hypertrophy', level: 'intermediate', durationMinutes: 60 }),
    wed: generateScientificRoutine({ split: 'full_body', sessionDay: 'full_body_b', goal: 'hypertrophy', level: 'intermediate', durationMinutes: 60 }),
    fri: generateScientificRoutine({ split: 'full_body', sessionDay: 'full_body_a', goal: 'hypertrophy', level: 'intermediate', durationMinutes: 60 }),
  };
}
