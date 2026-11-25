import { GarminActivitySummary } from './types';

export type SummaryPeriod = 'weekly' | 'monthly' | 'annual';
export type ActivityDayType = 'none' | 'strength' | 'garmin' | 'both';
export type HrZoneNumber = 1 | 2 | 3 | 4 | 5;

export interface MetricDelta {
  current: number;
  previous: number | null;
  deltaPct: number | null;
}

export interface HeartRateZoneBucket {
  zone: HrZoneNumber;
  label: string;
  bpmRange: string;
  minutes: number;
  pct: number;
  source: 'garmin_zones' | 'estimated_from_avg_hr';
}

export interface BodyWeightPoint {
  date: string;
  label: string;
  weightKg: number;
  bodyFatPct?: number | null;
}

export interface BodyWeightSummary {
  currentKg: number | null;
  startKg: number | null;
  deltaKg: number | null;
  minKg: number | null;
  maxKg: number | null;
  series: BodyWeightPoint[];
  hasData: boolean;
}

export interface PersonalRecordItem {
  id: string;
  exerciseTitle: string;
  muscleGroup: string;
  maxWeightKg: number;
  repsAtMax: number;
  estimated1RMKg: number;
  previousBest1RMKg?: number | null;
  delta1RMKg?: number | null;
  achievedAt: string;
  relativeStrengthRatio?: number | null;
}

export interface DisciplineBreakdownItem {
  key: string;
  label: string;
  sessions: number;
  minutes: number;
  volumeKg?: number;
  pct: number;
  category: 'strength' | 'garmin';
}

export interface CalendarActivityDay {
  date: string;
  dayNumber: number;
  shortWeekday: string;
  type: ActivityDayType;
  strengthVolumeKg: number;
  garminMinutes: number;
  garminDistanceKm: number;
  sessionsCount: number;
  topActivityLabel?: string;
  isFuture?: boolean;
}

export interface StrengthDaySetDetail {
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe?: number;
}

export interface StrengthDayExerciseDetail {
  name: string;
  muscleGroup: string;
  totalVolumeKg: number;
  bestEstimated1RM: number;
  sets: StrengthDaySetDetail[];
}

export interface StrengthDaySession {
  id: string;
  date: string;
  workoutTitle: string;
  source: 'supabase_hevy' | 'live_tracker';
  totalVolumeKg: number;
  totalSets: number;
  exercises: StrengthDayExerciseDetail[];
}

export interface DaySessionsBundle {
  garminActivities: GarminActivitySummary[];
  strengthSessions: StrengthDaySession[];
}

export interface WeeklySummaryStats {
  periodLabel: string;
  activeDays: number;
  targetDays: number;
  strengthSessions: number;
  garminSessions: number;
  strengthVolumeKg: MetricDelta;
  garminMinutes: MetricDelta;
  garminDistanceKm: MetricDelta;
  caloriesBurned: number;
  streakWeeks: number;
  daysStrip: CalendarActivityDay[];
  hrZones: HeartRateZoneBucket[];
  bodyWeight: BodyWeightSummary;
  recentPRs: PersonalRecordItem[];
}

export interface MonthlySummaryStats {
  year: number;
  monthIndex: number;
  monthLabel: string;
  activeDays: number;
  totalSessions: number;
  strengthSessions: number;
  garminSessions: number;
  totalVolumeKg: MetricDelta;
  totalGarminMinutes: number;
  totalGarminDistanceKm: number;
  leadingEmptyDays: number;
  calendarDays: CalendarActivityDay[];
  weeklyEvolution: {
    weekLabel: string;
    strengthVolumeKg: number;
    garminMinutes: number;
    sessions: number;
    avgBodyWeightKg: number | null;
  }[];
  disciplineBreakdown: DisciplineBreakdownItem[];
  muscleGroupBreakdown: DisciplineBreakdownItem[];
  bodyWeight: BodyWeightSummary;
  topPRs: PersonalRecordItem[];
}

export interface AnnualSummaryStats {
  year: number;
  totalSessions: number;
  strengthSessions: number;
  garminSessions: number;
  totalTonnesLifted: number;
  totalGarminHours: number;
  totalGarminDistanceKm: number;
  longestStreakDays: number;
  longestStreakWeeks: number;
  bestMonth: {
    label: string;
    sessions: number;
    tonnes: number;
  } | null;
  monthlyComparison: {
    monthIndex: number;
    shortLabel: string;
    strengthSessions: number;
    garminSessions: number;
    tonnesLifted: number;
    garminHours: number;
    avgBodyWeightKg: number | null;
  }[];
  hrZones: HeartRateZoneBucket[];
  bodyWeight: BodyWeightSummary;
  hallOfFamePRs: PersonalRecordItem[];
}

export interface SummaryStats {
  weekly: WeeklySummaryStats;
  monthly: MonthlySummaryStats;
  annual: AnnualSummaryStats;
  daySessionsMap: Record<string, DaySessionsBundle>;
  dataSource: 'live_real' | 'supabase_garmin';
  lastUpdatedAt: string;
}
