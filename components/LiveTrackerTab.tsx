'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Box,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX
} from 'lucide-react';
import { StrengthRoutine } from '@/lib/types';
import {
  EffortRating,
  ExerciseProgressRecord,
  loadProgressionHistory,
  recordSingleExerciseCompletion
} from '@/lib/progressive-overload-engine';
import { getExpertGymExercises } from '@/lib/expert-gym-guide';
import { generateWarmupRamp } from '@/lib/warmup-calculator';
import { ExerciseNoteRecord, loadExerciseNotes } from '@/lib/exercise-notes';
import { Exercise3DModal } from './Exercise3DModal';
import { useWakeLock } from '@/lib/use-wake-lock';

type PrBadgeType = '1rm' | 'volume' | 'both';

interface LiveSetRow {
  id: string;
  weightKg: number;
  reps: number;
  completed: boolean;
  prType?: PrBadgeType;
  isWarmup?: boolean;
}

interface WorkoutObjectiveReport {
  durationSeconds: number;
  completionPct: number;
  completedSets: number;
  totalSets: number;
  volumeKg: number;
  densityKgPerMin: number;
  prsBeaten: { exerciseName: string; detail: string }[];
  muscleBreakdown: { muscle: string; sets: number }[];
  verdictTitle: string;
  verdictBody: string;
}

interface LiveExerciseState {
  blockId: string;
  exercise: StrengthRoutine['blocks'][number]['exercise'];
  restSeconds: number;
  supersetGroupId?: string;
  sets: LiveSetRow[];
  effort: EffortRating;
}

interface LiveTrackerTabProps {
  routine: StrengthRoutine;
  onOpenCatalog: () => void;
  onWorkoutSaved: (updatedHistory: Record<string, ExerciseProgressRecord>, summaryText: string) => void;
  onApplyNextProgression?: () => void;
}

function computeEpley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

function playPrCelebrationChime() {
  playRestBeep(523.25, 0.12); // C5
  setTimeout(() => playRestBeep(659.25, 0.12), 110); // E5
  setTimeout(() => playRestBeep(783.99, 0.25), 220); // G5
}

function playRestBeep(frequency = 880, duration = 0.2) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // ignore
  }
}

