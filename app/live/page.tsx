'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Dumbbell,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Share2,
  ArrowLeft,
  Flame,
  Clock,
  Sparkles,
  Watch
} from 'lucide-react';
import { decodeRoutineFromShareUrl } from '@/lib/share-utils';
import { StrengthRoutine, WorkoutExerciseBlock } from '@/lib/types';
import { useWakeLock } from '@/lib/use-wake-lock';
import {
  EffortRating,
  recordSingleExerciseCompletion
} from '@/lib/progressive-overload-engine';

// Reproduce un pitido sintético mediante Web Audio API (compatible con Safari iOS y Android)
function playBeep(frequency = 880, duration = 0.15) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    // ignore
  }
}

function triggerHaptic(pattern = [150, 100, 150]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (err) {
    // ignore
  }
}

function LiveWorkoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [routine, setRoutine] = useState<StrengthRoutine | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Estados del seguimiento en vivo
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(1); // 1-based
  const [phase, setPhase] = useState<'warmup' | 'work' | 'rest' | 'cooldown' | 'finished'>('work');
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isWatchMode, setIsWatchMode] = useState(false);

  useEffect(() => {
    if (searchParams.get('watch') === '1' || (typeof window !== 'undefined' && window.innerWidth <= 280)) {
      setIsWatchMode(true);
    }
  }, [searchParams]);

  // Métricas acumuladas de la sesión
  const [sessionStartTime] = useState<number>(Date.now());
  const [totalCompletedSets, setTotalCompletedSets] = useState(0);
  const [totalVolumeKg, setTotalVolumeKg] = useState(0);
  const [exerciseEfforts, setExerciseEfforts] = useState<Record<string, EffortRating>>({});

  // Mantener pantalla encendida en modo gimnasio mientras la sesión está activa
  const { isActive: wakeLockActive } = useWakeLock(phase !== 'finished');

  // Cargar rutina desde el parámetro de URL
  useEffect(() => {
    const rawData = searchParams.get('data');
    if (!rawData) {
      // Intentar cargar del localStorage como fallback
      try {
        const saved = localStorage.getItem('garmin_strength_current_routine');
        if (saved) {
          setRoutine(JSON.parse(saved));
          return;
        }
      } catch (e) {
        // ignore
      }
      setLoadError('No se encontró ninguna rutina para seguir en este enlace.');
      return;
    }

    const decoded = decodeRoutineFromShareUrl(rawData);
    if (!decoded || !decoded.blocks || decoded.blocks.length === 0) {
      setLoadError('El formato de la rutina compartida no es válido o está incompleto.');
      return;
    }

    setRoutine(decoded);
    // Iniciar con calentamiento si existe
    if (decoded.warmupSeconds > 0) {
      setPhase('warmup');
      setRestSecondsRemaining(decoded.warmupSeconds);
      setIsTimerRunning(true);
    } else {
      setPhase('work');
    }
  }, [searchParams]);

  // Manejo del temporizador (Countdown)
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && restSecondsRemaining > 0) {
      interval = setInterval(() => {
        setRestSecondsRemaining(prev => {
          if (prev <= 1) {
            // Fin de la cuenta atrás
            if (soundEnabled) {
              playBeep(1046, 0.4); // Nota C6 alta
            }
            triggerHaptic([200, 100, 200, 100, 300]);
            handleTimerComplete();
            return 0;
          }

          // Aviso sonoro en los últimos 3 segundos
          if (prev <= 4 && soundEnabled) {
            playBeep(659, 0.1);
            triggerHaptic([100]);
          }

          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, restSecondsRemaining, soundEnabled]);

  const handleTimerComplete = () => {
    setIsTimerRunning(false);

    if (phase === 'warmup') {
      setPhase('work');
    } else if (phase === 'rest') {
      setPhase('work');
    } else if (phase === 'cooldown') {
      setPhase('finished');
    }
  };

  // Completar la serie activa
  const handleCompleteSet = () => {
    if (!routine) return;
    const currentBlock = routine.blocks[currentBlockIndex];
    if (!currentBlock) return;

    // Registrar volumen
    setTotalCompletedSets(prev => prev + 1);
    setTotalVolumeKg(prev => prev + currentBlock.weightKg * currentBlock.reps);

    if (soundEnabled) {
      playBeep(784, 0.2); // Nota G5
    }
    triggerHaptic([120, 80, 120]);

    const restSecs = currentBlock.restSeconds ?? 90;

    // ¿Quedan más series de este mismo ejercicio?
    if (currentSetIndex < currentBlock.sets) {
      setCurrentSetIndex(prev => prev + 1);
      if (restSecs > 0) {
        setPhase('rest');
        setRestSecondsRemaining(restSecs);
        setIsTimerRunning(true);
      } else {
        setPhase('work');
      }
    } else {
      // Fin de las series de este ejercicio: avanzar al siguiente
      if (currentBlockIndex + 1 < routine.blocks.length) {
        setCurrentBlockIndex(prev => prev + 1);
        setCurrentSetIndex(1);
        if (restSecs > 0) {
          setPhase('rest');
          setRestSecondsRemaining(restSecs);
          setIsTimerRunning(true);
        } else {
          setPhase('work');
        }
      } else {
        // ¿Hay enfriamiento?
        if (routine.cooldownSeconds > 0) {
          setPhase('cooldown');
          setRestSecondsRemaining(routine.cooldownSeconds);
          setIsTimerRunning(true);
        } else {
          setPhase('finished');
        }
      }
    }
  };

  const skipRest = () => {
    setIsTimerRunning(false);
    setRestSecondsRemaining(0);
    if (phase === 'warmup' || phase === 'rest') {
      setPhase('work');
    } else if (phase === 'cooldown') {
      setPhase('finished');
    }
  };

  const addRestTime = (seconds: number) => {
    setRestSecondsRemaining(prev =>
      seconds < 0 ? Math.max(5, prev + seconds) : prev + seconds
    );
  };

  // Ajuste en tiempo real de descanso, pesos y repeticiones
  const setLiveRest = (seconds: number) => {
    if (!routine) return;
    const clamped = Math.max(0, Math.min(600, Math.round(seconds)));
    setRoutine(prev => {
      if (!prev) return prev;
      const newBlocks = [...prev.blocks];
      const cur = newBlocks[currentBlockIndex];
      if (!cur) return prev;
      newBlocks[currentBlockIndex] = { ...cur, restSeconds: clamped };
      return { ...prev, blocks: newBlocks };
    });
  };

  const updateLiveRest = (delta: number) => {
    if (!routine) return;
    const cur = routine.blocks[currentBlockIndex];
    if (!cur) return;
    setLiveRest((cur.restSeconds ?? 90) + delta);
  };

  // Ajuste en tiempo real de pesos y repeticiones (para adaptar a cada persona en el gym)
  const updateLiveWeight = (delta: number) => {
    if (!routine) return;
    setRoutine(prev => {
      if (!prev) return prev;
      const newBlocks = [...prev.blocks];
      const cur = newBlocks[currentBlockIndex];
      if (!cur) return prev;
      const newWeight = Math.max(0, parseFloat((cur.weightKg + delta).toFixed(1)));
      newBlocks[currentBlockIndex] = { ...cur, weightKg: newWeight };
      return { ...prev, blocks: newBlocks };
    });
  };

  const updateLiveReps = (delta: number) => {
    if (!routine) return;
    setRoutine(prev => {
      if (!prev) return prev;
      const newBlocks = [...prev.blocks];
      const cur = newBlocks[currentBlockIndex];
      if (!cur) return prev;
      const newReps = Math.max(1, cur.reps + delta);
      newBlocks[currentBlockIndex] = { ...cur, reps: newReps };
      return { ...prev, blocks: newBlocks };
    });
  };

  // Formatear segundos en MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Dumbbell className="w-12 h-12 text-slate-500 mx-auto" />
          <h1 className="text-xl font-bold">Enlace no válido</h1>
          <p className="text-sm text-slate-400">{loadError}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm transition-all"
          >
            Ir al Studio de Rutinas
          </button>
        </div>
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-sm font-medium text-slate-400 animate-pulse">Cargando entrenamiento...</div>
      </div>
    );
  }

  const currentBlock = routine.blocks[currentBlockIndex];
  const nextBlock = routine.blocks[currentBlockIndex + 1];

  // Vista Ultra-Compacta OLED para Apple Watch Series 4 (watchOS WebKit / pantalla 40-44mm)
  if (isWatchMode) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-between p-3 select-none">
        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
          <span className="font-semibold text-blue-400 truncate">{routine.name}</span>
          <button
            type="button"
            onClick={() => setIsWatchMode(false)}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
          >
            Móvil
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2.5 my-2">
          {phase === 'finished' ? (
            <>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div className="text-sm font-bold">Entreno Completado</div>
              <div className="text-xs text-slate-400 tabular-nums">
                {totalCompletedSets} series &bull; {totalVolumeKg} kg
              </div>
            </>
          ) : phase === 'rest' || phase === 'warmup' || phase === 'cooldown' ? (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                {phase === 'rest' ? 'Descanso' : phase === 'warmup' ? 'Calentamiento' : 'Enfriamiento'}
              </div>
              <div className="text-4xl font-mono font-extrabold tabular-nums text-white">
                {formatTime(restSecondsRemaining)}
              </div>
              <div className="flex items-center gap-1.5 w-full pt-1">
                <button
                  type="button"
                  onClick={() => addRestTime(-15)}
                  className="px-2.5 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-xs font-semibold active:scale-95"
                >
                  -15s
                </button>
                <button
                  type="button"
                  onClick={() => addRestTime(30)}
                  className="flex-1 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-xs font-semibold active:scale-95"
                >
                  +30s
                </button>
                <button
                  type="button"
                  onClick={skipRest}
                  className="flex-1 py-2.5 rounded-full bg-blue-600 text-xs font-bold active:scale-95"
                >
                  Seguir
                </button>
              </div>
            </>
          ) : currentBlock ? (
            <>
              <div className="px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-[10px] font-bold text-blue-300 tabular-nums">
                Serie {currentSetIndex}/{currentBlock.sets} &bull; Ej {currentBlockIndex + 1}/{routine.blocks.length}
              </div>
              <div className="text-sm font-bold leading-tight line-clamp-2 px-1">
                {currentBlock.exercise.name}
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">
                {currentBlock.reps} &times; {currentBlock.weightKg > 0 ? `${currentBlock.weightKg}kg` : 'Libre'}
              </div>
              <button
                type="button"
                onClick={handleCompleteSet}
                className="w-full py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md active:scale-95 transition-transform"
              >
                Serie Hecha
              </button>
            </>
          ) : null}
        </div>

        <div className="text-center text-[10px] text-slate-500 tabular-nums">
          {nextBlock ? `Sig: ${nextBlock.exercise.name}` : 'Último bloque'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none">
      {/* Barra Superior */}
      <header className="px-4 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">{routine.name}</h1>
            <p className="text-[11px] text-slate-400">Modo Gym Live · Compañero Móvil</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsWatchMode(true)}
            title="Modo compacto OLED Apple Watch"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1.5 transition-all"
          >
            <Watch className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Apple Watch</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg text-xs font-semibold transition-all ${
              soundEnabled ? 'text-blue-400 bg-blue-950/40 border border-blue-800/60' : 'text-slate-500 bg-slate-800'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ÁREA PRINCIPAL INTERACTIVA */}
      <main className="flex-1 flex flex-col justify-center max-w-lg w-full mx-auto p-5 sm:p-6 text-center space-y-6">
        {/* FASE: ENFRIAMIENTO O CALENTAMIENTO */}
        {(phase === 'warmup' || phase === 'cooldown') && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-3.5 h-3.5" />
              <span>{phase === 'warmup' ? 'Calentamiento Articular' : 'Enfriamiento y Estiramientos'}</span>
            </div>

            <div className="text-6xl sm:text-7xl font-mono font-extrabold text-white tracking-wider tabular-nums">
              {formatTime(restSecondsRemaining)}
            </div>

            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {phase === 'warmup'
                ? 'Prepara tu musculatura para el primer bloque de trabajo.'
                : 'Estira suavemente los grupos musculares trabajados.'}
            </p>

            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => addRestTime(30)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 active:scale-95"
              >
                +30 seg
              </button>
              <button
                onClick={skipRest}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md active:scale-95"
              >
                Comenzar Ejercicios
              </button>
            </div>
          </div>
        )}

        {/* FASE: TRABAJO ACTIVO (SERIE DE EJERCICIO) */}
        {phase === 'work' && currentBlock && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Indicador de Ejercicio y Músculo */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {currentBlock.exercise.muscleGroup}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Ejercicio {currentBlockIndex + 1} de {routine.blocks.length}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {currentBlock.exercise.name}
              </h2>
            </div>

            {/* Número de Serie */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-lg max-w-sm mx-auto">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Serie en Curso
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white tabular-nums">
                {currentSetIndex} <span className="text-xl text-slate-500 font-medium">/ {currentBlock.sets}</span>
              </div>

              {/* Reps y Peso con ajuste interactivo en vivo */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/50">
                  <div className="text-[11px] text-slate-400 uppercase font-bold mb-1">Reps Objetivo</div>
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => updateLiveReps(-1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm active:scale-95 flex items-center justify-center"
                    >
                      -
                    </button>
                    <div className="text-xl sm:text-2xl font-bold text-white tabular-nums px-1">
                      {currentBlock.reps} <span className="text-xs text-slate-400 font-normal">reps</span>
                    </div>
                    <button
                      onClick={() => updateLiveReps(1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm active:scale-95 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/50">
                  <div className="text-[11px] text-slate-400 uppercase font-bold mb-1">Tu Carga (kg)</div>
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => updateLiveWeight(-2.5)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs active:scale-95 flex items-center justify-center"
                    >
                      -2.5
                    </button>
                    <div className="text-xl sm:text-2xl font-bold text-white tabular-nums px-1">
                      {currentBlock.weightKg} <span className="text-xs text-slate-400 font-normal">kg</span>
                    </div>
                    <button
                      onClick={() => updateLiveWeight(2.5)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs active:scale-95 flex items-center justify-center"
                    >
                      +2.5
                    </button>
                  </div>
                </div>
              </div>

              {/* Modificación en vivo del descanso entre series */}
              <div className="mt-3 pt-3 border-t border-slate-800 bg-slate-950/60 p-3 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 uppercase font-bold">
                    Descanso entre series
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateLiveRest(-15)}
                      className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs active:scale-95"
                    >
                      -15s
                    </button>
                    <span className="text-sm font-bold text-white tabular-nums min-w-[54px] text-center">
                      {(currentBlock.restSeconds ?? 90) === 0
                        ? '0s'
                        : `${currentBlock.restSeconds ?? 90}s`}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateLiveRest(15)}
                      className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs active:scale-95"
                    >
                      +15s
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {[60, 90, 120, 180].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLiveRest(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border tabular-nums transition-all active:scale-95 ${
                        (currentBlock.restSeconds ?? 90) === preset
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {preset}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Próximo paso de vista previa */}
            <div className="text-xs text-slate-500">
              {currentSetIndex < currentBlock.sets ? (
                <span>
                  Siguiente: Serie {currentSetIndex + 1}
                  {(currentBlock.restSeconds ?? 90) > 0
                    ? ` tras ${currentBlock.restSeconds ?? 90}s de descanso`
                    : ' (sin descanso)'}
                </span>
              ) : nextBlock ? (
                <span>Siguiente ejercicio: <strong className="text-slate-400">{nextBlock.exercise.name}</strong></span>
              ) : (
                <span>¡Último ejercicio de la sesión!</span>
              )}
            </div>
          </div>
        )}

        {/* FASE: DESCANSO ACTIVO (COUNTDOWN) */}
        {phase === 'rest' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock className="w-3.5 h-3.5" />
              <span>Tiempo de Descanso</span>
            </div>

            <div className="text-6xl sm:text-7xl font-mono font-black text-white tracking-widest tabular-nums drop-shadow-md">
              {formatTime(restSecondsRemaining)}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-sm mx-auto text-left">
              <div className="text-[11px] font-bold uppercase text-slate-400">A continuación:</div>
              <div className="text-sm font-bold text-white mt-1">
                {currentSetIndex <= currentBlock.sets
                  ? `${currentBlock.exercise.name} (Serie ${currentSetIndex}/${currentBlock.sets})`
                  : nextBlock
                  ? `${nextBlock.exercise.name} (Serie 1/${nextBlock.sets})`
                  : 'Fin de sesión'}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => addRestTime(-15)}
                className="min-h-[42px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 active:scale-95 tabular-nums"
              >
                -15s
              </button>
              <button
                type="button"
                onClick={() => addRestTime(15)}
                className="min-h-[42px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 active:scale-95 tabular-nums"
              >
                +15s
              </button>
              <button
                type="button"
                onClick={() => addRestTime(30)}
                className="min-h-[42px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 active:scale-95 tabular-nums"
              >
                +30s
              </button>
              <button
                type="button"
                onClick={skipRest}
                className="min-h-[42px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <SkipForward className="w-4 h-4" />
                <span>Saltar Descanso</span>
              </button>
            </div>
          </div>
        )}

        {/* FASE: FINALIZADO */}
        {phase === 'finished' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-3xl font-black text-white">¡Entrenamiento Completado!</h2>
              <p className="text-sm text-slate-400 mt-1">Has finalizado todos los bloques con éxito.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <div className="text-xs text-slate-400 font-semibold uppercase">Series Totales</div>
                <div className="text-2xl font-bold text-white mt-1">{totalCompletedSets}</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <div className="text-xs text-slate-400 font-semibold uppercase">Volumen Movido</div>
                <div className="text-2xl font-bold text-white mt-1">{totalVolumeKg} kg</div>
              </div>
            </div>

            {/* Feedback de dificultad individual por ejercicio */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto space-y-3 text-left">
              <div className="text-center space-y-1">
                <div className="text-xs font-bold text-slate-200">
                  ¿Cómo te ha costado cada ejercicio hoy?
                </div>
                <p className="text-[11px] text-slate-400">
                  Puntúa cada ejercicio por separado para ajustar la carga progresiva individualmente.
                </p>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {routine.blocks.map((block) => {
                  const selected = exerciseEfforts[block.id];
                  return (
                    <div
                      key={block.id}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-white truncate">
                          {block.exercise.name}
                        </span>
                        <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                          {block.sets}&times;{block.reps} &bull; {block.weightKg}kg
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'easy', label: 'Fácil', active: 'bg-emerald-600 text-white border-emerald-500' },
                            { id: 'optimal', label: 'Óptimo', active: 'bg-blue-600 text-white border-blue-500' },
                            { id: 'hard', label: 'Al límite', active: 'bg-amber-600 text-white border-amber-500' }
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              recordSingleExerciseCompletion(block, opt.id);
                              setExerciseEfforts(prev => ({ ...prev, [block.id]: opt.id }));
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
                              selected === opt.id
                                ? opt.active
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg transition-all active:scale-95"
            >
              Volver al Studio
            </button>
          </div>
        )}
      </main>

      {/* BOTÓN INFERIOR DE ACCIÓN (GIGANTE Y ERGONÓMICO) */}
      {phase === 'work' && (
        <div className="p-4 bg-slate-900/95 border-t border-slate-800 max-w-lg w-full mx-auto">
          <button
            onClick={handleCompleteSet}
            className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-lg tracking-wide shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98] min-h-[60px] flex items-center justify-center gap-2"
          >
            <span>Terminar Serie → Descanso</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function LiveWorkoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>}>
      <LiveWorkoutContent />
    </Suspense>
  );
}
