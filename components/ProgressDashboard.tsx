'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  Trophy,
  Flame,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Upload,
  RefreshCw,
  BarChart2,
  Zap,
  Info,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';
import {
  extractProgressFromHevyCSV,
  ExerciseStatsSummary,
  ExerciseSessionProgress
} from '@/lib/progress-analyzer';

type MetricMode = 'maxWeight' | 'estimated1RM' | 'totalVolume' | 'bestSetVolume';

export default function ProgressDashboard() {
  const [csvRaw, setCsvRaw] = useState<string>('');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [metric, setMetric] = useState<MetricMode>('maxWeight');
  const [hoveredPoint, setHoveredPoint] = useState<ExerciseSessionProgress | null>(null);
  const [searchExercise, setSearchExercise] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar CSV guardado en localStorage
  useEffect(() => {
    try {
      const savedCsv = localStorage.getItem('hevy_raw_csv_cache');
      if (savedCsv && savedCsv.trim().length > 50) {
        setCsvRaw(savedCsv);
      }
    } catch (e) {
      // ignore
    }
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
    reader.onload = event => {
      const text = event.target?.result as string;
      if (text && text.includes('exercise_title')) {
        setCsvRaw(text);
        try {
          localStorage.setItem('hevy_raw_csv_cache', text);
        } catch (e) {
          // ignore
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClearHistory = () => {
    if (window.confirm('¿Seguro que deseas eliminar los datos de entrenamiento guardados?')) {
      setCsvRaw('');
      setSelectedExercise('');
      try {
        localStorage.removeItem('hevy_raw_csv_cache');
      } catch (e) {
        // ignore
      }
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

  // Cálculos para la gráfica SVG interactiva
  const chartData = useMemo(() => {
    if (!currentStats || currentStats.progression.length === 0) return null;

    const dataPoints = currentStats.progression.map(p => {
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

    return {
      points: dataPoints,
      minVal,
      maxVal,
      range: maxVal - minVal || 1
    };
  }, [currentStats, metric]);

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

  if (!csvRaw || analytics.exercises.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] max-w-xl mx-auto my-8 animate-in fade-in duration-150">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5 border border-blue-100 shadow-xs">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Sin datos de entrenamientos aún
        </h3>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Para ver tus gráficos de evolución, cargas máximas, 1RM estimado y volumen por ejercicio, sube tu archivo exportado de Hevy.
        </p>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] min-h-[44px]"
        >
          <Upload className="w-4 h-4" />
          <span>Subir workouts.csv de Hevy</span>
        </button>

        <div className="mt-8 pt-6 border-t border-slate-100 text-left">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            ¿Cómo exportar desde Hevy?
          </h4>
          <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside">
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
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Barra de Origen de Datos */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
              <span>Origen de Datos:</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Tu Historial de Hevy
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {analytics.exercises.length} ejercicios detectados en tu historial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Actualizar workouts.csv</span>
          </button>
          <button
            onClick={handleClearHistory}
            title="Borrar historial guardado"
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,text/csv"
            className="hidden"
          />
        </div>
      </div>

      {/* Selector de Ejercicio y Métrica */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Selector de Ejercicio con Buscador */}
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Ejercicio para Analizar
            </label>
            <div className="relative">
              <select
                value={selectedExercise}
                onChange={e => setSelectedExercise(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                {filteredExercises.map(ex => (
                  <option key={ex} value={ex}>
                    {ex} ({analytics.exerciseStatsMap[ex]?.totalSessions} sesiones)
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Selector de Métrica */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Métrica de Visualización
            </label>
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
              {(['maxWeight', 'estimated1RM', 'totalVolume', 'bestSetVolume'] as MetricMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    metric === m
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            {/* PR Peso Máximo */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase">Récord de Carga</span>
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums mt-1">
                {currentStats.allTimeMaxWeight.weight} <span className="text-xs font-normal text-slate-500">kg</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {currentStats.allTimeMaxWeight.date || 'Sin fecha'}
              </div>
            </div>

            {/* 1RM Estimado */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase">1RM Pico</span>
                <Zap className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums mt-1">
                {currentStats.allTimeEstimated1RM.e1rm} <span className="text-xs font-normal text-slate-500">kg</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {currentStats.allTimeEstimated1RM.weight}k × {currentStats.allTimeEstimated1RM.reps}r
              </div>
            </div>

            {/* Mejor Serie en Volumen */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase">Mejor Serie Tonelaje</span>
                <Flame className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums mt-1">
                {currentStats.allTimeMaxSetVolume.volume} <span className="text-xs font-normal text-slate-500">kg</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {currentStats.allTimeMaxSetVolume.weight}k × {currentStats.allTimeMaxSetVolume.reps}r
              </div>
            </div>

            {/* Sesiones y Progreso */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase">Sesiones</span>
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums mt-1">
                {currentStats.totalSessions}
              </div>
              {percentageChange ? (
                <div
                  className={`text-[10px] font-bold flex items-center gap-0.5 mt-0.5 ${
                    percentageChange.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'
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
                <div className="text-[10px] text-slate-400 mt-0.5">Primer registro</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gráfica Interactiva SVG */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>{metricLabels[metric].title}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{metricLabels[metric].desc}</p>
          </div>

          {hoveredPoint && (
            <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200/80 text-right animate-in fade-in duration-100">
              <div className="text-xs font-black text-blue-900 tabular-nums">
                {metric === 'maxWeight' && `${hoveredPoint.maxWeight} kg`}
                {metric === 'estimated1RM' && `${hoveredPoint.bestEstimated1RM} kg`}
                {metric === 'totalVolume' && `${hoveredPoint.totalVolume} kg`}
                {metric === 'bestSetVolume' && `${hoveredPoint.bestSetVolume} kg`}
              </div>
              <div className="text-[10px] text-blue-600">{hoveredPoint.formattedDate}</div>
            </div>
          )}
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
                      stroke="#F1F5F9"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text x="32" y={y + 4} fill="#94A3B8" fontSize="10" textAnchor="end" fontFamily="monospace">
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
                            fill="#64748B"
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
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              No hay datos suficientes para graficar este ejercicio.
            </div>
          )}
        </div>
      </div>

      {/* Historial Detallado de Sesiones para este Ejercicio */}
      {currentStats && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">Historial Cronológico de Sesiones</h4>
            <span className="text-xs text-slate-500 font-medium">
              {currentStats.progression.length} registros
            </span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {currentStats.progression
              .slice()
              .reverse()
              .map((s, idx) => (
                <div
                  key={idx}
                  className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{s.formattedDate}</span>
                    <span className="text-slate-400 ml-2 font-medium">({s.workoutTitle})</span>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {s.setsCount} series registradas · {s.totalReps} repeticiones totales
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      {s.maxWeight} kg <span className="text-[10px] text-slate-400 font-normal">máx</span>
                    </div>
                    <div className="text-[11px] text-blue-600 font-semibold font-mono">
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
