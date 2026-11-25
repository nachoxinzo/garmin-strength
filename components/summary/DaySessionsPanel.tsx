'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  MapPin,
  Watch,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarActivityDay,
  StrengthDaySession,
} from '@/lib/summary-types';
import { GarminActivityDetail, GarminActivitySummary } from '@/lib/types';

interface DaySessionsPanelProps {
  date: string;
  day?: CalendarActivityDay | null;
  garminActivities: GarminActivitySummary[];
  strengthSessions: StrengthDaySession[];
  onClose?: () => void;
}

const ZONE_BAR_COLORS: Record<number, string> = {
  1: 'bg-slate-400',
  2: 'bg-blue-500',
  3: 'bg-emerald-500',
  4: 'bg-amber-500',
  5: 'bg-rose-500',
};

function GarminPhysiologyBlock({
  detail,
  isLoading,
  error,
}: {
  detail?: GarminActivityDetail;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (error && !detail) {
    return <p className="text-rose-600 dark:text-rose-400 text-xs">{error}</p>;
  }

  if (!detail) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums">
        {detail.avgPaceMinKm && (
          <div className="rounded-lg bg-card border border-border/60 p-2">
            <div className="text-[10px] text-muted-foreground">Ritmo Medio</div>
            <div className="font-bold text-foreground">{detail.avgPaceMinKm}</div>
          </div>
        )}
        {!detail.avgPaceMinKm && detail.avgSpeedKmh && (
          <div className="rounded-lg bg-card border border-border/60 p-2">
            <div className="text-[10px] text-muted-foreground">Velocidad Media</div>
            <div className="font-bold text-foreground">{detail.avgSpeedKmh} km/h</div>
          </div>
        )}
        {(detail.avgHr || detail.maxHr) && (
          <div className="rounded-lg bg-card border border-border/60 p-2">
            <div className="text-[10px] text-muted-foreground">FC Media / Máx</div>
            <div className="font-bold text-foreground">
              {detail.avgHr ?? '—'} / {detail.maxHr ?? '—'} bpm
            </div>
          </div>
        )}
        {detail.elevationGainM !== undefined && detail.elevationGainM > 0 && (
          <div className="rounded-lg bg-card border border-border/60 p-2">
            <div className="text-[10px] text-muted-foreground">Desnivel +</div>
            <div className="font-bold text-foreground">{detail.elevationGainM} m</div>
          </div>
        )}
        {(detail.aerobicEffect !== undefined || detail.anaerobicEffect !== undefined) && (
          <div className="rounded-lg bg-card border border-border/60 p-2">
            <div className="text-[10px] text-muted-foreground">Training Effect</div>
            <div className="font-bold text-foreground">
              Aer {detail.aerobicEffect !== undefined ? detail.aerobicEffect.toFixed(1) : '—'} &middot; Ana{' '}
              {detail.anaerobicEffect !== undefined ? detail.anaerobicEffect.toFixed(1) : '—'}
            </div>
          </div>
        )}
      </div>

      {detail.hrZones.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground">
            Zonas de Frecuencia Cardíaca (Garmin)
          </div>
          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted">
            {detail.hrZones.map((z) => (
              <div
                key={z.zone}
                style={{ width: `${z.pct}%` }}
                className={ZONE_BAR_COLORS[z.zone] || 'bg-slate-400'}
                title={`Z${z.zone}: ${Math.round(z.seconds / 60)} min (${z.pct}%)`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5 text-[10px] text-muted-foreground tabular-nums">
            {detail.hrZones.map((z) => (
              <span key={z.zone}>
                Z{z.zone}: {Math.round(z.seconds / 60)}m ({z.pct}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DaySessionsPanel({
  date,
  day,
  garminActivities,
  strengthSessions,
  onClose,
}: DaySessionsPanelProps) {
  const [expandedGarminId, setExpandedGarminId] = useState<number | null>(null);
  const [expandedStrengthId, setExpandedStrengthId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<number, GarminActivityDetail>>({});
  const [loadingGarminId, setLoadingGarminId] = useState<number | null>(null);
  const [detailErrorByActivity, setDetailErrorByActivity] = useState<Record<number, string>>({});

  const formattedDay = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const fetchGarminDetailIfNeeded = async (act: GarminActivitySummary) => {
    if (detailsCache[act.activityId] || loadingGarminId === act.activityId) return;

    setLoadingGarminId(act.activityId);
    try {
      const rawTokens = localStorage.getItem('garmin_oauth_tokens');
      const garminTokens = rawTokens ? JSON.parse(rawTokens) : null;

      const res = await fetch('/api/garmin/activity-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: act.activityId,
          sportCategory: act.sportCategory,
          garminTokens,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo cargar el detalle de la actividad.');
      }

      if (data.tokens) {
        localStorage.setItem('garmin_oauth_tokens', JSON.stringify(data.tokens));
      }

      setDetailsCache((prev) => ({
        ...prev,
        [act.activityId]: data.detail as GarminActivityDetail,
      }));
    } catch (err: any) {
      setDetailErrorByActivity((prev) => ({
        ...prev,
        [act.activityId]:
          err?.message || 'Conecta tu cuenta de Garmin arriba para ver zonas, series y parciales.',
      }));
    } finally {
      setLoadingGarminId(null);
    }
  };

  const handleToggleGarmin = async (act: GarminActivitySummary) => {
    if (expandedGarminId === act.activityId) {
      setExpandedGarminId(null);
      return;
    }
    setExpandedGarminId(act.activityId);
    await fetchGarminDetailIfNeeded(act);
  };

  const handleToggleStrength = async (session: StrengthDaySession) => {
    if (expandedStrengthId === session.id) {
      setExpandedStrengthId(null);
      return;
    }
    setExpandedStrengthId(session.id);
    if (session.linkedGarminActivity) {
      await fetchGarminDetailIfNeeded(session.linkedGarminActivity);
    }
  };

  const totalStrengthVol = Math.round(
    strengthSessions.reduce((acc, s) => acc + s.totalVolumeKg, 0)
  );
  const totalSessions = garminActivities.length + strengthSessions.length;

  return (
    <div className="rounded-xl bg-muted/35 border border-border/75 p-4 space-y-3 animate-in fade-in duration-150 text-left">
      {/* Cabecera del día */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-xs sm:text-sm font-bold text-foreground capitalize">
            {formattedDay}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {day?.isFuture
              ? 'Día futuro — aún no ha llegado'
              : totalSessions === 0
              ? 'Día de descanso — sin sesiones registradas'
              : `${totalSessions} ${
                  totalSessions === 1 ? 'sesión registrada' : 'sesiones registradas'
                } · Toca una sesión para expandir su detalle`}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalStrengthVol > 0 && (
            <Badge variant="secondary" className="font-bold tabular-nums">
              {totalStrengthVol.toLocaleString('es-ES')} kg fuerza
            </Badge>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle del día"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sesiones de Fuerza (unificadas App + Garmin cuando coinciden el mismo día) */}
      {!day?.isFuture && strengthSessions.length > 0 && (
        <div className="space-y-2">
          {strengthSessions.map((session) => {
            const isExpanded = expandedStrengthId === session.id;
            const linked = session.linkedGarminActivity;
            const garminDetail = linked ? detailsCache[linked.activityId] : undefined;
            const isLoadingLinked = linked ? loadingGarminId === linked.activityId : false;
            const linkedError = linked ? detailErrorByActivity[linked.activityId] || null : null;

            const badgeLabel =
              linked && session.source !== 'garmin_import'
                ? 'Fuerza · App + Garmin'
                : session.source === 'garmin_import'
                ? 'Fuerza · Garmin'
                : session.source === 'live_tracker'
                ? 'Fuerza · En Vivo'
                : 'Fuerza · App';

            return (
              <div
                key={session.id}
                className="rounded-xl bg-card border border-border/75 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleToggleStrength(session)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-muted/35 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        linked && session.source !== 'garmin_import'
                          ? 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300'
                          : 'bg-blue-500/12 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      <Dumbbell className="w-3 h-3" />
                      {badgeLabel}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate">
                      {session.workoutTitle}
                    </span>
                  </div>

                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2.5 text-[11px] text-muted-foreground tabular-nums">
                    <span className="min-w-0">
                      {session.exercises.length} ej. &middot; {session.totalSets} series &middot;{' '}
                      <strong className="text-foreground">
                        {session.totalVolumeKg.toLocaleString('es-ES')} kg
                      </strong>
                      {linked && linked.durationMinutes > 0 && ` · ${linked.durationMinutes} min`}
                      {linked && linked.avgHr ? ` · ${linked.avgHr} bpm` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                      {isExpanded ? (
                        <>
                          <span>Ocultar</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Ver detalle</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/60 bg-muted/20 space-y-3 text-xs">
                    {linked && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Watch className="w-3.5 h-3.5 text-blue-600" />
                            Fisiología del Reloj ({linked.name})
                          </span>
                          <span className="tabular-nums">
                            {linked.durationMinutes} min
                            {linked.calories > 0 ? ` · ${linked.calories} kcal` : ''}
                          </span>
                        </div>
                        <GarminPhysiologyBlock
                          detail={garminDetail}
                          isLoading={isLoadingLinked}
                          error={linkedError}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-muted-foreground">
                        {linked && session.source !== 'garmin_import'
                          ? 'Ejercicios y Series (App · Prioridad en Pesos)'
                          : 'Ejercicios y Series Registradas'}
                      </div>
                      {session.exercises.map((ex, i) => (
                        <div
                          key={`${ex.name}-${i}`}
                          className="rounded-lg bg-card border border-border/60 p-2.5 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-bold text-foreground truncate">
                                {ex.name}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {ex.muscleGroup}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">
                              {ex.totalVolumeKg.toLocaleString('es-ES')} kg &middot; e1RM{' '}
                              <strong className="text-foreground">{ex.bestEstimated1RM} kg</strong>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 tabular-nums">
                            {ex.sets.map((s) => (
                              <span
                                key={s.setIndex}
                                className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-semibold"
                              >
                                #{s.setIndex}: {s.weightKg} kg &times; {s.reps}
                                {s.rpe ? ` (RPE ${s.rpe})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actividades Garmin independientes (Cardio u otras sin sesión unificada) */}
      {!day?.isFuture && garminActivities.length > 0 && (
        <div className="space-y-2">
          {garminActivities.map((act) => {
            const isExpanded = expandedGarminId === act.activityId;
            const detail = detailsCache[act.activityId];
            const isLoadingThis = loadingGarminId === act.activityId;
            const detailError = detailErrorByActivity[act.activityId] || null;

            return (
              <div
                key={act.activityId}
                className="rounded-xl bg-card border border-border/75 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleToggleGarmin(act)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-muted/35 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        act.sportCategory === 'Fuerza'
                          ? 'bg-blue-500/12 text-blue-700 dark:text-blue-300'
                          : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      <Watch className="w-3 h-3" />
                      {act.sportCategory}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate">
                      {act.name}
                    </span>
                  </div>

                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2.5 text-[11px] text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {act.durationMinutes} min
                      </span>
                      {act.distanceKm > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          &middot; <MapPin className="w-3 h-3" /> {act.distanceKm} km
                        </span>
                      )}
                      {act.calories > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          &middot; <Flame className="w-3 h-3 text-amber-500" /> {act.calories} kcal
                        </span>
                      )}
                      {act.avgHr && (
                        <span className="inline-flex items-center gap-0.5">
                          &middot; <HeartPulse className="w-3 h-3 text-rose-500" /> {act.avgHr} bpm
                        </span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                      {isExpanded ? (
                        <>
                          <span>Ocultar</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Ver detalle</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/60 bg-muted/20 space-y-3 text-xs">
                    <GarminPhysiologyBlock
                      detail={detail}
                      isLoading={isLoadingThis}
                      error={detailError}
                    />

                    {!isLoadingThis && detail && detail.strengthExercises.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          Ejercicios y Series Registradas en Reloj
                        </div>
                        <div className="space-y-1.5">
                          {detail.strengthExercises.map((ex, i) => (
                            <div
                              key={i}
                              className="rounded-lg bg-card border border-border/60 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                            >
                              <span className="font-semibold text-foreground">{ex.name}</span>
                              <div className="flex flex-wrap gap-1.5 tabular-nums">
                                {ex.sets.map((s) => (
                                  <span
                                    key={s.setIndex}
                                    className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[11px] font-semibold"
                                  >
                                    {s.weightKg} kg &times; {s.reps}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isLoadingThis && detail && detail.splits.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          Parciales / Vueltas ({detail.splits.length})
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                          <table className="w-full text-[11px] text-left tabular-nums">
                            <thead className="bg-muted/40 text-muted-foreground">
                              <tr>
                                <th className="px-2.5 py-1.5">Vuelta</th>
                                <th className="px-2.5 py-1.5">Dist.</th>
                                <th className="px-2.5 py-1.5">Tiempo</th>
                                {detail.splits.some((s) => s.paceMinKm) && (
                                  <th className="px-2.5 py-1.5">Ritmo</th>
                                )}
                                <th className="px-2.5 py-1.5">FC</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {detail.splits.map((sp) => (
                                <tr key={sp.lap}>
                                  <td className="px-2.5 py-1.5 font-semibold">#{sp.lap}</td>
                                  <td className="px-2.5 py-1.5">{sp.distanceKm} km</td>
                                  <td className="px-2.5 py-1.5">{sp.durationMin} min</td>
                                  {detail.splits.some((s) => s.paceMinKm) && (
                                    <td className="px-2.5 py-1.5">{sp.paceMinKm || '—'}</td>
                                  )}
                                  <td className="px-2.5 py-1.5">
                                    {sp.avgHr ? `${sp.avgHr} bpm` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
