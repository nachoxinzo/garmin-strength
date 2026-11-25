'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  computeAnnualPeriodSummary,
  computeMonthlyPeriodSummary,
  computeWeeklyPeriodSummary,
  ExerciseStatsSummary,
  PeriodActivityItem,
} from '@/lib/progress-analyzer';
import { GarminActivitySummary } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

type PeriodTab = 'weekly' | 'monthly' | 'annual';

interface PeriodSummarySectionProps {
  globalVolumeByDate: Record<string, number>;
  garminActivities: GarminActivitySummary[];
  exerciseStatsMap: Record<string, ExerciseStatsSummary>;
  targetWeeklyDays?: number;
  isLoading?: boolean;
}

export function PeriodSummarySection({
  globalVolumeByDate,
  garminActivities,
  exerciseStatsMap,
  targetWeeklyDays = 4,
  isLoading = false,
}: PeriodSummarySectionProps) {
  const [period, setPeriod] = useState<PeriodTab>('weekly');
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const activities: PeriodActivityItem[] = useMemo(
    () =>
      garminActivities.map((a) => ({
        id: a.activityId,
        name: a.name,
        sportCategory: a.sportCategory,
        date: a.startTimeLocal.slice(0, 10),
        durationMinutes: a.durationMinutes,
        distanceKm: a.distanceKm,
      })),
    [garminActivities]
  );

  const weekly = useMemo(
    () => computeWeeklyPeriodSummary(globalVolumeByDate, activities, targetWeeklyDays),
    [globalVolumeByDate, activities, targetWeeklyDays]
  );

  const monthly = useMemo(
    () =>
      computeMonthlyPeriodSummary(
        selectedYear,
        selectedMonth,
        globalVolumeByDate,
        activities
      ),
    [selectedYear, selectedMonth, globalVolumeByDate, activities]
  );

  const annual = useMemo(
    () => computeAnnualPeriodSummary(selectedYear, globalVolumeByDate, activities),
    [selectedYear, globalVolumeByDate, activities]
  );

  const topPrs = useMemo(() => {
    return Object.values(exerciseStatsMap)
      .filter((s) => s.allTimeMaxWeight.weight > 0)
      .sort((a, b) => b.allTimeMaxWeight.weight - a.allTimeMaxWeight.weight)
      .slice(0, 3);
  }, [exerciseStatsMap]);

  const handlePrevMonth = () => {
    setSelectedCalendarDate(null);
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedCalendarDate(null);
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  if (isLoading) {
    return (
      <section className="bg-card rounded-2xl border border-border/80 p-5 sm:p-6 saas-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-10 w-64 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-44 rounded-xl" />
      </section>
    );
  }

  return (
    <section className="bg-card rounded-2xl border border-border/80 p-5 sm:p-6 saas-card space-y-5 text-left">
      {/* Cabecera + Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span>Resumen de Rendimiento</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {period === 'weekly' && 'Foco en objetivos semanales y carga inmediata'}
            {period === 'monthly' && 'Consistencia diaria, distribución y tendencia mensual'}
            {period === 'annual' && 'Resumen anual, hitos acumulados y mejores marcas'}
          </p>
        </div>

        {/* Segmented Control (Semanal | Mensual | Anual) */}
        <div
          role="tablist"
          aria-label="Periodo de estadísticas"
          className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 rounded-xl bg-muted/80 border border-border/70 w-full sm:w-auto"
        >
          {(
            [
              { id: 'weekly', label: 'Semanal' },
              { id: 'monthly', label: 'Mensual' },
              { id: 'annual', label: 'Anual' },
            ] as { id: PeriodTab; label: string }[]
          ).map((tab) => {
            const active = period === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(tab.id)}
                className={`saas-btn min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-card text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. VISTA SEMANAL                           */}
      {/* ========================================== */}
      {period === 'weekly' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {weekly.sessionsCount === 0 && weekly.strengthVolumeKg === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 p-8 text-center space-y-2">
              <Dumbbell className="w-7 h-7 text-muted-foreground mx-auto" />
              <div className="text-sm font-semibold text-foreground">
                Sin entrenamientos registrados esta semana
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Completa una sesión en Entreno en Vivo o pulsa Sincronizar Garmin para ver tu progreso semanal en tiempo real.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Días Activos</span>
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-xl font-bold text-foreground tabular-nums">
                    {weekly.trainedDaysCount}
                    <span className="text-xs font-medium text-muted-foreground">
                      {' '}
                      / {weekly.targetDays} obj.
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((weekly.trainedDaysCount / weekly.targetDays) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Volumen Fuerza</span>
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="text-xl font-bold text-foreground tabular-nums">
                    {weekly.strengthVolumeKg.toLocaleString('es-ES')} kg
                  </div>
                  <div
                    className={`text-[11px] font-semibold tabular-nums ${
                      weekly.volumeDeltaPct === null
                        ? 'text-muted-foreground'
                        : weekly.volumeDeltaPct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {weekly.volumeDeltaPct !== null
                      ? `${weekly.volumeDeltaPct >= 0 ? '+' : ''}${weekly.volumeDeltaPct}% vs sem. ant.`
                      : 'Sin ref. semana anterior'}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Tiempo Garmin</span>
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xl font-bold text-foreground tabular-nums">
                    {weekly.totalMinutes} min
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {weekly.sessionsCount} sesiones totales
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Racha Semanal</span>
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold text-foreground tabular-nums">
                    {weekly.streakWeeks} {weekly.streakWeeks === 1 ? 'sem' : 'sems'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Semanas seguidas activas
                  </div>
                </div>
              </div>

              {/* Tira visual L-D de la semana actual */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    Semana en curso (Lunes a Domingo)
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {weekly.weekStartIso} &rarr; {weekly.weekEndIso}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {weekly.days.map((d) => {
                    const bgClass =
                      d.hasStrength && d.hasCardio
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : d.hasStrength
                        ? 'bg-blue-600 text-white border-blue-600'
                        : d.hasCardio
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-card text-muted-foreground border-border/70';
                    return (
                      <div
                        key={d.date}
                        className={`rounded-xl border py-2.5 px-1 text-center space-y-1 transition-all ${bgClass}`}
                        title={`${d.date}${d.volumeKg > 0 ? ` · ${d.volumeKg} kg` : ''}`}
                      >
                        <div className="text-xs font-bold">{d.shortLabel}</div>
                        <div className="text-[10px] opacity-90 tabular-nums">
                          {d.hasStrength && d.hasCardio
                            ? 'Doble'
                            : d.hasStrength
                            ? d.volumeKg > 0
                              ? `${Math.round(d.volumeKg / 100) / 10}t`
                              : 'Fuerza'
                            : d.hasCardio
                            ? 'Cardio'
                            : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 2. VISTA MENSUAL                           */}
      {/* ========================================== */}
      {period === 'monthly' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Selector de Mes */}
          <div className="flex items-center justify-between rounded-xl bg-muted/30 border border-border/70 px-3 py-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mes anterior"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-card border border-transparent hover:border-border/80"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-foreground">{monthly.monthLabel}</div>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Mes siguiente"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-card border border-transparent hover:border-border/80"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {monthly.totalSessions === 0 && monthly.totalVolumeKg === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 p-8 text-center space-y-2">
              <Calendar className="w-7 h-7 text-muted-foreground mx-auto" />
              <div className="text-sm font-semibold text-foreground">
                Sin entrenamientos en {monthly.monthLabel}
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Usa las flechas para revisar otro mes o sincroniza tus sesiones de Garmin y Hevy.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Calendario de consistencia mensual */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">Calendario de Consistencia</span>
                  <span className="text-muted-foreground tabular-nums">
                    {monthly.trainedDaysCount} días activos &middot; {monthly.totalSessions} ses.
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold text-muted-foreground">
                  <span>L</span>
                  <span>M</span>
                  <span>X</span>
                  <span>J</span>
                  <span>V</span>
                  <span>S</span>
                  <span>D</span>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: monthly.leadingEmptyDays }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8" />
                  ))}
                  {monthly.calendarDays.map((day) => {
                    const isSelected = selectedCalendarDate === day.date;
                    const cls =
                      day.hasStrength && day.hasCardio
                        ? 'bg-indigo-600 text-white'
                        : day.hasStrength
                        ? 'bg-blue-600 text-white'
                        : day.hasCardio
                        ? 'bg-emerald-600 text-white'
                        : 'bg-card text-muted-foreground border border-border/60';
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() =>
                          setSelectedCalendarDate((prev) =>
                            prev === day.date ? null : day.date
                          )
                        }
                        className={`h-8 rounded-lg text-[11px] font-bold tabular-nums transition-transform hover:scale-105 ${cls} ${
                          isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                        }`}
                      >
                        {day.dayNumber}
                      </button>
                    );
                  })}
                </div>

                {selectedCalendarDate && (
                  <div className="rounded-lg bg-card border border-border/70 p-2.5 text-xs flex items-center justify-between">
                    <span className="font-semibold text-foreground">{selectedCalendarDate}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {Math.round(globalVolumeByDate[selectedCalendarDate] || 0) > 0
                        ? `Fuerza: ${Math.round(
                            globalVolumeByDate[selectedCalendarDate]
                          ).toLocaleString('es-ES')} kg`
                        : 'Actividad Garmin'}
                    </span>
                  </div>
                )}
              </div>

              {/* Tendencia semanal del mes + Distribución */}
              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Volumen por Semana del Mes</span>
                    </span>
                    <span className="font-bold text-foreground tabular-nums">
                      {monthly.totalVolumeKg.toLocaleString('es-ES')} kg
                    </span>
                  </div>
                  <div className="h-24 flex items-end gap-2">
                    {(() => {
                      const maxW = Math.max(
                        1,
                        ...monthly.weeklyBars.map((b) => b.volumeKg || b.sessions * 1000)
                      );
                      return monthly.weeklyBars.map((b) => {
                        const val = b.volumeKg || b.sessions * 1000;
                        const pct = val > 0 ? Math.max(12, Math.round((val / maxW) * 100)) : 6;
                        return (
                          <div key={b.label} className="flex-1 flex flex-col items-center gap-1 h-full">
                            <div className="w-full flex-1 flex items-end">
                              <div
                                className={`w-full rounded-t-md ${
                                  val > 0 ? 'bg-blue-600' : 'bg-muted'
                                }`}
                                style={{ height: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {b.label}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2.5">
                  <div className="text-xs font-bold text-foreground">
                    Distribución por Tipo de Sesión
                  </div>
                  <div className="space-y-2">
                    {monthly.distribution.map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] tabular-nums">
                          <span className="font-semibold text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">
                            {item.count} ses. ({item.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.label === 'Fuerza' ? 'bg-blue-600' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 3. VISTA ANUAL ("WRAPPED" / YEAR IN SPORT) */}
      {/* ========================================== */}
      {period === 'annual' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Selector de Año */}
          <div className="flex items-center justify-between rounded-xl bg-muted/30 border border-border/70 px-3 py-2">
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y - 1)}
              aria-label="Año anterior"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-card border border-transparent hover:border-border/80"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-foreground">Resumen Anual {annual.year}</div>
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y + 1)}
              aria-label="Año siguiente"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-card border border-transparent hover:border-border/80"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {annual.totalSessions === 0 && annual.totalTonnes === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 p-8 text-center space-y-2">
              <Award className="w-7 h-7 text-muted-foreground mx-auto" />
              <div className="text-sm font-semibold text-foreground">
                Aún no hay entrenamientos en {annual.year}
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Cuando registres sesiones o importes tu historial de Hevy/Garmin aparecerá aquí tu resumen anual.
              </p>
            </div>
          ) : (
            <>
              {/* Hero Card estilo Whoop / Strava Year in Sport */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white p-5 sm:p-6 border border-slate-800 shadow-lg space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[11px] font-bold">
                    <Sparkles className="w-3 h-3" />
                    <span>IronSync Year in Sport {annual.year}</span>
                  </div>
                  {annual.bestMonthLabel && (
                    <span className="text-xs text-slate-300 font-medium">
                      Mejor mes: <strong className="text-white">{annual.bestMonthLabel}</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                    <div className="text-[11px] text-slate-300">Sesiones Totales</div>
                    <div className="text-2xl font-black mt-1">{annual.totalSessions}</div>
                    <div className="text-[10px] text-slate-400">
                      {annual.strengthSessions} fuerza · {annual.cardioSessions} cardio
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                    <div className="text-[11px] text-slate-300">Toneladas Movidas</div>
                    <div className="text-2xl font-black text-blue-400 mt-1">
                      {annual.totalTonnes} t
                    </div>
                    <div className="text-[10px] text-slate-400">Volumen acumulado</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                    <div className="text-[11px] text-slate-300">Horas Garmin</div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">
                      {annual.totalHours} h
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {annual.totalDistanceKm} km recorridos
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                    <div className="text-[11px] text-slate-300">Mes Pico</div>
                    <div className="text-xl font-black text-amber-400 mt-1 truncate">
                      {annual.bestMonthLabel || '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {annual.bestMonthSessions} sesiones
                    </div>
                  </div>
                </div>

                {topPrs.length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Top Récords Personales</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {topPrs.map((pr) => (
                        <div
                          key={pr.exerciseTitle}
                          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-slate-200 font-medium">
                            {pr.exerciseTitle}
                          </span>
                          <span className="font-black text-white tabular-nums shrink-0">
                            {pr.allTimeMaxWeight.weight} kg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Evolución Mes a Mes (Ene-Dic) */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="text-xs font-bold text-foreground">
                  Evolución Mes a Mes ({annual.year})
                </div>
                <div className="h-32 flex items-end gap-1.5">
                  {(() => {
                    const maxM = Math.max(
                      1,
                      ...annual.monthlyEvolution.map((m) => m.volumeKg || m.sessions * 1000)
                    );
                    return annual.monthlyEvolution.map((m) => {
                      const val = m.volumeKg || m.sessions * 1000;
                      const pct = val > 0 ? Math.max(10, Math.round((val / maxM) * 100)) : 5;
                      return (
                        <div
                          key={m.monthIndex}
                          className="flex-1 flex flex-col items-center gap-1 h-full"
                          title={`${m.shortLabel}: ${m.sessions} ses. · ${m.volumeKg.toLocaleString('es-ES')} kg`}
                        >
                          <div className="w-full flex-1 flex items-end">
                            <div
                              className={`w-full rounded-t-md transition-all ${
                                val > 0 ? 'bg-blue-600 hover:bg-blue-500' : 'bg-muted'
                              }`}
                              style={{ height: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {m.shortLabel}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
