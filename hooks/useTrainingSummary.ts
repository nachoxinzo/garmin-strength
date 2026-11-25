'use client';

import { useCallback, useEffect, useState } from 'react';
import { EMPTY_SUMMARY_STATS, MOCK_SUMMARY_STATS } from '@/lib/summary-mock-data';
import { SummaryPeriod, SummaryStats } from '@/lib/summary-types';

interface UseTrainingSummaryOptions {
  forceEmpty?: boolean;
}

interface UseTrainingSummaryResult {
  stats: SummaryStats;
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;
  dataSource: SummaryStats['dataSource'];
  simulateReload: () => void;
}

/**
 * Hook desacoplado que alimenta la pestaña Resumen (Semanal, Mensual, Anual).
 * Actualmente sirve datos mock alineados con nuestro esquema y deja preparados
 * los puntos exactos de integración con Supabase y Garmin Connect.
 */
export function useTrainingSummary(
  period: SummaryPeriod,
  options: UseTrainingSummaryOptions = {}
): UseTrainingSummaryResult {
  const { forceEmpty = false } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error] = useState<string | null>(null);

  // TODO(supabase): 1. Consultar `public.workout_logs` (performed_at, workout_title, exercise_title, set_index, weight_kg, reps, rpe)
  // filtrando por user_id = auth.uid() (o user_id IS NULL para modo local) para calcular:
  // - Volumen levantado semanal / mensual / anual y comparativa porcentual vs periodo anterior
  // - Récords Personales (max_weight y 1RM estimado por fórmula de Epley) y evolución por ejercicio
  // - Reparto por grupo muscular cruzando `exercise_title` con `EXERCISE_CATALOG`

  // TODO(supabase): 2. Crear y consultar `public.garmin_activities` (activity_id, sport_category, started_at,
  // duration_minutes, distance_km, calories, avg_hr, max_hr, aerobic_effect, anaerobic_effect, hr_zones JSONB)
  // sincronizando `garmin.getActivityHrInTimezones(activityId)`. Mientras `hr_zones` no esté persistido,
  // clasificar cada sesión en Z1–Z5 usando `avg_hr` y `aerobic_effect` como fallback.

  // TODO(supabase): 3. Crear y consultar `public.body_measurements` (measured_at, weight_kg, body_fat_pct,
  // muscle_mass_kg, source 'manual' | 'garmin') alimentada por `garmin.getDailyWeighIns` / `garmin.getBodyComposition`
  // o registro manual para trazar la tendencia de peso corporal y la fuerza relativa (e1RM / peso).

  const stats: SummaryStats = forceEmpty ? EMPTY_SUMMARY_STATS : MOCK_SUMMARY_STATS;

  const isEmpty =
    period === 'weekly'
      ? stats.weekly.activeDays === 0 && stats.weekly.strengthVolumeKg.current === 0
      : period === 'monthly'
      ? stats.monthly.totalSessions === 0 && stats.monthly.totalVolumeKg.current === 0
      : stats.annual.totalSessions === 0 && stats.annual.totalTonnesLifted === 0;

  const simulateReload = useCallback(() => {
    setIsLoading(true);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 650);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return {
    stats,
    isLoading,
    isEmpty,
    error,
    dataSource: stats.dataSource,
    simulateReload,
  };
}