function triggerVibration(pattern: number[] = [150, 80, 150]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function LiveTrackerTab({
  routine,
  onOpenCatalog,
  onWorkoutSaved,
  onApplyNextProgression
}: LiveTrackerTabProps) {
  const [history, setHistory] = useState<Record<string, ExerciseProgressRecord>>({});
  const [notesMap, setNotesMap] = useState<Record<string, ExerciseNoteRecord>>({});
  const [liveExercises, setLiveExercises] = useState<LiveExerciseState[]>([]);

  // Mapa de fichas expertas para enriquecer el visor 3D contextual
  const expertMap = useMemo(() => {
    const list = getExpertGymExercises();
    return new Map(list.map((e) => [e.exerciseId, e]));
  }, []);

  // Estados de Visor 3D, Celebración de PR y Reporte Objetivo
  const [active3DExercise, setActive3DExercise] = useState<StrengthRoutine['blocks'][number]['exercise'] | null>(null);
  const [prToast, setPrToast] = useState<{ title: string; subtitle: string } | null>(null);
  const [objectiveReport, setObjectiveReport] = useState<WorkoutObjectiveReport | null>(null);
  const [progressionApplied, setProgressionApplied] = useState(false);

  // Cronómetro global de la sesión
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Temporizador automático de descanso entre series
  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [isRestRunning, setIsRestRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Mantener pantalla encendida mientras el entreno está activo
  useWakeLock(isSessionActive && !isFinished);

  // Cargar historial previo y notas técnicas
  useEffect(() => {
    setHistory(loadProgressionHistory());
    setNotesMap(loadExerciseNotes());
  }, []);

  useEffect(() => {
    // Solo inicializar si no hay una sesión activa en curso con datos ya marcados
    setLiveExercises((prev) => {
      const hasAnyCompleted = prev.some((ex) => ex.sets.some((s) => s.completed));
      if (isSessionActive && hasAnyCompleted) return prev;

      return routine.blocks.map((block) => ({
        blockId: block.id,
        exercise: block.exercise,
        restSeconds: block.restSeconds || 90,
        supersetGroupId: block.supersetGroupId,
        effort: 'optimal',
        sets: Array.from({ length: block.sets }, (_, i) => ({
          id: `${block.id}-s-${i}`,
          weightKg: block.weightKg,
          reps: block.reps,
          completed: false,
        })),
      }));
    });
  }, [routine, isSessionActive]);

  // Tick del cronómetro global
  useEffect(() => {
    if (!isSessionActive || isPaused || isFinished) return;
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isSessionActive, isPaused, isFinished]);

  // Tick del temporizador de descanso automático
  useEffect(() => {
    if (!isRestRunning || restRemaining <= 0) return;
    const timer = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          setIsRestRunning(false);
          if (soundEnabled) playRestBeep(1046, 0.35);
          triggerVibration([200, 100, 200]);
          return 0;
        }
        if (prev <= 4 && soundEnabled) {
          playRestBeep(660, 0.1);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRestRunning, restRemaining, soundEnabled]);

  const stats = useMemo(() => {
    let completedSets = 0;
    let totalSets = 0;
    let volumeKg = 0;

    for (const ex of liveExercises) {
      for (const s of ex.sets) {
        totalSets += 1;
        if (s.completed) {
          completedSets += 1;
          volumeKg += s.weightKg * s.reps;
        }
      }
    }
    return { completedSets, totalSets, volumeKg: Math.round(volumeKg) };
  }, [liveExercises]);

  const handleStartSession = () => {
    setIsSessionActive(true);
    setIsPaused(false);
    setIsFinished(false);
  };

  const handleResetSession = () => {
    setIsSessionActive(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setIsFinished(false);
    setIsRestRunning(false);
    setRestRemaining(0);
    setObjectiveReport(null);
    setPrToast(null);
    setProgressionApplied(false);
    setLiveExercises(
      routine.blocks.map((block) => ({
        blockId: block.id,
        exercise: block.exercise,
        restSeconds: block.restSeconds || 90,
        supersetGroupId: block.supersetGroupId,
        effort: 'optimal',
        sets: Array.from({ length: block.sets }, (_, i) => ({
          id: `${block.id}-s-${i}`,
          weightKg: block.weightKg,
          reps: block.reps,
          completed: false,
        })),
      }))
    );
  };

  const toggleSetCompleted = (exIndex: number, setIndex: number) => {
    if (!isSessionActive) {
      setIsSessionActive(true);
      setIsPaused(false);
    }

    const targetExercise = liveExercises[exIndex];
    const targetSet = targetExercise?.sets[setIndex];
    if (!targetExercise || !targetSet) return;

    const willComplete = !targetSet.completed;
    let detectedPrType: PrBadgeType | undefined = undefined;

    if (willComplete && targetSet.weightKg > 0 && targetSet.reps > 0) {
      const prevRecord = history[targetExercise.exercise.id];
      const current1RM = computeEpley1RM(targetSet.weightKg, targetSet.reps);
      const currentVol = targetSet.weightKg * targetSet.reps;

      // Máximos ya logrados en series anteriores de esta misma sesión
      const sessionCompletedSets = targetExercise.sets.filter((s, idx) => idx !== setIndex && s.completed);
      const sessionBest1RM = sessionCompletedSets.reduce(
        (max, s) => Math.max(max, computeEpley1RM(s.weightKg, s.reps)),
        0
      );
      const sessionBestVol = sessionCompletedSets.reduce(
        (max, s) => Math.max(max, s.weightKg * s.reps),
        0
      );

      const prevBest1RM = Math.max(prevRecord?.bestEstimated1RM || 0, sessionBest1RM);
      const prevBestVol = Math.max(
        (prevRecord?.bestWeightKg || 0) * (prevRecord?.bestReps || 0),
        sessionBestVol
      );

      const beat1RM = prevBest1RM > 0 && current1RM > prevBest1RM;
      const beatVolume = prevBestVol > 0 && currentVol > prevBestVol;

      if (beat1RM && beatVolume) detectedPrType = 'both';
      else if (beat1RM) detectedPrType = '1rm';
      else if (beatVolume) detectedPrType = 'volume';

      if (detectedPrType) {
        setPrToast({
          title: `¡NUEVO RÉCORD EN ${targetExercise.exercise.name.toUpperCase()}!`,
          subtitle:
            detectedPrType === 'both'
              ? `Superaste tu mejor 1RM (${current1RM} kg) y volumen de serie (${currentVol} kg)`
              : detectedPrType === '1rm'
              ? `Nuevo 1RM estimado: ${current1RM} kg (${targetSet.weightKg} kg × ${targetSet.reps})`
              : `Nuevo récord de volumen en una serie: ${currentVol} kg`,
        });
        setTimeout(() => setPrToast(null), 4000);
      }
    }

    setLiveExercises((prev) =>
      prev.map((ex, eIdx) => {
        if (eIdx !== exIndex) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, sIdx) =>
            sIdx === setIndex
              ? { ...s, completed: willComplete, prType: willComplete ? detectedPrType : undefined }
              : s
          ),
        };
      })
    );

    if (willComplete) {
      if (soundEnabled) {
        if (detectedPrType) playPrCelebrationChime();
        else playRestBeep(784, 0.14);
      }
      triggerVibration(detectedPrType ? [120, 60, 120, 60, 220] : [80]);

      // Lanzar descanso automáticamente al marcar la serie como realizada
      const restSecs = targetExercise.restSeconds || 90;
      if (restSecs > 0) {
        setRestTotal(restSecs);
        setRestRemaining(restSecs);
        setIsRestRunning(true);
      }
    }
  };

  const updateSetField = (
    exIndex: number,
    setIndex: number,
    field: 'weightKg' | 'reps',
    value: number
  ) => {
    setLiveExercises((prev) =>
      prev.map((ex, eIdx) => {
        if (eIdx !== exIndex) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, sIdx) =>
            sIdx === setIndex ? { ...s, [field]: Math.max(0, value) } : s
          ),
        };
      })
    );
  };

  const addWarmupRampToExercise = (exIndex: number) => {
    setLiveExercises((prev) =>
      prev.map((ex, eIdx) => {
        if (eIdx !== exIndex) return ex;
        // Evitar duplicar si ya tiene calentamiento
        if (ex.sets.some((s) => s.isWarmup)) return ex;
        const targetWeight = Math.max(...ex.sets.map((s) => s.weightKg), 0);
        const ramp = generateWarmupRamp(targetWeight, ex.exercise.equipment === 'Barra');
        if (ramp.length === 0) return ex;
        const warmupRows: LiveSetRow[] = ramp.map((r, i) => ({
          id: `${ex.blockId}-wu-${Date.now()}-${i}`,
          weightKg: r.weightKg,
          reps: r.reps,
          completed: false,
          isWarmup: true,
        }));
        return {
          ...ex,
          sets: [...warmupRows, ...ex.sets],
        };
      })
    );
  };

  const addSetToExercise = (exIndex: number) => {
    setLiveExercises((prev) =>
      prev.map((ex, eIdx) => {
        if (eIdx !== exIndex) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: `${ex.blockId}-s-${Date.now()}`,
              weightKg: lastSet ? lastSet.weightKg : 20,
              reps: lastSet ? lastSet.reps : 10,
              completed: false,
            },
          ],
        };
      })
    );
  };

  const removeSetFromExercise = (exIndex: number, setIndex: number) => {
    setLiveExercises((prev) =>
      prev.map((ex, eIdx) => {
        if (eIdx !== exIndex || ex.sets.length <= 1) return ex;
        return {
          ...ex,
          sets: ex.sets.filter((_, sIdx) => sIdx !== setIndex),
        };
      })
    );
  };

  const setExerciseEffort = (exIndex: number, effort: EffortRating) => {
    setLiveExercises((prev) =>
      prev.map((ex, eIdx) => (eIdx === exIndex ? { ...ex, effort } : ex))
    );
  };

  const handleFinishWorkout = () => {
    setIsRestRunning(false);
    setRestRemaining(0);
    setIsFinished(true);

    let latestHistory = loadProgressionHistory();
    let loggedCount = 0;
    const prsBeaten: { exerciseName: string; detail: string }[] = [];
    const muscleMap = new Map<string, number>();
    let easyCount = 0;
    let hardCount = 0;

    for (const ex of liveExercises) {
      const doneSets = ex.sets.filter((s) => s.completed);
      if (doneSets.length === 0) continue;

      loggedCount += 1;
      if (ex.effort === 'easy') easyCount += 1;
      if (ex.effort === 'hard') hardCount += 1;

      muscleMap.set(
        ex.exercise.muscleGroup,
        (muscleMap.get(ex.exercise.muscleGroup) || 0) + doneSets.length
      );

      // Detectar si se batió PR en este ejercicio
      const prSet = doneSets.find((s) => s.prType);
      if (prSet) {
        const best1RM = Math.max(...doneSets.map((s) => computeEpley1RM(s.weightKg, s.reps)));
        prsBeaten.push({
          exerciseName: ex.exercise.name,
          detail: `1RM est. ${best1RM} kg (${prSet.weightKg}kg × ${prSet.reps})`,
        });
      }

      const maxWeight = Math.max(...doneSets.map((s) => s.weightKg));
      const avgReps = Math.round(
        doneSets.reduce((acc, s) => acc + s.reps, 0) / doneSets.length
      );

      latestHistory = recordSingleExerciseCompletion(
        {
          id: ex.blockId,
          exercise: ex.exercise,
          sets: doneSets.length,
          reps: avgReps,
          weightKg: maxWeight,
          restSeconds: ex.restSeconds,
        },
        ex.effort
      );
    }

    const completionPct =
      stats.totalSets > 0 ? Math.round((stats.completedSets / stats.totalSets) * 100) : 0;
    const durationMinutes = Math.max(1, elapsedSeconds / 60);
    const densityKgPerMin = Math.round(stats.volumeKg / durationMinutes);

    const muscleBreakdown = Array.from(muscleMap.entries())
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);

    // Diagnóstico objetivo del entrenador según cumplimiento, PRs y esfuerzo
    let verdictTitle = 'Sesión Sólida de Mantenimiento y Progreso';
    let verdictBody = `Has completado el ${completionPct}% de las series planificadas con una densidad de ${densityKgPerMin} kg/min.`;

    if (completionPct === 100 && prsBeaten.length > 0) {
      verdictTitle = 'Rendimiento Sobresaliente · Récords Batidos';
      verdictBody = `Completaste el 100% del volumen (${stats.volumeKg} kg) batiendo ${prsBeaten.length} ${prsBeaten.length === 1 ? 'récord personal' : 'récords personales'} a una densidad de ${densityKgPerMin} kg/min. Estás listo para aplicar Progresión Automática en la próxima sesión.`;
    } else if (completionPct >= 85 && easyCount > hardCount) {
      verdictTitle = 'Margen de Carga Disponible';
      verdictBody = `Completaste el ${completionPct}% de la sesión percibiendo varios ejercicios como "Fácil". Recomendación objetiva: aplica Progresión Auto para subir +2.5 kg o +1-2 reps en la siguiente sesión.`;
    } else if (hardCount >= Math.max(2, Math.ceil(loggedCount / 2))) {
      verdictTitle = 'Alta Exigencia Neural y Muscular';
      verdictBody = `Terminaste con ${stats.volumeKg} kg movidos y varios bloques al límite. Recomendación objetiva: consolida estas cargas y respeta tus descansos antes de volver a subir peso.`;
    }

    setObjectiveReport({
      durationSeconds: elapsedSeconds,
      completionPct,
      completedSets: stats.completedSets,
      totalSets: stats.totalSets,
      volumeKg: stats.volumeKg,
      densityKgPerMin,
      prsBeaten,
      muscleBreakdown,
      verdictTitle,
      verdictBody,
    });

    setHistory(latestHistory);
    onWorkoutSaved(
      latestHistory,
      `Entreno en vivo finalizado (${formatDuration(elapsedSeconds)} · ${stats.completedSets} series · ${stats.volumeKg} kg). Progreso guardado en ${loggedCount} ejercicios.`
    );
  };

  if (routine.blocks.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-dashed border-border/80 p-10 text-center saas-card space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200/70 flex items-center justify-center mx-auto text-blue-600">
          <Dumbbell className="w-7 h-7" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-lg font-bold text-foreground">No hay rutina cargada para entrenar</h3>
          <p className="text-sm text-muted-foreground">
            Añade ejercicios en el Diseñador o genera una sesión con el Asistente IA para empezar tu Entreno en Vivo.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCatalog}
          className="saas-btn btn-glow-blue inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Ejercicios</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Cabecera Sticky de Sesión en Vivo */}
      <section className="bg-card rounded-2xl border border-border/60 p-5 sm:p-6 saas-card sticky top-[120px] z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  {isFinished ? 'Sesión Finalizada' : isSessionActive ? 'Entreno en Curso' : 'Listo para empezar'}
                </span>
                {isSessionActive && !isPaused && !isFinished && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-foreground font-mono tabular-nums tracking-tight">
                {formatDuration(elapsedSeconds)}
              </div>
            </div>
          </div>

          {/* Métricas en tiempo real + Controles */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 bg-muted/40 px-3.5 py-2 rounded-xl border border-border/60 text-xs tabular-nums">
              <div>
                <span className="text-muted-foreground">Series: </span>
                <span className="font-bold text-foreground">
                  {stats.completedSets}/{stats.totalSets}
                </span>
              </div>
              <span className="text-border">|</span>
              <div>
                <span className="text-muted-foreground">Volumen: </span>
                <span className="font-bold text-blue-600">{stats.volumeKg} kg</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              title={soundEnabled ? 'Silenciar avisos de descanso' : 'Activar avisos de descanso'}
              className="saas-btn p-2.5 rounded-xl bg-muted/50 hover:bg-muted border border-border/60 text-foreground"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            </button>

            {!isSessionActive ? (
              <button
                type="button"
                onClick={handleStartSession}
                className="saas-btn btn-glow-blue px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>Iniciar Entreno</span>
              </button>
            ) : !isFinished ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="saas-btn px-3.5 py-2.5 rounded-xl bg-muted/60 hover:bg-muted border border-border/60 text-foreground text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Reanudar' : 'Pausar'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinishWorkout}
                  className="saas-btn px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finalizar</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleResetSession}
                className="saas-btn px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nueva Sesión</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Celebración Instantánea de Nuevo PR (B) */}
      {prToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 rounded-2xl p-4 shadow-2xl border-2 border-amber-300 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-11 h-11 rounded-xl bg-white/90 text-amber-600 flex items-center justify-center shrink-0 shadow-sm animate-bounce">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{prToast.title}</span>
            </div>
            <p className="text-xs font-semibold text-slate-900/90 mt-0.5 leading-snug">
              {prToast.subtitle}
            </p>
          </div>
        </div>
      )}

      {/* Informe de Feedback Objetivo Post-Sesión (C) */}
      {isFinished && objectiveReport && (
        <section className="bg-card border border-emerald-200/80 rounded-2xl p-6 sm:p-7 saas-card space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Análisis Objetivo Post-Sesión
                </span>
                <h3 className="font-bold text-lg text-foreground leading-snug">
                  {objectiveReport.verdictTitle}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  {objectiveReport.verdictBody}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Métricas Clave */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/30 border border-border/60 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-muted-foreground">Cumplimiento</div>
              <div className="text-xl font-black text-foreground tabular-nums mt-0.5">
                {objectiveReport.completionPct}%
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {objectiveReport.completedSets}/{objectiveReport.totalSets} series
              </div>
            </div>

            <div className="bg-muted/30 border border-border/60 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-muted-foreground">Tonelaje Total</div>
              <div className="text-xl font-black text-blue-600 tabular-nums mt-0.5">
                {objectiveReport.volumeKg} kg
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {formatDuration(objectiveReport.durationSeconds)}
              </div>
            </div>

            <div className="bg-muted/30 border border-border/60 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-muted-foreground">Densidad</div>
              <div className="text-xl font-black text-indigo-600 tabular-nums mt-0.5">
                {objectiveReport.densityKgPerMin} kg/m
              </div>
              <div className="text-[11px] text-muted-foreground">Ritmo de trabajo</div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-amber-800">Récords Hoy</div>
              <div className="text-xl font-black text-amber-700 tabular-nums mt-0.5">
                {objectiveReport.prsBeaten.length} PR
              </div>
              <div className="text-[11px] text-amber-800/80">1RM o Volumen</div>
            </div>
          </div>

          {/* Reparto Muscular + PRs Batidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Target className="w-3.5 h-3.5 text-blue-600" />
                <span>Estímulo por Grupo Muscular</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {objectiveReport.muscleBreakdown.map((m) => (
                  <span
                    key={m.muscle}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/70 text-xs font-semibold tabular-nums"
                  >
                    {m.muscle}: {m.sets} series
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span>Marcas Superadas Hoy</span>
              </div>
              {objectiveReport.prsBeaten.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin nuevos récords hoy; sesión sólida de consolidación.
                </p>
              ) : (
                <ul className="space-y-1">
                  {objectiveReport.prsBeaten.map((pr, idx) => (
                    <li key={idx} className="text-xs text-amber-900 font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                      <span className="truncate">
                        <strong>{pr.exerciseName}:</strong> {pr.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {onApplyNextProgression && (
            <div className="pt-3 border-t border-border/60 flex justify-end">
              <button
                type="button"
                disabled={progressionApplied}
                onClick={() => {
                  onApplyNextProgression();
                  setProgressionApplied(true);
                }}
                className={`saas-btn px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 ${
                  progressionApplied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white btn-glow-indigo'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>
                  {progressionApplied
                    ? 'Progresión aplicada a tu rutina'
                    : 'Aplicar Progresión Auto para la Próxima'}
                </span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* Lista Interactiva de Ejercicios y Series */}
      <div className="space-y-4">
        {liveExercises.map((ex, exIndex) => {
          const prevRecord = history[ex.exercise.id];
          const completedInEx = ex.sets.filter((s) => s.completed).length;

          return (
            <div
              key={ex.blockId}
              className="bg-card rounded-2xl border border-border/60 p-5 sm:p-6 saas-card space-y-4"
            >
              {/* Cabecera del Ejercicio */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70 text-[11px] font-bold">
                      {ex.exercise.muscleGroup}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {completedInEx}/{ex.sets.length} series
                    </span>
                    {ex.supersetGroupId && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                        Superserie
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    {exIndex + 1}. {ex.exercise.name}
                  </h3>
                  {notesMap[ex.exercise.id]?.setupNote && (
                    <p className="text-xs text-blue-700 bg-blue-50/70 border border-blue-200/60 px-2.5 py-1 rounded-lg inline-block">
                      Ajuste: {notesMap[ex.exercise.id].setupNote}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActive3DExercise(ex.exercise)}
                    title="Ver técnica correcta en 3D sin pausar tu cronómetro"
                    className="saas-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 text-xs font-semibold"
                  >
                    <Box className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ayuda 3D</span>
                  </button>

                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60 tabular-nums">
                    <Timer className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{ex.restSeconds}s</span>
                  </div>
                </div>
              </div>

              {/* Tabla de Series Interactiva */}
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-2 text-center">Serie</div>
                  <div className="col-span-3 text-center">Anterior</div>
                  <div className="col-span-3 text-center">Kg</div>
                  <div className="col-span-2 text-center">Reps</div>
                  <div className="col-span-2 text-center">Hecho</div>
                </div>

                {ex.sets.map((setRow, setIndex) => {
                  const workingSetNumber = ex.sets.slice(0, setIndex + 1).filter((s) => !s.isWarmup).length;
                  return (
                  <div
                    key={setRow.id}
                    className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-all duration-300 ${
                      setRow.prType
                        ? 'bg-gradient-to-r from-amber-50/90 via-yellow-50/70 to-emerald-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-sm'
                        : setRow.completed
                        ? 'bg-emerald-50/70 border-emerald-200/90'
                        : setRow.isWarmup
                        ? 'bg-amber-50/40 border-amber-200/60'
                        : 'bg-muted/25 border-border/60 hover:bg-muted/40'
                    }`}
                  >
                    <div className="col-span-2 flex items-center justify-center gap-1">
                      <span
                        className={`w-7 h-7 rounded-lg border text-[10px] font-bold flex items-center justify-center tabular-nums ${
                          setRow.prType
                            ? 'bg-amber-500 border-amber-400 text-white animate-pulse'
                            : setRow.isWarmup
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-card border-border/60 text-foreground text-xs'
                        }`}
                        title={setRow.prType ? '¡Nuevo PR!' : setRow.isWarmup ? 'Serie de calentamiento' : undefined}
                      >
                        {setRow.prType ? <Trophy className="w-3.5 h-3.5" /> : setRow.isWarmup ? 'CAL' : workingSetNumber}
                      </span>
                      {ex.sets.length > 1 && !setRow.completed && (
                        <button
                          type="button"
                          onClick={() => removeSetFromExercise(exIndex, setIndex)}
                          title="Eliminar serie"
                          className="p-1 text-muted-foreground hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="col-span-3 text-center text-xs text-muted-foreground font-medium tabular-nums">
                      {prevRecord
                        ? `${prevRecord.lastWeightKg}kg × ${prevRecord.lastReps}`
                        : '—'}
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        step={1.25}
                        min={0}
                        value={setRow.weightKg}
                        onChange={(e) =>
                          updateSetField(exIndex, setIndex, 'weightKg', parseFloat(e.target.value) || 0)
                        }
                        className="w-full min-h-[38px] text-center font-bold text-foreground bg-card border border-border/70 rounded-lg text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="number"
                        min={0}
                        value={setRow.reps}
                        onChange={(e) =>
                          updateSetField(exIndex, setIndex, 'reps', parseInt(e.target.value) || 0)
                        }
                        className="w-full min-h-[38px] text-center font-bold text-foreground bg-card border border-border/70 rounded-lg text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="col-span-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => toggleSetCompleted(exIndex, setIndex)}
                        aria-label="Marcar serie como realizada"
                        className={`saas-btn w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                          setRow.completed
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-card border-border/80 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600'
                        }`}
                      >
                        <Check className="w-5 h-5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Pie del ejercicio: Añadir serie + Rampa Calentamiento + Selector de dificultad */}
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addSetToExercise(exIndex)}
                    className="saas-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-foreground border border-border/60 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Serie</span>
                  </button>

                  {!ex.sets.some((s) => s.isWarmup) && Math.max(...ex.sets.map((s) => s.weightKg), 0) >= 25 && (
                    <button
                      type="button"
                      onClick={() => addWarmupRampToExercise(exIndex)}
                      title="Generar series progresivas de aproximación (sin fatiga)"
                      className="saas-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs font-semibold"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      <span>Rampa Calent.</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                    Esfuerzo:
                  </span>
                  {(
                    [
                      { id: 'easy', label: 'Fácil', cls: 'bg-emerald-600 text-white border-emerald-600' },
                      { id: 'optimal', label: 'Óptimo', cls: 'bg-blue-600 text-white border-blue-600' },
                      { id: 'hard', label: 'Al límite', cls: 'bg-amber-600 text-white border-amber-600' }
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setExerciseEffort(exIndex, opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        ex.effort === opt.id
                          ? opt.cls
                          : 'bg-muted/30 text-muted-foreground border-border/60 hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra Flotante del Temporizador de Descanso Automático */}
      {isRestRunning && restRemaining > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                <Flame className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  Descanso Automático
                </div>
                <div className="text-2xl font-mono font-black tabular-nums">
                  {formatDuration(restRemaining)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRestRemaining((r) => Math.max(5, r - 15))}
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold tabular-nums"
              >
                -15s
              </button>
              <button
                type="button"
                onClick={() => setRestRemaining((r) => r + 15)}
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold tabular-nums"
              >
                +15s
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRestRunning(false);
                  setRestRemaining(0);
                }}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold inline-flex items-center gap-1"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Saltar</span>
              </button>
            </div>
          </div>

          {restTotal > 0 && (
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min(100, Math.round((restRemaining / restTotal) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Visor 3D Contextual sin detener el cronómetro (A) */}
      <Exercise3DModal
        exercise={active3DExercise}
        cues={active3DExercise ? expertMap.get(active3DExercise.id)?.executionCues : undefined}
        machineLabel={active3DExercise ? expertMap.get(active3DExercise.id)?.machineLabel : undefined}
        onClose={() => setActive3DExercise(null)}
      />
    </div>
  );
}
