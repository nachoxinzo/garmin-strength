'use client';

import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  MapPin,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
  Watch,
  X,
} from 'lucide-react';
import ExerciseSwapModal from '@/components/ExerciseSwapModal';
import { NumericInput } from '@/components/NumericInput';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CatalogExercise, EXERCISE_CATALOG } from '@/lib/exercise-catalog';
import { deleteStrengthSessionLogs, replaceStrengthSessionLogs } from '@/lib/supabase';
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
  onSessionsChanged?: () => Promise<void> | void;
}

interface DraftExerciseSet {
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe?: number;
}

interface DraftExercise {
  name: string;
  muscleGroup: string;
  sets: DraftExerciseSet[];
}

function resolveCatalogExerciseForSwap(
  exerciseName: string,
  muscleGroup?: string
): CatalogExercise {
  const lower = exerciseName.trim().toLowerCase();
  const exact = EXERCISE_CATALOG.find((e) => e.name.toLowerCase() === lower);
  if (exact) return exact;

  const partial = EXERCISE_CATALOG.find(
    (e) => lower.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(lower)
  );
  if (partial) return partial;

  const guessedMuscle =
    muscleGroup === 'Pecho' ||
    muscleGroup === 'Espalda' ||
    muscleGroup === 'Piernas' ||
    muscleGroup === 'Hombros' ||
    muscleGroup === 'Brazos' ||
    muscleGroup === 'Core'
      ? muscleGroup
      : lower.includes('banca') || lower.includes('pecho')
      ? 'Pecho'
      : lower.includes('remo') || lower.includes('dominada') || lower.includes('jalón')
      ? 'Espalda'
      : lower.includes('sentadilla') ||
        lower.includes('prensa') ||
        lower.includes('femoral') ||
        lower.includes('cuádriceps') ||
        lower.includes('gemelo') ||
        lower.includes('zancada') ||
        lower.includes('hip thrust')
      ? 'Piernas'
      : lower.includes('militar') || lower.includes('hombro') || lower.includes('lateral')
      ? 'Hombros'
      : lower.includes('curl') || lower.includes('bíceps') || lower.includes('tríceps')
      ? 'Brazos'
      : 'Core';

  const fallback =
    EXERCISE_CATALOG.find((e) => e.muscleGroup === guessedMuscle) || EXERCISE_CATALOG[0];

  return {
    ...fallback,
    name: exerciseName,
  };
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
  onSessionsChanged,
}: DaySessionsPanelProps) {
  const [expandedGarminId, setExpandedGarminId] = useState<number | null>(null);
  const [expandedStrengthId, setExpandedStrengthId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<number, GarminActivityDetail>>({});
  const [loadingGarminId, setLoadingGarminId] = useState<number | null>(null);
  const [detailErrorByActivity, setDetailErrorByActivity] = useState<Record<number, string>>({});

  // Estados de edición a posteriori
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [originalWorkoutTitle, setOriginalWorkoutTitle] = useState<string>('');
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [swappingDraftExIdx, setSwappingDraftExIdx] = useState<number | null>(null);
  const [addExerciseId, setAddExerciseId] = useState<string>(EXERCISE_CATALOG[0]?.id || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [isDeletingSessionId, setIsDeletingSessionId] = useState<string | null>(null);

  const formattedDay = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const fetchGarminDetailIfNeeded = async (act: GarminActivitySummary) => {
    if (detailsCache[act.activityId] || loadingGarminId === act.activityId) return;

    setLoadingGarminId(act.activityId);
    try {
      const res = await fetch('/api/garmin/activity-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: act.activityId,
          sportCategory: act.sportCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo cargar el detalle de la actividad.');
      }

      setDetailsCache((prev) => ({
        ...prev,
        [act.activityId]: data.detail as GarminActivityDetail,
      }));
    } catch (err: any) {
      setDetailErrorByActivity((prev) => ({
        ...prev,
        [act.activityId]:
          err?.message || 'Conecta tu cuenta de Garmin arriba para ver zonas, ritmo y FC.',
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
      if (editingSessionId === session.id) {
        setEditingSessionId(null);
      }
      return;
    }
    setExpandedStrengthId(session.id);
    if (session.linkedGarminActivity) {
      await fetchGarminDetailIfNeeded(session.linkedGarminActivity);
    }
  };

  const startEditingSession = (session: StrengthDaySession) => {
    setEditingSessionId(session.id);
    setExpandedStrengthId(session.id);
    setOriginalWorkoutTitle(session.workoutTitle);
    setDraftTitle(session.workoutTitle);
    setDraftExercises(
      session.exercises.map((ex) => ({
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: ex.sets.map((s, idx) => ({
          setIndex: idx,
          weightKg: s.weightKg,
          reps: s.reps,
          rpe: s.rpe,
        })),
      }))
    );
    setEditError(null);
    setConfirmDeleteSessionId(null);
  };

  const updateDraftSet = (
    exIdx: number,
    setIdx: number,
    field: 'weightKg' | 'reps',
    value: number
  ) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, si) => (si === setIdx ? { ...s, [field]: value } : s)),
        };
      })
    );
  };

  const addDraftSet = (exIdx: number) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              setIndex: ex.sets.length,
              weightKg: last ? last.weightKg : 20,
              reps: last ? last.reps : 10,
            },
          ],
        };
      })
    );
  };

  const removeDraftSet = (exIdx: number, setIdx: number) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx || ex.sets.length <= 1) return ex;
        return {
          ...ex,
          sets: ex.sets
            .filter((_, si) => si !== setIdx)
            .map((s, idx) => ({ ...s, setIndex: idx })),
        };
      })
    );
  };

  const removeDraftExercise = (exIdx: number) => {
    setDraftExercises((prev) => prev.filter((_, i) => i !== exIdx));
  };

  const handleAddDraftExercise = () => {
    const found = EXERCISE_CATALOG.find((e) => e.id === addExerciseId);
    if (!found) return;
    setDraftExercises((prev) => [
      ...prev,
      {
        name: found.name,
        muscleGroup: found.muscleGroup,
        sets: [
          { setIndex: 0, weightKg: 20, reps: 10 },
          { setIndex: 1, weightKg: 20, reps: 10 },
          { setIndex: 2, weightKg: 20, reps: 10 },
        ],
      },
    ]);
  };

  const handleConfirmSwapDraftExercise = (
    alternativeExercise: CatalogExercise,
    newWeightKg: number
  ) => {
    if (swappingDraftExIdx === null) return;
    setDraftExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx !== swappingDraftExIdx) return ex;
        return {
          ...ex,
          name: alternativeExercise.name,
          muscleGroup: alternativeExercise.muscleGroup,
          sets: ex.sets.map((s) =>
            s.weightKg === 0 ? { ...s, weightKg: newWeightKg } : s
          ),
        };
      })
    );
    setSwappingDraftExIdx(null);
  };

  const handleSaveSessionEdits = async () => {
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const performedIso = `${date}T12:00:00.000Z`;
      const newLogs = draftExercises.flatMap((ex) =>
        ex.sets
          .filter((s) => s.reps > 0)
          .map((s, idx) => ({
            workout_title: draftTitle.trim() || originalWorkoutTitle || 'Entrenamiento',
            performed_at: performedIso,
            exercise_title: ex.name,
            set_index: idx,
            weight_kg: s.weightKg,
            reps: s.reps,
            rpe: s.rpe,
          }))
      );

      const res = await replaceStrengthSessionLogs({
        date,
        originalWorkoutTitle,
        newWorkoutTitle: draftTitle,
        logs: newLogs,
      });

      if (!res.ok) {
        setEditError('No se pudo actualizar la sesión en la nube. Revisa tu conexión.');
        return;
      }

      setEditingSessionId(null);
      await onSessionsChanged?.();
    } catch (err: any) {
      setEditError(err?.message || 'Error al guardar los cambios de la sesión.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteSession = async (session: StrengthDaySession) => {
    setIsDeletingSessionId(session.id);
    setEditError(null);
    try {
      const res = await deleteStrengthSessionLogs({
        date,
        workoutTitle: session.workoutTitle,
      });
      if (!res.ok) {
        setEditError('No se pudo eliminar la sesión en la nube.');
        return;
      }
      setConfirmDeleteSessionId(null);
      setEditingSessionId(null);
      setExpandedStrengthId(null);
      await onSessionsChanged?.();
    } finally {
      setIsDeletingSessionId(null);
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
                } · Toca una sesión para expandir o editar`}
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

      {/* Sesiones de Fuerza (unificadas App + variables físicas Garmin) */}
      {!day?.isFuture && strengthSessions.length > 0 && (
        <div className="space-y-2">
          {strengthSessions.map((session) => {
            const isExpanded = expandedStrengthId === session.id;
            const isEditing = editingSessionId === session.id;
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

                    {editError && (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                        {editError}
                      </div>
                    )}

                    {!isEditing ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold text-muted-foreground">
                            {linked && session.source !== 'garmin_import'
                              ? 'Ejercicios y Series (App · Entreno en Vivo)'
                              : 'Ejercicios y Series Registradas'}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditingSession(session)}
                              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-semibold transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar sesión</span>
                            </button>

                            {confirmDeleteSessionId === session.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isDeletingSessionId === session.id}
                                  onClick={() => handleDeleteSession(session)}
                                  className="min-h-[36px] px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold disabled:opacity-50"
                                >
                                  {isDeletingSessionId === session.id ? 'Borrando...' : 'Confirmar borrado'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteSessionId(null)}
                                  className="min-h-[36px] px-2 py-1 rounded-lg bg-card border border-border/80 text-foreground text-[11px] font-medium"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSessionId(session.id)}
                                title="Eliminar sesión"
                                className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 border border-border/70 text-[11px] font-semibold transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar</span>
                              </button>
                            )}
                          </div>
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
                    ) : (
                      /* MODO EDICIÓN A POSTERIORI */
                      <div className="space-y-3 pt-1">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Nombre de la sesión
                          </label>
                          <input
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-card border border-border/80 text-base sm:text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-blue-500/25"
                          />
                        </div>

                        <div className="space-y-2.5">
                          {draftExercises.map((ex, exIdx) => (
                            <div
                              key={`${ex.name}-${exIdx}`}
                              className="rounded-xl bg-card border border-border/80 p-3 space-y-2.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-foreground truncate">
                                    {exIdx + 1}. {ex.name}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    {ex.muscleGroup}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setSwappingDraftExIdx(exIdx)}
                                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-semibold"
                                  >
                                    <Shuffle className="w-3.5 h-3.5" />
                                    <span>Cambiar</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => removeDraftExercise(exIdx)}
                                    title="Eliminar ejercicio de la sesión"
                                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 border border-border/70"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                {ex.sets.map((s, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="grid grid-cols-12 gap-2 items-center bg-muted/25 rounded-lg p-1.5 border border-border/50"
                                  >
                                    <span className="col-span-2 text-center text-[11px] font-bold text-muted-foreground tabular-nums">
                                      #{sIdx + 1}
                                    </span>

                                    <div className="col-span-4 flex items-center gap-1">
                                      <NumericInput
                                        value={s.weightKg}
                                        onChange={(val) => updateDraftSet(exIdx, sIdx, 'weightKg', val)}
                                        allowDecimal
                                        min={0}
                                        max={1000}
                                        ariaLabel="Kg de la serie"
                                        className="w-full min-h-[36px] text-center font-bold bg-card border border-border/70 rounded-md text-foreground outline-none focus:ring-2 focus:ring-blue-500/20"
                                      />
                                      <span className="text-[10px] text-muted-foreground">kg</span>
                                    </div>

                                    <div className="col-span-4 flex items-center gap-1">
                                      <NumericInput
                                        value={s.reps}
                                        onChange={(val) => updateDraftSet(exIdx, sIdx, 'reps', val)}
                                        min={0}
                                        max={500}
                                        ariaLabel="Repeticiones de la serie"
                                        className="w-full min-h-[36px] text-center font-bold bg-card border border-border/70 rounded-md text-foreground outline-none focus:ring-2 focus:ring-blue-500/20"
                                      />
                                      <span className="text-[10px] text-muted-foreground">reps</span>
                                    </div>

                                    <div className="col-span-2 flex justify-end">
                                      {ex.sets.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeDraftSet(exIdx, sIdx)}
                                          title="Quitar serie"
                                          className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => addDraftSet(exIdx)}
                                className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted border border-border/70 text-[11px] font-semibold text-foreground"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Serie</span>
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Añadir ejercicio olvidado */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                          <select
                            aria-label="Seleccionar ejercicio para añadir a la sesión"
                            value={addExerciseId}
                            onChange={(e) => setAddExerciseId(e.target.value)}
                            className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg bg-card border border-border/80 text-base sm:text-xs font-medium text-foreground outline-none"
                          >
                            {EXERCISE_CATALOG.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.muscleGroup})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleAddDraftExercise}
                            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-card hover:bg-accent border border-border/80 text-xs font-semibold text-foreground shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Añadir ejercicio</span>
                          </button>
                        </div>

                        {/* Acciones Guardar / Cancelar */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/60">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSessionId(null);
                              setEditError(null);
                            }}
                            className="min-h-[40px] px-4 py-1.5 rounded-lg bg-card hover:bg-accent border border-border/80 text-xs font-semibold text-foreground"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={isSavingEdit}
                            onClick={handleSaveSessionEdits}
                            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-60"
                          >
                            <Check className="w-4 h-4" />
                            <span>{isSavingEdit ? 'Guardando...' : 'Guardar cambios'}</span>
                          </button>
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

      {/* Actividades Garmin independientes (Solo variables físicas/fisiológicas, sin ejercicios ni cargas) */}
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

      {/* Modal de Sustitución de Ejercicio a Posteriori (mismas sugerencias que Entreno en Vivo) */}
      {swappingDraftExIdx !== null && draftExercises[swappingDraftExIdx] && (
        <ExerciseSwapModal
          currentExercise={resolveCatalogExerciseForSwap(
            draftExercises[swappingDraftExIdx].name,
            draftExercises[swappingDraftExIdx].muscleGroup
          )}
          currentWeightKg={
            Math.max(...draftExercises[swappingDraftExIdx].sets.map((s) => s.weightKg), 0) || 20
          }
          isOpen={true}
          onClose={() => setSwappingDraftExIdx(null)}
          onSelectAlternative={handleConfirmSwapDraftExercise}
        />
      )}
    </div>
  );
}
