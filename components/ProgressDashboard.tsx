'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  Trophy,
  Flame,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Upload,
  Download,
  RefreshCw,
  BarChart2,
  Zap,
  Info,
  Trash2,
  FileSpreadsheet,
  Cloud,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import {
  extractProgressFromHevyCSV,
  ExerciseStatsSummary,
  ExerciseSessionProgress,
  computeLinearTrend,
} from '@/lib/progress-analyzer';
import { analyzeWeeklyMuscleBalance, MuscleVolumeStatus } from '@/lib/weekly-volume-analyzer';
import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';
import { getSimilarExercises } from '@/lib/exercise-alternatives';
import {
  isSupabaseConfigured,
  getWorkoutLogsCsvFromSupabase,
  syncWorkoutLogsToSupabase,
  parseCsvToDbLogs
} from '@/lib/supabase';

type MetricMode = 'maxWeight' | 'estimated1RM' | 'totalVolume' | 'bestSetVolume';
type TimeRangeMode = '1M' | '3M' | '6M' | 'ALL';

export default function ProgressDashboard() {
  const [csvRaw, setCsvRaw] = useState<string>('');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [metric, setMetric] = useState<MetricMode>('maxWeight');
  const [timeRange, setTimeRange] = useState<TimeRangeMode>('ALL');
  const [hoveredPoint, setHoveredPoint] = useState<ExerciseSessionProgress | null>(null);
  const [searchExercise, setSearchExercise] = useState<string>('');
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [hasCloudSource, setHasCloudSource] = useState<boolean>(false);
  const [muscleBalance, setMuscleBalance] = useState<MuscleVolumeStatus[]>([]);
  const [confirmClearHistory, setConfirmClearHistory] = useState<boolean>(false);

  useEffect(() => {
    setMuscleBalance(analyzeWeeklyMuscleBalance());
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar datos: primero desde Supabase si está disponible, luego fallback a localStorage
  useEffect(() => {
    async function loadData() {
      if (isSupabaseConfigured()) {
        try {
          const cloudCsv = await getWorkoutLogsCsvFromSupabase();
          if (cloudCsv && cloudCsv.length > 50) {
            setCsvRaw(cloudCsv);
            setHasCloudSource(true);
            return;
          }
        } catch (e) {
          console.warn('No se pudo conectar a Supabase:', e);
        }
      }

      try {
        const savedCsv = localStorage.getItem('hevy_raw_csv_cache');
        if (savedCsv && savedCsv.trim().length > 50) {
          setCsvRaw(savedCsv);
          setHasCloudSource(false);
        }
      } catch (e) {
        // ignore
      }
    }

    loadData();
  }, []);

  // Extraer analíticas cada vez que cambia el CSV
  const analytics = useMemo(() => {
    if (!csvRaw) return { exercises: [], exerciseStatsMap: {}, globalVolumeByDate: {} };
    return extractProgressFromHevyCSV(csvRaw);
  }, [csvRaw]);

  // Seleccionar primer ejercicio si no hay ninguno seleccionado
  useEffect(() => {
    if (analytics.exercises.length > 0 && !analytics.exercises.includes(selectedExercise)) {
      setSelectedExercise(analytics.exercises[0]);
    }
  }, [analytics.exercises, selectedExercise]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const text = event.target?.result as string;
      if (text && text.includes('exercise_title')) {
        setCsvRaw(text);
        try {
          localStorage.setItem('hevy_raw_csv_cache', text);
        } catch (e) {
          // ignore
        }

        // Si Supabase está configurado, guardar en la nube
        if (isSupabaseConfigured()) {
          setIsCloudSyncing(true);
          try {
            const logs = parseCsvToDbLogs(text);
            if (logs.length > 0) {
              const ok = await syncWorkoutLogsToSupabase(logs);
              if (ok) setHasCloudSource(true);
            }
          } catch (err) {
            console.error('Error al guardar en Supabase:', err);
          } finally {
            setIsCloudSyncing(false);
          }
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClearHistory = () => {
    setCsvRaw('');
    setSelectedExercise('');
    setConfirmClearHistory(false);
    try {
      localStorage.removeItem('hevy_raw_csv_cache');
    } catch (e) {
      // ignore
    }
  };

  const currentStats: ExerciseStatsSummary | undefined = analytics.exerciseStatsMap[selectedExercise];

  // Filtrar lista de ejercicios en el buscador
  const filteredExercises = useMemo(() => {
    if (!searchExercise.trim()) return analytics.exercises;
    return analytics.exercises.filter(ex =>
      ex.toLowerCase().includes(searchExercise.toLowerCase())
    );
  }, [analytics.exercises, searchExercise]);

  // Cálculos para la gráfica SVG interactiva con filtro temporal y regresión lineal
  const chartData = useMemo(() => {
    if (!currentStats || currentStats.progression.length === 0) return null;

    let filteredProg = currentStats.progression;
    if (timeRange !== 'ALL') {
      const daysBack = timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : 180;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);
      const cutoffIso = cutoff.toISOString().slice(0, 10);
      const subset = currentStats.progression.filter((p) => p.date >= cutoffIso);
      if (subset.length > 0) filteredProg = subset;
    }

    const dataPoints = filteredProg.map(p => {
      let val = 0;
      if (metric === 'maxWeight') val = p.maxWeight;
      else if (metric === 'estimated1RM') val = p.bestEstimated1RM;
      else if (metric === 'totalVolume') val = p.totalVolume;
      else if (metric === 'bestSetVolume') val = p.bestSetVolume;
      return {
        raw: p,
        value: val,
        date: p.formattedDate
      };
    });

    const values = dataPoints.map(d => d.value);
    const minVal = Math.max(0, Math.min(...values) * 0.9);
    const maxVal = Math.max(...values) * 1.08 || 10;
    const trend = computeLinearTrend(values);

    return {
      points: dataPoints,
      minVal,
      maxVal,
      range: maxVal - minVal || 1,
      trend,
    };
  }, [currentStats, metric, timeRange]);

  // Porcentaje de cambio
  const percentageChange = useMemo(() => {
    if (!chartData || chartData.points.length < 2) return null;
    const first = chartData.points[0].value;
    const last = chartData.points[chartData.points.length - 1].value;
    if (first === 0) return null;
    const diff = last - first;
    const pct = ((diff / first) * 100).toFixed(1);
    return { diff: Math.round(diff * 10) / 10, pct };
  }, [chartData]);

  const metricLabels: Record<MetricMode, { title: string; unit: string; desc: string }> = {
    maxWeight: {
      title: 'Peso Máximo Levantado',
      unit: 'kg',
      desc: 'Carga más pesada registrada en cada sesión'
    },
    estimated1RM: {
      title: '1RM Estimado (Fuerza Máx)',
      unit: 'kg',
      desc: 'Repetición máxima calculada según la fórmula Epley'
    },
    totalVolume: {
      title: 'Volumen Total de la Sesión',
      unit: 'kg',
      desc: 'Suma de todos los kg movidos en el ejercicio durante el día'
    },
    bestSetVolume: {
      title: 'Mejor Serie en Volumen',
      unit: 'kg',
      desc: 'Serie con mayor tonelaje (Peso × Repeticiones)'
    }
  };

  const renderMuscleBalanceCard = () => {
    if (muscleBalance.length === 0) return null;
    const deficitMuscles = muscleBalance.filter((m) => m.status === 'deficit');

    return (
      <section className="bg-card rounded-2xl border border-border/60 p-5 sm:p-6 saas-card space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <span>Balance de Volumen Semanal (Series Efectivas)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparativa entre tus series semanales (Plan Semanal + Entreno en Vivo) y el rango óptimo de hipertrofia.
            </p>
          </div>
          {deficitMuscles.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{deficitMuscles.length} grupos con margen de estímulo</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {muscleBalance.map((m) => {
            const effective = Math.max(m.plannedSets, m.recordedSets);
            const pct = Math.min(100, Math.round((effective / m.targetMax) * 100));
            return (
              <div
                key={m.muscle}
                className="p-3.5 rounded-xl bg-muted/25 border border-border/60 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{m.muscle}</span>
                  <span
                    className={`font-semibold tabular-nums inline-flex items-center gap-1 ${
                      m.status === 'deficit'
                        ? 'text-amber-700 dark:text-amber-400'
                        : m.status === 'optimal'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {m.status === 'optimal' && <CheckCircle2 className="w-3 h-3" />}
                    {effective} / {m.targetMin}-{m.targetMax} series
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      m.status === 'deficit'
                        ? 'bg-amber-500'
                        : m.status === 'optimal'
                        ? 'bg-emerald-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {m.recordedSets} hechas &middot; {m.plannedSets} planificadas
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  if (!csvRaw || analytics.exercises.length === 0) {
    return (
      <div className="space-y-6">
        {renderMuscleBalanceCard()}
        <div className="bg-card rounded-2xl border border-border/80 p-8 sm:p-12 text-center saas-card max-w-xl mx-auto my-4 animate-in fade-in duration-150">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-5 border border-blue-500/30 shadow-xs">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">
          Sin historial por ejercicio cargado
        </h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Para analizar cargas máximas, 1RM estimado, alertas de estancamiento y series históricas por ejercicio, registra tus sesiones en Entreno en Vivo o sube tu CSV de Hevy.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            <span>Subir workouts.csv de Hevy</span>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-border/60 text-left">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            ¿Cómo exportar desde Hevy?
          </h4>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Abre Hevy en tu móvil y entra en tu <strong>Perfil</strong>.</li>
            <li>Toca en <strong>Ajustes</strong> (icono de engranaje).</li>
            <li>Baja hasta <strong>Exportar datos</strong> y descarga el archivo CSV.</li>
          </ol>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".csv,text/csv"
          className="hidden"
        />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {renderMuscleBalanceCard()}
      {/* Barra de Origen de Datos */}
      <div className="bg-card rounded-xl border border-border/80 p-4 saas-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground flex flex-wrap items-center gap-2">
                <span>Origen de Datos:</span>
                {hasCloudSource ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Supabase Cloud
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                    Historial Local (Hevy)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {analytics.exercises.length} ejercicios detectados en tu historial.
                {isCloudSyncing && ' (Sincronizando con Supabase...)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="saas-btn min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Actualizar workouts.csv</span>
            </button>
            {confirmClearHistory ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="min-h-[40px] px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearHistory(false)}
                  className="min-h-[40px] px-2.5 py-1 rounded-lg bg-muted hover:bg-accent text-foreground text-xs font-medium border border-border/80"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearHistory(true)}
                title="Borrar historial guardado"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-muted-foreground hover:text-rose-600 rounded-lg border border-border/80 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,text/csv"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Selector de Ejercicio y Métrica */}
      <div className="bg-card rounded-xl border border-border/80 p-5 saas-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Selector de Ejercicio con Buscador */}
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Ejercicio para Analizar
            </label>
            <div className="relative">
              <select
                value={selectedExercise}
                onChange={e => setSelectedExercise(e.target.value)}
                className="w-full min-h-[42px] bg-background hover:bg-muted/40 border border-border/80 rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all cursor-pointer"
              >
                {filteredExercises.map(ex => (
                  <option key={ex} value={ex}>
                    {ex} ({analytics.exerciseStatsMap[ex]?.totalSessions} sesiones)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selector de Métrica */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Métrica de Visualización
            </label>
            <div className="flex flex-wrap items-center gap-1.5 bg-muted p-1 rounded-xl border border-border/70">
              {(['maxWeight', 'estimated1RM', 'totalVolume', 'bestSetVolume'] as MetricMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    metric === m
                      ? 'bg-card text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'maxWeight' && 'Peso Máximo'}
                  {m === 'estimated1RM' && '1RM Estimado'}
                  {m === 'totalVolume' && 'Volumen Diario'}
                  {m === 'bestSetVolume' && 'Serie Más Fuerte'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resumen Superior del Ejercicio Seleccionado */}
        {currentStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border/60">
            {/* PR Peso Máximo */}
            <div className="bg-muted/35 rounded-xl p-3 border border-border/70">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase">Récord de Carga</span>
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums mt-1">
                {currentStats.allTimeMaxWeight.weight} <span className="text-xs font-normal text-muted-foreground">kg</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {currentStats.allTimeMaxWeight.date || 'Sin fecha'}
              </div>
            </div>

            {/* 1RM Estimado */}
            <div className="bg-muted/35 rounded-xl p-3 border border-border/70">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase">1RM Pico</span>
                <Zap className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums mt-1">
                {currentStats.allTimeEstimated1RM.e1rm} <span className="text-xs font-normal text-muted-foreground">kg</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {currentStats.allTimeEstimated1RM.weight}k × {currentStats.allTimeEstimated1RM.reps}r
              </div>
            </div>

            {/* Mejor Serie en Volumen */}
            <div className="bg-muted/35 rounded-xl p-3 border border-border/70">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase">Mejor Serie Tonelaje</span>
                <Flame className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums mt-1">
                {currentStats.allTimeMaxSetVolume.volume} <span className="text-xs font-normal text-muted-foreground">kg</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {currentStats.allTimeMaxSetVolume.weight}k × {currentStats.allTimeMaxSetVolume.reps}r
              </div>
            </div>

            {/* Sesiones y Progreso */}
            <div className="bg-muted/35 rounded-xl p-3 border border-border/70">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase">Sesiones</span>
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums mt-1">
                {currentStats.totalSessions}
              </div>
              {percentageChange ? (
                <div
                  className={`text-[10px] font-bold flex items-center gap-0.5 mt-0.5 ${
                    percentageChange.diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {percentageChange.diff >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span>
                    {percentageChange.diff >= 0 ? '+' : ''}
                    {percentageChange.pct}% ({percentageChange.diff > 0 ? '+' : ''}
                    {percentageChange.diff}kg)
                  </span>
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground mt-0.5">Primer registro</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gráfica Interactiva SVG */}
      <div className="bg-card rounded-xl border border-border/80 p-5 sm:p-6 saas-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{metricLabels[metric].title}</span>
              </h3>
              {chartData?.trend && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    chartData.trend.isPlateau
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                      : chartData.trend.direction === 'up'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : chartData.trend.direction === 'down'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {chartData.trend.isPlateau
                    ? 'Meseta detectada (3 ses.)'
                    : `Tendencia: ${chartData.trend.deltaPct >= 0 ? '+' : ''}${chartData.trend.deltaPct}%`}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{metricLabels[metric].desc}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-lg border border-border/70">
              {(['1M', '3M', '6M', 'ALL'] as TimeRangeMode[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    timeRange === r
                      ? 'bg-card text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r === 'ALL' ? 'Todo' : r}
                </button>
              ))}
            </div>

            {hoveredPoint && (
              <div className="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-right animate-in fade-in duration-100">
                <div className="text-xs font-black text-blue-900 dark:text-blue-200 tabular-nums">
                  {metric === 'maxWeight' && `${hoveredPoint.maxWeight} kg`}
                  {metric === 'estimated1RM' && `${hoveredPoint.bestEstimated1RM} kg`}
                  {metric === 'totalVolume' && `${hoveredPoint.totalVolume} kg`}
                  {metric === 'bestSetVolume' && `${hoveredPoint.bestSetVolume} kg`}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400">{hoveredPoint.formattedDate}</div>
              </div>
            )}
          </div>
        </div>

        {/* Contenedor del Lienzo SVG */}
        <div className="w-full h-64 sm:h-72 relative pt-2">
          {chartData && chartData.points.length > 0 ? (
            <svg
              viewBox="0 0 800 280"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Líneas de Guía Horizontales */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 240 - ratio * 200;
                const val = Math.round(chartData.minVal + ratio * chartData.range);
                return (
                  <g key={idx}>
                    <line
                      x1="40"
                      y1={y}
                      x2="780"
                      y2={y}
                      stroke="currentColor"
                      className="text-border"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="32"
                      y={y + 4}
                      fill="currentColor"
                      className="text-muted-foreground"
                      fontSize="10"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Trazado del Área y Línea */}
              {(() => {
                const n = chartData.points.length;
                const coords = chartData.points.map((p, idx) => {
                  const x = n === 1 ? 400 : 50 + (idx / (n - 1)) * 720;
                  const y = 240 - ((p.value - chartData.minVal) / chartData.range) * 200;
                  return { x, y, raw: p.raw, val: p.value };
                });

                const linePath = coords.reduce((acc, c, idx) => {
                  return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
                }, '');

                const areaPath = `${linePath} L ${coords[coords.length - 1].x} 240 L ${coords[0].x} 240 Z`;

                return (
                  <>
                    {/* Área sombreada */}
                    <path d={areaPath} fill="url(#chartGradient)" />

                    {/* Línea de tendencia (regresión lineal) */}
                    {chartData.trend && n >= 2 && (
                      <line
                        x1={coords[0].x}
                        y1={240 - ((chartData.trend.startY - chartData.minVal) / chartData.range) * 200}
                        x2={coords[coords.length - 1].x}
                        y2={240 - ((chartData.trend.endY - chartData.minVal) / chartData.range) * 200}
                        stroke="#10B981"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Línea principal */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Puntos Interactivos */}
                    {coords.map((c, idx) => (
                      <g
                        key={idx}
                        className="cursor-pointer group"
                        onMouseEnter={() => setHoveredPoint(c.raw)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={n > 30 ? 3 : 5}
                          fill="#FFFFFF"
                          stroke="#2563EB"
                          strokeWidth="2.5"
                          className="transition-transform group-hover:scale-150"
                        />
                        {/* Etiqueta de fecha en el eje X */}
                        {(idx === 0 || idx === n - 1 || idx % Math.ceil(n / 6) === 0) && (
                          <text
                            x={c.x}
                            y="265"
                            fill="currentColor"
                            className="text-muted-foreground"
                            fontSize="10"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            {c.raw.formattedDate}
                          </text>
                        )}
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No hay datos suficientes para graficar este ejercicio.
            </div>
          )}
        </div>
      </div>

      {/* Rotación Inteligente ante Mesetas */}
      {chartData?.trend?.isPlateau && (() => {
        const matchedCatalog = EXERCISE_CATALOG.find(
          (e) => e.name.toLowerCase() === selectedExercise.toLowerCase()
        );
        const alternatives = matchedCatalog
          ? getSimilarExercises(matchedCatalog.id).slice(0, 3)
          : [];
        if (alternatives.length === 0) return null;
        return (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                  Meseta detectada en {selectedExercise} (últimas 3 sesiones)
                </h4>
                <p className="text-xs text-amber-900/85 dark:text-amber-200/80 mt-0.5">
                  Según la evidencia de periodización, rotar a una variante biomecánicamente equivalente reactiva la progresión sin perder el estímulo muscular:
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {alternatives.map((alt) => (
                <div
                  key={alt.exercise.id}
                  className="rounded-lg bg-card border border-amber-500/30 p-3 space-y-1"
                >
                  <div className="text-xs font-bold text-foreground">{alt.exercise.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {alt.exercise.equipment} &bull; {alt.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Historial Detallado de Sesiones para este Ejercicio */}
      {currentStats && (
        <div className="bg-card rounded-xl border border-border/80 p-5 saas-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground text-sm">Historial Cronológico de Sesiones</h4>
            <span className="text-xs text-muted-foreground font-medium">
              {currentStats.progression.length} registros
            </span>
          </div>

          <div className="divide-y divide-border/60 border border-border/80 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {currentStats.progression
              .slice()
              .reverse()
              .map((s, idx) => (
                <div
                  key={idx}
                  className="p-3 sm:px-4 flex items-center justify-between hover:bg-muted/40 transition-colors text-xs"
                >
                  <div>
                    <span className="font-bold text-foreground text-sm">{s.formattedDate}</span>
                    <span className="text-muted-foreground ml-2 font-medium">({s.workoutTitle})</span>
                    <div className="text-muted-foreground text-[11px] mt-0.5">
                      {s.setsCount} series registradas · {s.totalReps} repeticiones totales
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-foreground text-sm tabular-nums">
                      {s.maxWeight} kg <span className="text-[10px] text-muted-foreground font-normal">máx</span>
                    </div>
                    <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold font-mono tabular-nums">
                      {s.totalVolume} kg vol.
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
