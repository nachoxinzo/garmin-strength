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
