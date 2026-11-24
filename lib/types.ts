import { CatalogExercise } from './exercise-catalog';

export interface WorkoutExerciseBlock {
  id: string;
  exercise: CatalogExercise;
  sets: number;
  reps: number;
  weightKg: number;
  suggestedWeightKg?: number; // Peso sugerido original de Hevy
  restSeconds: number;
  supersetGroupId?: string; // Agrupa ejercicios consecutivos en superserie/biserie
  targetRir?: string; // ej. 'RIR 1-2', 'RIR 0-1', 'RIR 3 (Descarga)'
  stretchBias?: boolean; // Máxima tensión en estiramiento (Maeo/Wolf et al.)
}

export interface StrengthRoutine {
  id: string;
  name: string;
  warmupSeconds: number;
  cooldownSeconds: number;
  blocks: WorkoutExerciseBlock[];
}

export interface GarminAccountStatus {
  authenticated: boolean;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
}

export type SportCategory = 'Fuerza' | 'Running' | 'Ciclismo' | 'Natación' | 'Cardio / Otros';

export interface GarminActivitySummary {
  activityId: number;
  name: string;
  sportCategory: SportCategory;
  typeKey: string;
  startTimeLocal: string;
  durationMinutes: number;
  distanceKm: number;
  calories: number;
  avgHr?: number;
  aerobicEffect?: number;
  anaerobicEffect?: number;
}

export interface GarminSleepSummary {
  date: string;
  durationHours: number;
  deepHours: number;
  remHours: number;
  lightHours: number;
  sleepScore?: number;
}

export interface GarminRecoverySummary {
  trainingReadinessScore?: number;
  trainingReadinessLevel?: string;
  bodyBatteryCurrent?: number;
  bodyBatteryCharged?: number;
  bodyBatteryDrained?: number;
  hrvLastNight?: number;
  hrvWeeklyAvg?: number;
  hrvStatus?: string;
  restingHr?: number;
  avgStress?: number;
}

export interface GarminWellnessSnapshot {
  syncedAt: string;
  sleep: GarminSleepSummary | null;
  recovery: GarminRecoverySummary;
  recentActivities: GarminActivitySummary[];
  weeklySportMinutes: Record<SportCategory, number>;
  /** 0-100: índice unificado de disponibilidad para entrenar fuerza hoy */
  readinessIndex: number;
  /** Nivel de fatiga estimada en últimos 2 días por actividades externas */
  lowerBodyFatigue: 'low' | 'moderate' | 'high';
  upperBodyFatigue: 'low' | 'moderate' | 'high';
  coachInsights: string[];
}

export interface GarminActivityDetail {
  activityId: number;
  avgHr?: number;
  maxHr?: number;
  calories?: number;
  elevationGainM?: number;
  avgSpeedKmh?: number;
  avgPaceMinKm?: string;
  aerobicEffect?: number;
  anaerobicEffect?: number;
  hrZones: { zone: number; seconds: number; pct: number }[];
  splits: {
    lap: number;
    distanceKm: number;
    durationMin: number;
    paceMinKm?: string;
    avgHr?: number;
  }[];
  strengthExercises: {
    name: string;
    sets: { setIndex: number; weightKg: number; reps: number }[];
  }[];
}
