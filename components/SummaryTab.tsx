'use client';

import React, { useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  Clock,
  Database,
  Dumbbell,
  Flame,
  Layers,
  Play,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  Watch,
} from 'lucide-react';
import { useTrainingSummary } from '@/hooks/useTrainingSummary';
import { GarminWellnessCard } from '@/components/GarminWellnessCard';
import { DEMO_WELLNESS_SNAPSHOT } from '@/lib/summary-mock-data';
import { MetricDelta, PersonalRecordItem, SummaryPeriod } from '@/lib/summary-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ActivityHeatmapCalendar,
  AnnualBodyWeightChart,
  AnnualMonthlyComparisonChart,
  BodyWeightVolumeChart,
  HrZonesDistributionBar,
  WeeklyEvolutionStackedChart,
} from '@/components/summary/SummaryCharts';

interface SummaryTabProps {
  onNavigateToLive?: () => void;
}

function DeltaPill({
  delta,
  suffix = '% vs ant.',
}: {
  delta: MetricDelta;
  suffix?: string;
}) {
  if (delta.deltaPct === null) {
    return (
      <span className="text-[11px] text-muted-foreground">Sin referencia previa</span>
    );
  }
  const positive = delta.deltaPct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
        positive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400'
      }`}
    >
      {positive ? (
        <TrendingUp className="w-3 h-3 shrink-0" />
      ) : (
        <TrendingDown className="w-3 h-3 shrink-0" />
      )}
      <span>
        {positive ? '+' : ''}
        {delta.deltaPct}% {suffix}
      </span>
    </span>
  );
}

function PrHighlightCard({
  pr,
  rank,
}: {
  pr: PersonalRecordItem;
  rank?: number;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {typeof rank === 'number' && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold tabular-nums shrink-0">
              #{rank}
            </span>
          )}
          <span className="text-xs font-bold text-foreground truncate">
            {pr.exerciseTitle}
          </span>
          <Badge variant="outline" className="text-[10px] font-medium">
            {pr.muscleGroup}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {pr.achievedAt} &middot; {pr.maxWeightKg} kg &times; {pr.repsAtMax} reps
          {pr.relativeStrengthRatio
            ? ` · ${pr.relativeStrengthRatio.toFixed(2)}x peso corporal`
            : ''}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 tabular-nums">
        <div className="text-left sm:text-right">
          <div className="text-sm font-black text-foreground">
            {pr.estimated1RMKg} kg{' '}
            <span className="text-[10px] font-semibold text-muted-foreground">e1RM</span>
          </div>
          {typeof pr.delta1RMKg === 'number' && pr.delta1RMKg > 0 && (
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              +{pr.delta1RMKg} kg mejora
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummarySkeletonView() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando resumen">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}

export function SummaryTab({ onNavigateToLive }: SummaryTabProps) {
  const [period, setPeriod] = useState<SummaryPeriod>('weekly');
  const [forceEmpty, setForceEmpty] = useState(false);
  const [monthlyBreakdownMode, setMonthlyBreakdownMode] = useState<'disciplines' | 'muscles'>(
    'disciplines'
  );

  const { stats, isLoading, isEmpty, simulateReload } = useTrainingSummary(period, {
    forceEmpty,
  });

  const periodSubtitle =
    period === 'weekly'
      ? `Semana en curso · ${stats.weekly.periodLabel}`
      : period === 'monthly'
      ? `Consistencia y carga combinada · ${stats.monthly.monthLabel}`
      : `Balance global y récords · Año ${stats.annual.year}`;

  return (
    <TooltipProvider>
      <div className="space-y-5 animate-in fade-in duration-150">
        {/* Estado Diario Garmin (Recuperación, Sueño, HRV y Body Battery) */}
        <GarminWellnessCard
          hideWeeklySportStrip
          forceEmpty={forceEmpty}
          fallbackSnapshot={DEMO_WELLNESS_SNAPSHOT}
          onSynced={() => simulateReload()}
        />

        {/* Cabecera Ejecutiva + Selector de Periodo sin saltos de layout */}
        <Card className="saas-card">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
                  <Activity className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Resumen de Entrenamiento</span>
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] font-semibold gap-1">
                  <Database className="w-3 h-3" />
                  <span>Demo · Esquema Supabase</span>
                </Badge>
              </div>
              <CardDescription className="text-xs">{periodSubtitle}</CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Segmented Control Semanal | Mensual | Anual */}
              <Tabs
                value={period}
                onValueChange={(val) => {
                  if (val === 'weekly' || val === 'monthly' || val === 'annual') {
                    setPeriod(val);
                  }
                }}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid grid-cols-3 sm:inline-flex group-data-horizontal/tabs:h-auto p-1 rounded-xl bg-muted/85 border border-border/70 w-full sm:w-auto">
                  <TabsTrigger
                    value="weekly"
                    className="h-10 px-3.5 py-2 text-xs font-semibold rounded-lg"
                  >
                    Semanal
                  </TabsTrigger>
                  <TabsTrigger
                    value="monthly"
                    className="h-10 px-3.5 py-2 text-xs font-semibold rounded-lg"
                  >
                    Mensual
                  </TabsTrigger>
                  <TabsTrigger
                    value="annual"
                    className="h-10 px-3.5 py-2 text-xs font-semibold rounded-lg"
                  >
                    Anual
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Controles de validación visual (Skeleton y Empty State) */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={simulateReload}
                  className="min-h-[40px] flex-1 sm:flex-none text-xs gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Recargar</span>
                </Button>
                <Button
                  type="button"
                  variant={forceEmpty ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setForceEmpty((prev) => !prev)}
                  className="min-h-[40px] flex-1 sm:flex-none text-xs"
                >
                  {forceEmpty ? 'Ver con datos' : 'Probar vacío'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Estado de Carga */}
        {isLoading ? (
          <SummarySkeletonView />
        ) : isEmpty ? (
          /* Estado Vacío Ilustrado con CTA */
          <Card className="saas-card">
            <CardContent className="py-12 px-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
                <BarChart3 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-foreground">
                  {period === 'weekly'
                    ? 'Aún no hay actividad registrada esta semana'
                    : period === 'monthly'
                    ? `Sin entrenamientos en ${stats.monthly.monthLabel}`
                    : `Sin histórico registrado en ${stats.annual.year}`}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Registra una sesión en Entreno en Vivo, sube tu historial o sincroniza tu Garmin para ver métricas cruzadas de fuerza, pulso Z1–Z5, peso corporal y récords.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                {onNavigateToLive && (
                  <Button
                    type="button"
                    onClick={onNavigateToLive}
                    className="min-h-[42px] gap-1.5 text-xs font-semibold"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Ir a Entreno en Vivo</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForceEmpty(false)}
                  className="min-h-[42px] text-xs font-semibold"
                >
                  Cargar datos demo
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : period === 'weekly' ? (
          /* ================================================================ */
          /* 1. VISTA SEMANAL                                                 */
          /* ================================================================ */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* KPIs Comparativos */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Card className="saas-card">
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Días Activos</span>
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-foreground tabular-nums">
                    {stats.weekly.activeDays}
                    <span className="text-xs font-medium text-muted-foreground">
                      {' '}
                      / {stats.weekly.targetDays} obj.
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      100,
                      Math.round((stats.weekly.activeDays / Math.max(1, stats.weekly.targetDays)) * 100)
                    )}
                    className="[&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-indicator]]:bg-blue-600"
                  />
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {stats.weekly.strengthSessions} fuerza &middot; {stats.weekly.garminSessions} Garmin
                  </div>
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Volumen Fuerza</span>
                    <Dumbbell className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-foreground tabular-nums">
                    {stats.weekly.strengthVolumeKg.current.toLocaleString('es-ES')} kg
                  </div>
                  <DeltaPill delta={stats.weekly.strengthVolumeKg} suffix="vs sem. ant." />
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    Racha activa: {stats.weekly.streakWeeks} semanas
                  </div>
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Actividad Garmin</span>
                    <Watch className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-foreground tabular-nums">
                    {stats.weekly.garminMinutes.current} min
                  </div>
                  <DeltaPill delta={stats.weekly.garminMinutes} suffix="vs sem. ant." />
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {stats.weekly.garminDistanceKm.current} km &middot;{' '}
                    {stats.weekly.caloriesBurned.toLocaleString('es-ES')} kcal
                  </div>
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Peso Corporal</span>
                    <Scale className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  {stats.weekly.bodyWeight.hasData ? (
                    <>
                      <div className="text-2xl font-black text-foreground tabular-nums">
                        {stats.weekly.bodyWeight.currentKg?.toFixed(1)} kg
                      </div>
                      <div
                        className={`text-[11px] font-semibold tabular-nums ${
                          (stats.weekly.bodyWeight.deltaKg ?? 0) <= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {(stats.weekly.bodyWeight.deltaKg ?? 0) > 0 ? '+' : ''}
                        {stats.weekly.bodyWeight.deltaKg?.toFixed(1)} kg esta semana
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        Inicio sem.: {stats.weekly.bodyWeight.startKg?.toFixed(1)} kg
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground pt-1">
                      Sin pesajes esta semana
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tira L-D Semanal sin recortes en móvil 390px */}
            <Card className="saas-card">
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-foreground">
                    Desglose Diario (Lunes a Domingo)
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {stats.weekly.periodLabel}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {stats.weekly.daysStrip.map((d) => {
                    const pillCls =
                      d.type === 'both'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : d.type === 'strength'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : d.type === 'garmin'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-muted/35 text-muted-foreground border-border/70';

                    return (
                      <div
                        key={d.date}
                        className={`rounded-xl border py-2.5 px-0.5 sm:px-1.5 text-center space-y-1 ${pillCls}`}
                        title={`${d.date}${d.topActivityLabel ? ` · ${d.topActivityLabel}` : ''}`}
                      >
                        <div className="text-xs font-bold">{d.shortWeekday}</div>
                        <div className="text-[9px] sm:text-[10px] font-medium leading-tight opacity-95 tabular-nums">
                          {d.type === 'both' ? (
                            'Doble'
                          ) : d.type === 'strength' ? (
                            <>
                              <span className="sm:hidden">Fza</span>
                              <span className="hidden sm:inline">
                                {Math.round(d.strengthVolumeKg / 100) / 10}t
                              </span>
                            </>
                          ) : d.type === 'garmin' ? (
                            <>
                              <span className="sm:hidden">{d.garminMinutes}m</span>
                              <span className="hidden sm:inline">{d.garminMinutes} min</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Zonas Z1-Z5 + PRs de los últimos 7 días */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="saas-card">
                <CardContent>
                  <HrZonesDistributionBar zones={stats.weekly.hrZones} />
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>PRs Batidos (Últimos 7 Días)</span>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-bold tabular-nums">
                      {stats.weekly.recentPRs.length} marcas
                    </Badge>
                  </div>

                  {stats.weekly.recentPRs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                      Sin récords nuevos en los últimos 7 días.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {stats.weekly.recentPRs.map((pr) => (
                        <PrHighlightCard key={pr.id} pr={pr} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : period === 'monthly' ? (
          /* ================================================================ */
          /* 2. VISTA MENSUAL                                                 */
          /* ================================================================ */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* KPIs Mensuales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Card className="saas-card">
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Consistencia</span>
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-foreground tabular-nums">
                    {stats.monthly.activeDays} días
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {stats.monthly.strengthSessions} fuerza &middot; {stats.monthly.garminSessions} Garmin
                  </div>
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Volumen Total</span>
                    <Dumbbell className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-foreground tabular-nums">
                    {Math.round(stats.monthly.totalVolumeKg.current / 100) / 10} t
                  </div>
                  <DeltaPill delta={stats.monthly.totalVolumeKg} suffix="vs mes ant." />
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Carga Garmin</span>
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-foreground tabular-nums">
                    {Math.round((stats.monthly.totalGarminMinutes / 60) * 10) / 10} h
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {stats.monthly.totalGarminDistanceKm} km recorridos
                  </div>
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Peso Corporal</span>
                    <Scale className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-black text-foreground tabular-nums">
                    {stats.monthly.bodyWeight.currentKg?.toFixed(1) ?? '—'} kg
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {stats.monthly.bodyWeight.deltaKg !== null
                      ? `${stats.monthly.bodyWeight.deltaKg > 0 ? '+' : ''}${stats.monthly.bodyWeight.deltaKg.toFixed(1)} kg este mes`
                      : 'Sin referencia'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Heatmap Mensual + Evolución por Semana */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="saas-card">
                <CardContent>
                  <ActivityHeatmapCalendar
                    monthLabel={stats.monthly.monthLabel}
                    leadingEmptyDays={stats.monthly.leadingEmptyDays}
                    calendarDays={stats.monthly.calendarDays}
                    activeDays={stats.monthly.activeDays}
                    totalSessions={stats.monthly.totalSessions}
                  />
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent>
                  <WeeklyEvolutionStackedChart weeks={stats.monthly.weeklyEvolution} />
                </CardContent>
              </Card>
            </div>

            {/* Tendencia Peso Corporal vs Volumen + Reparto Disciplinas/Músculos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="saas-card">
                <CardContent>
                  <BodyWeightVolumeChart
                    bodyWeight={stats.monthly.bodyWeight}
                    volumeSeries={stats.monthly.weeklyEvolution.map((w) => ({
                      label: w.weekLabel,
                      volumeKg: w.strengthVolumeKg,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Reparto de Carga del Mes</span>
                    </div>
                    <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border/60">
                      <Button
                        type="button"
                        size="xs"
                        variant={monthlyBreakdownMode === 'disciplines' ? 'secondary' : 'ghost'}
                        onClick={() => setMonthlyBreakdownMode('disciplines')}
                        className="text-[11px] font-semibold px-2.5"
                      >
                        Disciplinas
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant={monthlyBreakdownMode === 'muscles' ? 'secondary' : 'ghost'}
                        onClick={() => setMonthlyBreakdownMode('muscles')}
                        className="text-[11px] font-semibold px-2.5"
                      >
                        Músculos
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(monthlyBreakdownMode === 'disciplines'
                      ? stats.monthly.disciplineBreakdown
                      : stats.monthly.muscleGroupBreakdown
                    ).map((item) => (
                      <div key={item.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <span className="font-semibold text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">
                            {item.volumeKg
                              ? `${item.volumeKg.toLocaleString('es-ES')} kg`
                              : `${item.minutes} min`}{' '}
                            &middot; <strong className="text-foreground">{item.pct}%</strong>
                          </span>
                        </div>
                        <Progress
                          value={item.pct}
                          className={
                            item.category === 'strength'
                              ? '[&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-indicator]]:bg-blue-600'
                              : '[&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-indicator]]:bg-emerald-500'
                          }
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mejores Marcas y Progresión del Mes */}
            <Card className="saas-card">
              <CardContent className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Mejores Marcas y Progresión ({stats.monthly.monthLabel})</span>
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-bold tabular-nums">
                    Top {stats.monthly.topPRs.length} ejercicios
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {stats.monthly.topPRs.map((pr, idx) => (
                    <PrHighlightCard key={pr.id} pr={pr} rank={idx + 1} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* ================================================================ */
          /* 3. VISTA ANUAL                                                   */
          /* ================================================================ */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Hero Ejecutivo Anual */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 border border-slate-800 shadow-lg space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Resumen Ejecutivo Anual {stats.annual.year}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-300 tabular-nums">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Racha máx:{' '}
                    <strong className="text-white">
                      {stats.annual.longestStreakDays} días
                    </strong>{' '}
                    ({stats.annual.longestStreakWeeks} sems)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                  <div className="text-[11px] text-slate-300">Sesiones Totales</div>
                  <div className="text-2xl font-black mt-1">{stats.annual.totalSessions}</div>
                  <div className="text-[11px] text-slate-400">
                    {stats.annual.strengthSessions} fuerza &middot; {stats.annual.garminSessions} Garmin
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                  <div className="text-[11px] text-slate-300">Toneladas Levantadas</div>
                  <div className="text-2xl font-black text-blue-400 mt-1">
                    {stats.annual.totalTonnesLifted} t
                  </div>
                  <div className="text-[11px] text-slate-400">Volumen acumulado</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                  <div className="text-[11px] text-slate-300">Actividad Garmin</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">
                    {stats.annual.totalGarminHours} h
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {stats.annual.totalGarminDistanceKm} km totales
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                  <div className="text-[11px] text-slate-300">Mejor Mes</div>
                  <div className="text-lg sm:text-xl font-black text-amber-400 mt-1">
                    {stats.annual.bestMonth?.label ?? '—'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {stats.annual.bestMonth
                      ? `${stats.annual.bestMonth.sessions} ses. · ${stats.annual.bestMonth.tonnes} t`
                      : 'Sin datos'}
                  </div>
                </div>
              </div>
            </div>

            {/* Comparativa 12 Meses + Peso Corporal Anual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="saas-card">
                <CardContent>
                  <AnnualMonthlyComparisonChart
                    months={stats.annual.monthlyComparison}
                    bestMonthLabel={stats.annual.bestMonth?.label}
                  />
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent>
                  <AnnualBodyWeightChart bodyWeight={stats.annual.bodyWeight} />
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Zonas Z1-Z5 Anuales + Cuadro de Honor PRs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="saas-card">
                <CardContent>
                  <HrZonesDistributionBar
                    zones={stats.annual.hrZones}
                    title={`Distribución Anual de Zonas Cardíacas (${stats.annual.year})`}
                  />
                </CardContent>
              </Card>

              <Card className="saas-card">
                <CardContent className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Award className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Cuadro de Honor · PRs {stats.annual.year}</span>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-bold tabular-nums">
                      Top {stats.annual.hallOfFamePRs.length}
                    </Badge>
                  </div>
                  <div className="space-y-2.5">
                    {stats.annual.hallOfFamePRs.map((pr, idx) => (
                      <PrHighlightCard key={pr.id} pr={pr} rank={idx + 1} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
