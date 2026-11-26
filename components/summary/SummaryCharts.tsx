'use client';

import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar as CalendarIcon,
  Dumbbell,
  Flame,
  HeartPulse,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  BodyWeightSummary,
  CalendarActivityDay,
  DaySessionsBundle,
  HeartRateZoneBucket,
} from '@/lib/summary-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DaySessionsPanel } from '@/components/summary/DaySessionsPanel';

const ZONE_COLORS: Record<number, { bar: string; dot: string; text: string }> = {
  1: {
    bar: 'bg-slate-400 dark:bg-slate-500',
    dot: 'bg-slate-400 dark:bg-slate-500',
    text: 'text-slate-600 dark:text-slate-300',
  },
  2: {
    bar: 'bg-blue-500',
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
  },
  3: {
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  4: {
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  5: {
    bar: 'bg-rose-500',
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
};

export function HrZonesDistributionBar({
  zones,
  title = 'Distribución de Zonas de Pulso (Garmin Z1–Z5)',
}: {
  zones: HeartRateZoneBucket[];
  title?: string;
}) {
  if (!zones || zones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center space-y-2">
        <HeartPulse className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-xs font-semibold text-foreground">Sin datos de frecuencia cardíaca</p>
        <p className="text-[11px] text-muted-foreground">
          Sincroniza actividades de Garmin con sensor óptico o banda para desglosar Z1–Z5.
        </p>
      </div>
    );
  }

  const totalMinutes = zones.reduce((acc, z) => acc + z.minutes, 0);
  const dominant = zones.reduce((best, z) => (z.minutes > best.minutes ? z : best), zones[0]);
  const highIntensityPct = zones
    .filter((z) => z.zone >= 4)
    .reduce((acc, z) => acc + z.pct, 0);
  const isEstimated = zones.some((z) => z.source === 'estimated_from_avg_hr');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <HeartPulse className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isEstimated && (
            <Badge variant="outline" className="text-[10px] font-medium">
              Estimado por FC media
            </Badge>
          )}
          <Badge variant="secondary" className="text-[11px] font-semibold tabular-nums">
            {totalMinutes} min totales
          </Badge>
        </div>
      </div>

      {/* Barra apilada Z1-Z5 */}
      <div
        className="h-3.5 w-full rounded-full overflow-hidden flex bg-muted border border-border/50"
        role="img"
        aria-label="Distribución porcentual de zonas cardíacas Z1 a Z5"
      >
        {zones.map((z) => {
          if (z.pct <= 0) return null;
          const colors = ZONE_COLORS[z.zone] || ZONE_COLORS[2];
          return (
            <div
              key={z.zone}
              style={{ width: `${z.pct}%` }}
              className={`${colors.bar} h-full transition-all duration-300 border-r border-background/40 last:border-r-0`}
              title={`${z.label}: ${z.minutes} min (${z.pct}%)`}
            />
          );
        })}
      </div>

      {/* Desglose tabular Z1-Z5 */}
      <div className="space-y-2">
        {zones.map((z) => {
          const colors = ZONE_COLORS[z.zone] || ZONE_COLORS[2];
          return (
            <div
              key={z.zone}
              className="grid grid-cols-[minmax(0,1.4fr)_auto_auto] items-center gap-3 text-xs tabular-nums"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot}`} />
                <span className="font-semibold text-foreground truncate">{z.label}</span>
                <span className="hidden sm:inline text-[11px] text-muted-foreground">
                  ({z.bpmRange})
                </span>
              </div>
              <span className="text-muted-foreground font-medium text-right">
                {z.minutes} min
              </span>
              <span className={`font-bold text-right w-10 ${colors.text}`}>{z.pct}%</span>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">
          Zona dominante:{' '}
          <strong className="text-foreground">{dominant.label}</strong> ({dominant.pct}%)
        </span>
        <span className="font-semibold text-foreground tabular-nums">
          Alta intensidad (Z4–Z5): {highIntensityPct}%
        </span>
      </div>
    </div>
  );
}

export function ActivityHeatmapCalendar({
  monthLabel,
  leadingEmptyDays,
  calendarDays,
  activeDays,
  totalSessions,
  daySessionsMap = {},
  onSessionsChanged,
}: {
  monthLabel: string;
  leadingEmptyDays: number;
  calendarDays: CalendarActivityDay[];
  activeDays: number;
  totalSessions: number;
  daySessionsMap?: Record<string, DaySessionsBundle>;
  onSessionsChanged?: () => Promise<void> | void;
}) {
  const defaultSelected =
    [...calendarDays].reverse().find((d) => !d.isFuture && d.type !== 'none')?.date ?? null;
  const [selectedDate, setSelectedDate] = useState<string | null>(defaultSelected);
  const selectedDay = calendarDays.find((d) => d.date === selectedDate) ?? null;
  const selectedBundle = selectedDate ? daySessionsMap[selectedDate] : undefined;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Heatmap de Consistencia · {monthLabel}</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
          {activeDays} días activos &middot; {totalSessions} sesiones
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
        {Array.from({ length: leadingEmptyDays }).map((_, i) => (
          <div key={`lead-${i}`} className="h-9" />
        ))}
        {calendarDays.map((day) => {
          const isSelected = selectedDate === day.date;
          const colorCls = day.isFuture
            ? 'bg-muted/20 text-muted-foreground/45 border-border/40'
            : day.type === 'both'
            ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
            : day.type === 'strength'
            ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
            : day.type === 'garmin'
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
            : 'bg-muted/45 text-muted-foreground border-border/60 hover:bg-muted';

          return (
            <button
              key={day.date}
              type="button"
              onClick={() =>
                setSelectedDate((prev) => (prev === day.date ? null : day.date))
              }
              aria-label={`${day.date}: ${
                day.isFuture ? 'Día futuro' : day.topActivityLabel || 'Descanso'
              }`}
              className={`h-9 rounded-lg border text-xs font-bold tabular-nums transition-all active:scale-95 ${colorCls} ${
                isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''
              }`}
            >
              {day.dayNumber}
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-0.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
            Fuerza
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
            Garmin Cardio
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
            Doble sesión
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-muted border border-border/70" />
            Descanso
          </span>
        </div>
        <span className="text-[10px]">Pulsa un día para ver sesiones</span>
      </div>

      {/* Inspector interactivo con detalle expandible de cada sesión */}
      {selectedDate && selectedDay && (
        <DaySessionsPanel
          date={selectedDate}
          day={selectedDay}
          garminActivities={selectedBundle?.garminActivities || []}
          strengthSessions={selectedBundle?.strengthSessions || []}
          onClose={() => setSelectedDate(null)}
          onSessionsChanged={onSessionsChanged}
        />
      )}
    </div>
  );
}

export function WeeklyEvolutionStackedChart({
  weeks,
}: {
  weeks: {
    weekLabel: string;
    strengthVolumeKg: number;
    garminMinutes: number;
    sessions: number;
    avgBodyWeightKg: number | null;
  }[];
}) {
  const [selectedIdx, setSelectedIdx] = useState<number>(Math.max(0, weeks.length - 1));
  const maxVolume = Math.max(1, ...weeks.map((w) => w.strengthVolumeKg));
  const maxMinutes = Math.max(1, ...weeks.map((w) => w.garminMinutes));
  const active = weeks[selectedIdx] ?? weeks[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Evolución Semanal del Mes (Fuerza vs. Garmin)</span>
        </div>
        {active && (
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {active.weekLabel}: {active.strengthVolumeKg.toLocaleString('es-ES')} kg &middot;{' '}
            {active.garminMinutes} min
          </span>
        )}
      </div>

      <div className="h-40 flex items-end gap-3 pt-4">
        {weeks.map((w, idx) => {
          const volPct =
            w.strengthVolumeKg > 0
              ? Math.max(12, Math.round((w.strengthVolumeKg / maxVolume) * 100))
              : 4;
          const minPct =
            w.garminMinutes > 0
              ? Math.max(12, Math.round((w.garminMinutes / maxMinutes) * 100))
              : 4;
          const isSelected = idx === selectedIdx;

          return (
            <button
              key={w.weekLabel}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`flex-1 h-full flex flex-col items-center gap-2 rounded-xl p-1.5 transition-colors ${
                isSelected ? 'bg-muted/60 ring-1 ring-border' : 'hover:bg-muted/30'
              }`}
            >
              <div className="w-full flex-1 flex items-end justify-center gap-1.5">
                <div className="w-4 sm:w-5 h-full flex items-end">
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      w.strengthVolumeKg > 0 ? 'bg-blue-600' : 'bg-muted'
                    }`}
                    style={{ height: `${volPct}%` }}
                    title={`${w.weekLabel} Fuerza: ${w.strengthVolumeKg.toLocaleString('es-ES')} kg`}
                  />
                </div>
                <div className="w-4 sm:w-5 h-full flex items-end">
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      w.garminMinutes > 0 ? 'bg-emerald-500' : 'bg-muted'
                    }`}
                    style={{ height: `${minPct}%` }}
                    title={`${w.weekLabel} Garmin: ${w.garminMinutes} min`}
                  />
                </div>
              </div>
              <span className="text-[11px] font-semibold text-foreground tabular-nums">
                {w.weekLabel}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
            Tonelaje Fuerza (kg)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
            Tiempo Garmin (min)
          </span>
        </div>
        {active && (
          <span className="tabular-nums font-medium">
            {active.sessions} sesiones en {active.weekLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function BodyWeightVolumeChart({
  bodyWeight,
  volumeSeries,
  title = 'Tendencia de Peso Corporal vs. Volumen',
}: {
  bodyWeight: BodyWeightSummary;
  volumeSeries: { label: string; volumeKg: number }[];
  title?: string;
}) {
  if (!bodyWeight.hasData || bodyWeight.series.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center space-y-2">
        <Scale className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-xs font-semibold text-foreground">
          Sin registros de peso corporal
        </p>
        <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
          Añade una medición manual o conecta tu báscula Garmin Index para cruzar peso corporal y fuerza relativa.
        </p>
      </div>
    );
  }

  const pts = bodyWeight.series;
  const minW = Math.min(...pts.map((p) => p.weightKg)) - 0.5;
  const maxW = Math.max(...pts.map((p) => p.weightKg)) + 0.5;
  const rangeW = Math.max(0.5, maxW - minW);

  const width = 320;
  const height = 112;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = pts.map((p, idx) => {
    const x = pts.length === 1 ? width / 2 : padX + (idx / (pts.length - 1)) * innerW;
    const y = padY + (1 - (p.weightKg - minW) / rangeW) * innerH;
    return { x, y, ...p };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${coords[0].x.toFixed(1)},${height - padY} ${polylinePoints} ${coords[
    coords.length - 1
  ].x.toFixed(1)},${height - padY}`;

  const maxVol = Math.max(1, ...volumeSeries.map((v) => v.volumeKg));

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Scale className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <Badge variant="secondary" className="font-bold">
            {bodyWeight.currentKg?.toFixed(1)} kg
          </Badge>
          {bodyWeight.deltaKg !== null && (
            <Badge
              variant="outline"
              className={
                bodyWeight.deltaKg <= 0
                  ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'text-amber-600 dark:text-amber-400 border-amber-500/30'
              }
            >
              {bodyWeight.deltaKg > 0 ? '+' : ''}
              {bodyWeight.deltaKg.toFixed(1)} kg
            </Badge>
          )}
        </div>
      </div>

      {/* SVG Dual: Barras de volumen al fondo + curva de peso corporal encima */}
      <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-32 overflow-visible"
          role="img"
          aria-label={title}
        >
          {/* Barras de volumen en el fondo */}
          {volumeSeries.map((v, idx) => {
            const x =
              volumeSeries.length === 1
                ? width / 2
                : padX + (idx / Math.max(1, volumeSeries.length - 1)) * innerW;
            const barH = Math.max(8, (v.volumeKg / maxVol) * (innerH * 0.72));
            return (
              <rect
                key={`${v.label}-${idx}`}
                x={x - 10}
                y={height - padY - barH}
                width={20}
                height={barH}
                rx={4}
                className="fill-blue-500/20 dark:fill-blue-400/20"
              />
            );
          })}

          <polygon points={areaPoints} className="fill-indigo-500/12" />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
            className="text-indigo-600 dark:text-indigo-400"
          />

          {coords.map((c) => (
            <g key={c.date}>
              <circle
                cx={c.x}
                cy={c.y}
                r={4}
                className="fill-card stroke-indigo-600 dark:stroke-indigo-400"
                strokeWidth={2.2}
              />
              <text
                x={c.x}
                y={c.y - 9}
                textAnchor="middle"
                className="fill-foreground text-[9px] font-bold tabular-nums"
              >
                {c.weightKg.toFixed(1)}
              </text>
              <text
                x={c.x}
                y={height - 2}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px] font-medium"
              >
                {c.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
        <span>
          Inicio: <strong className="text-foreground">{bodyWeight.startKg?.toFixed(1)} kg</strong>
        </span>
        <span>
          Rango: {bodyWeight.minKg?.toFixed(1)} – {bodyWeight.maxKg?.toFixed(1)} kg
        </span>
      </div>
    </div>
  );
}

export function AnnualMonthlyComparisonChart({
  months,
  bestMonthLabel,
}: {
  months: {
    monthIndex: number;
    shortLabel: string;
    strengthSessions: number;
    garminSessions: number;
    tonnesLifted: number;
    garminHours: number;
    avgBodyWeightKg: number | null;
  }[];
  bestMonthLabel?: string;
}) {
  const [metric, setMetric] = useState<'tonnes' | 'hours' | 'sessions'>('tonnes');
  const maxVal = Math.max(
    1,
    ...months.map((m) =>
      metric === 'tonnes'
        ? m.tonnesLifted
        : metric === 'hours'
        ? m.garminHours
        : m.strengthSessions + m.garminSessions
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Activity className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Comparativa 12 Meses (Ene–Dic)</span>
        </div>

        <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border/60 self-start sm:self-auto">
          {(
            [
              { id: 'tonnes', label: 'Tonelaje' },
              { id: 'hours', label: 'Horas Garmin' },
              { id: 'sessions', label: 'Sesiones' },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="xs"
              variant={metric === opt.id ? 'secondary' : 'ghost'}
              onClick={() => setMetric(opt.id)}
              className="text-[11px] font-semibold px-2.5"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-36 flex items-end gap-1.5 sm:gap-2 pt-3">
        {months.map((m) => {
          const val =
            metric === 'tonnes'
              ? m.tonnesLifted
              : metric === 'hours'
              ? m.garminHours
              : m.strengthSessions + m.garminSessions;
          const pct = val > 0 ? Math.max(12, Math.round((val / maxVal) * 100)) : 5;
          const isBest =
            bestMonthLabel &&
            bestMonthLabel.toLowerCase().startsWith(m.shortLabel.toLowerCase());

          return (
            <div
              key={m.monthIndex}
              className="flex-1 h-full flex flex-col items-center gap-1.5"
              title={`${m.shortLabel}: ${m.tonnesLifted} t · ${m.garminHours} h · ${
                m.strengthSessions + m.garminSessions
              } ses.`}
            >
              <span className="text-[9px] text-muted-foreground font-semibold tabular-nums hidden sm:inline">
                {metric === 'tonnes' ? `${m.tonnesLifted}` : metric === 'hours' ? `${m.garminHours}` : val}
              </span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    isBest
                      ? 'bg-amber-500'
                      : metric === 'hours'
                      ? 'bg-emerald-500'
                      : metric === 'sessions'
                      ? 'bg-indigo-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">
                {m.shortLabel}
              </span>
            </div>
          );
        })}
      </div>

      {bestMonthLabel && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
          <span>
            Mes pico destacado: <strong className="text-foreground">{bestMonthLabel}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

export function AnnualBodyWeightChart({ bodyWeight }: { bodyWeight: BodyWeightSummary }) {
  if (!bodyWeight.hasData || bodyWeight.series.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center space-y-2">
        <Scale className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-xs font-semibold text-foreground">Sin histórico anual de peso</p>
      </div>
    );
  }

  const pts = bodyWeight.series;
  const minW = Math.min(...pts.map((p) => p.weightKg)) - 0.6;
  const maxW = Math.max(...pts.map((p) => p.weightKg)) + 0.6;
  const rangeW = Math.max(1, maxW - minW);

  const width = 360;
  const height = 128;
  const padX = 18;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = pts.map((p, idx) => {
    const x = pts.length === 1 ? width / 2 : padX + (idx / (pts.length - 1)) * innerW;
    const y = padY + (1 - (p.weightKg - minW) / rangeW) * innerH;
    return { x, y, ...p };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${coords[0].x.toFixed(1)},${height - padY} ${polylinePoints} ${coords[
    coords.length - 1
  ].x.toFixed(1)},${height - padY}`;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          {bodyWeight.deltaKg !== null && bodyWeight.deltaKg <= 0 ? (
            <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <TrendingUp className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>Evolución Anual del Peso Corporal</span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <Badge variant="secondary" className="font-bold">
            Actual: {bodyWeight.currentKg?.toFixed(1)} kg
          </Badge>
          {bodyWeight.deltaKg !== null && (
            <Badge
              variant="outline"
              className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
            >
              {bodyWeight.deltaKg > 0 ? '+' : ''}
              {bodyWeight.deltaKg.toFixed(1)} kg año
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-32 overflow-visible"
          role="img"
          aria-label="Evolución anual del peso corporal"
        >
          <polygon points={areaPoints} className="fill-emerald-500/12" />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
            className="text-emerald-600 dark:text-emerald-400"
          />
          {coords.map((c, idx) => (
            <g key={c.date}>
              <circle
                cx={c.x}
                cy={c.y}
                r={3.2}
                className="fill-card stroke-emerald-600 dark:stroke-emerald-400"
                strokeWidth={2}
              />
              {(idx === 0 || idx === coords.length - 1 || idx === Math.floor(coords.length / 2)) && (
                <text
                  x={c.x}
                  y={c.y - 8}
                  textAnchor="middle"
                  className="fill-foreground text-[9px] font-bold tabular-nums"
                >
                  {c.weightKg.toFixed(1)}
                </text>
              )}
              <text
                x={c.x}
                y={height - 2}
                textAnchor="middle"
                className="fill-muted-foreground text-[8.5px] font-medium"
              >
                {c.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[11px] tabular-nums">
        <div className="rounded-lg bg-muted/35 border border-border/60 py-1.5 px-2">
          <div className="text-muted-foreground">Inicio año</div>
          <div className="font-bold text-foreground">{bodyWeight.startKg?.toFixed(1)} kg</div>
        </div>
        <div className="rounded-lg bg-muted/35 border border-border/60 py-1.5 px-2">
          <div className="text-muted-foreground">Mínimo</div>
          <div className="font-bold text-emerald-600 dark:text-emerald-400">
            {bodyWeight.minKg?.toFixed(1)} kg
          </div>
        </div>
        <div className="rounded-lg bg-muted/35 border border-border/60 py-1.5 px-2">
          <div className="text-muted-foreground">Máximo</div>
          <div className="font-bold text-foreground">{bodyWeight.maxKg?.toFixed(1)} kg</div>
        </div>
      </div>
    </div>
  );
}
