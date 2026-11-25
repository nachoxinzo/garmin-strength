'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadGarminWellnessSnapshot } from '@/lib/garmin-wellness-client';
import { loadProgressionHistory, ExerciseProgressRecord } from '@/lib/progressive-overload-engine';
import { getWorkoutLogsCsvFromSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { buildRealSummaryStats } from '@/lib/summary-real-aggregator';
import { SummaryPeriod, SummaryStats } from '@/lib/summary-types';
import { GarminActivitySummary } from '@/lib/types';
import { loadWeeklyPlan } from '@/lib/weekly-planner';

interface UseTrainingSummaryOptions {
  year?: number;
  monthIndex?: number;
}

interface UseTrainingSummaryResult {
  stats: SummaryStats;
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;
  sourceLabel: string;
  refresh: () => Promise<void>;
}

/**
 * Hook de datos 100% reales para la pestaña Resumen (Semanal, Mensual, Anual).
 * Combina actividades sincronizadas de Garmin Connect, registros de Supabase (`workout_logs`),
 * historial local de Hevy (`hevy_raw_csv_cache`) y sesiones de Entreno en Vivo (`loadProgressionHistory`).
 */
export function useTrainingSummary(
  period: SummaryPeriod,
  options: UseTrainingSummaryOptions = {}
): UseTrainingSummaryResult {
  const now = new Date();
  const year = options.year ?? now.getFullYear();
  const monthIndex = options.monthIndex ?? now.getMonth();

  const [csvRaw, setCsvRaw] = useState<string>('');
  const [hasSupabaseSource, setHasSupabaseSource] = useState<boolean>(false);
  const [liveHistory, setLiveHistory] = useState<Record<string, ExerciseProgressRecord>>({});
  const [garminActivities, setGarminActivities] = useState<GarminActivitySummary[]>([]);
  const [targetWeeklyDays, setTargetWeeklyDays] = useState<number>(4);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllRealSources = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fuentes locales inmediatas (Garmin Wellness Snapshot, Entreno en Vivo, Plan Semanal)
      const snap = loadGarminWellnessSnapshot();
      setGarminActivities(snap?.recentActivities || []);
      setLiveHistory(loadProgressionHistory());
      const planCount = Object.keys(loadWeeklyPlan()).length;
      setTargetWeeklyDays(planCount > 0 ? planCount : 4);

      // 2. Historial de fuerza: Supabase primero, luego caché local de Hevy/Garmin import
      let loadedCsv = '';
      let usedSupabase = false;

      if (isSupabaseConfigured()) {
        try {
          const cloudCsv = await getWorkoutLogsCsvFromSupabase();
          if (cloudCsv && cloudCsv.trim().length > 50) {
            loadedCsv = cloudCsv;
            usedSupabase = true;
          }
        } catch (err) {
          console.warn('No se pudo consultar workout_logs en Supabase:', err);
        }
      }

      if (!loadedCsv && typeof window !== 'undefined') {
        try {
          const localCsv = localStorage.getItem('hevy_raw_csv_cache') || '';
          if (localCsv.trim().length > 50) {
            loadedCsv = localCsv;
          }
        } catch {
          // ignore storage error
        }
      }

      setCsvRaw(loadedCsv);
      setHasSupabaseSource(usedSupabase);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar tus datos de entrenamiento.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllRealSources();
  }, [loadAllRealSources]);

  const stats: SummaryStats = useMemo(
    () =>
      buildRealSummaryStats({
        csvRaw,
        liveHistory,
        garminActivities,
        targetWeeklyDays,
        selectedYear: year,
        selectedMonthIndex: monthIndex,
        hasSupabaseSource,
      }),
    [csvRaw, liveHistory, garminActivities, targetWeeklyDays, year, monthIndex, hasSupabaseSource]
  );

  const isEmpty =
    period === 'weekly'
      ? stats.weekly.activeDays === 0 && stats.weekly.strengthVolumeKg.current === 0
      : period === 'monthly'
      ? stats.monthly.totalSessions === 0 && stats.monthly.totalVolumeKg.current === 0
      : stats.annual.totalSessions === 0 && stats.annual.totalTonnesLifted === 0;

  const hasStrength =
    Boolean(csvRaw.trim()) || Object.keys(liveHistory).length > 0;
  const hasGarmin = garminActivities.length > 0;

  const sourceLabel =
    hasGarmin && hasSupabaseSource
      ? 'Garmin + Supabase'
      : hasGarmin && hasStrength
      ? 'Garmin + Local'
      : hasGarmin
      ? 'Garmin en vivo'
      : hasSupabaseSource
      ? 'Supabase Cloud'
      : hasStrength
      ? 'Historial Local'
      : 'Sin datos sincronizados';

  return {
    stats,
    isLoading,
    isEmpty,
    error,
    sourceLabel,
    refresh: loadAllRealSources,
  };
}
