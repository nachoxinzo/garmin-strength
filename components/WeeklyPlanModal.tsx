'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Layers,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { StrengthRoutine } from '@/lib/types';
import { ExperienceLevel, TrainingGoal } from '@/lib/scientific-workout-generator';
import {
  buildCustomWeeklyPlan,
  getTodayWeekKey,
  loadWeeklyPlan,
  saveWeeklyPlan,
  WEEK_DAYS,
  WeekDayKey,
  WeeklyPlanMap,
  WeeklySplitStyle,
} from '@/lib/weekly-planner';
import { loadMyGymProfile } from '@/lib/smart-workout-engine';

interface WeeklyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoutine: StrengthRoutine;
  onLoadRoutine: (routine: StrengthRoutine) => void;
}

export function WeeklyPlanModal({
  isOpen,
  onClose,
  currentRoutine,
  onLoadRoutine,
}: WeeklyPlanModalProps) {
  const [plan, setPlan] = useState<WeeklyPlanMap>({});
  const [selectedDays, setSelectedDays] = useState<WeekDayKey[]>(['mon', 'tue', 'thu', 'fri']);
  const [splitStyle, setSplitStyle] = useState<WeeklySplitStyle>('auto');
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [level, setLevel] = useState<ExperienceLevel>('intermediate');
  const [durationMinutes, setDurationMinutes] = useState<45 | 60 | 75 | 90>(60);
  const [useGymProfile, setUseGymProfile] = useState(true);
  const [moveSourceDay, setMoveSourceDay] = useState<WeekDayKey | null>(null);
  const [gymName, setGymName] = useState('Mi Gimnasio Habitual');

  const todayKey = getTodayWeekKey();

  useEffect(() => {
    if (isOpen) {
      const loaded = loadWeeklyPlan();
      setPlan(loaded);
      const activeKeys = WEEK_DAYS.map((d) => d.key).filter((k) => Boolean(loaded[k]));
      if (activeKeys.length >= 2) {
        setSelectedDays(activeKeys);
      }
      setGymName(loadMyGymProfile().gymName);
      setMoveSourceDay(null);
    }
  }, [isOpen]);

  const weeklyStats = useMemo(() => {
    const entries = Object.values(plan).filter(Boolean) as StrengthRoutine[];
    const totalSessions = entries.length;
    const totalSets = entries.reduce(
      (acc, r) => acc + r.blocks.reduce((bAcc, b) => bAcc + b.sets, 0),
      0
    );
    const totalExercises = entries.reduce((acc, r) => acc + r.blocks.length, 0);
    return { totalSessions, totalSets, totalExercises };
  }, [plan]);

  if (!isOpen) return null;

  const toggleDay = (day: WeekDayKey) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const applyQuickDays = (days: WeekDayKey[], style: WeeklySplitStyle = 'auto') => {
    setSelectedDays(days);
    setSplitStyle(style);
  };

  const handleGenerateCustomWeek = () => {
    if (selectedDays.length === 0) return;
    const generated = buildCustomWeeklyPlan({
      selectedDays,
      splitStyle,
      goal,
      level,
      durationMinutes,
      useGymProfile,
    });
    setPlan(generated);
    saveWeeklyPlan(generated);
    setMoveSourceDay(null);
  };

  const handleRegenerateSingleDay = (day: WeekDayKey) => {
    const singlePlan = buildCustomWeeklyPlan({
      selectedDays: [day],
      splitStyle,
      goal,
      level,
      durationMinutes,
      useGymProfile,
    });
    if (singlePlan[day]) {
      const updated = { ...plan, [day]: singlePlan[day] };
      setPlan(updated);
      saveWeeklyPlan(updated);
    }
  };

  const handleMoveOrSwapDay = (targetDay: WeekDayKey) => {
    if (!moveSourceDay || moveSourceDay === targetDay) {
      setMoveSourceDay(null);
      return;
    }
    const updated = { ...plan };
    const sourceRoutine = updated[moveSourceDay];
    const targetRoutine = updated[targetDay];
    if (targetRoutine) {
      updated[moveSourceDay] = targetRoutine;
    } else {
      delete updated[moveSourceDay];
    }
    if (sourceRoutine) {
      updated[targetDay] = sourceRoutine;
    }
    setPlan(updated);
    saveWeeklyPlan(updated);
    setMoveSourceDay(null);
  };

  const assignCurrentToDay = (day: WeekDayKey) => {
    if (currentRoutine.blocks.length === 0) return;
    const updated: WeeklyPlanMap = { ...plan, [day]: currentRoutine };
    setPlan(updated);
    saveWeeklyPlan(updated);
  };

  const clearDay = (day: WeekDayKey) => {
    const updated = { ...plan };
    delete updated[day];
    setPlan(updated);
    saveWeeklyPlan(updated);
  };

  const clearAll = () => {
    setPlan({});
    saveWeeklyPlan({});
    setMoveSourceDay(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card rounded-2xl border border-border/60 w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border/60 flex items-start justify-between gap-4 bg-muted/20">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-[11px] font-bold">
              <Calendar className="w-3 h-3" />
              <span>Planificador Semanal Personalizado</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Configura tu Semana de Gimnasio
            </h2>
            <p className="text-xs text-muted-foreground">
              Elige exactamente qué días vas al gimnasio, tu división, duración y objetivo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar planificador semanal"
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Configurador flexible */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                <span>1. Elige tus días de entrenamiento ({selectedDays.length} días)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyQuickDays(['mon', 'wed', 'fri'], 'ppl')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-card border border-border/60 hover:border-blue-400 text-foreground"
                >
                  3 días (L-X-V)
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDays(['mon', 'tue', 'thu', 'fri'], 'upper_lower')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-card border border-border/60 hover:border-blue-400 text-foreground"
                >
                  4 días (L-M-J-V)
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDays(['mon', 'tue', 'wed', 'fri', 'sat'], 'ppl_upper')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-card border border-border/60 hover:border-blue-400 text-foreground"
                >
                  5 días
                </button>
              </div>
            </div>

            {/* Pastillas L-D */}
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_DAYS.map((d) => {
                const active = selectedDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`min-h-[42px] rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-card text-muted-foreground border-border/60 hover:border-blue-300 hover:text-foreground'
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>

            {/* Parámetros de División, Objetivo, Duración, Nivel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>División</span>
                </label>
                <select
                  value={splitStyle}
                  onChange={(e) => setSplitStyle(e.target.value as WeeklySplitStyle)}
                  className="w-full min-h-[42px] rounded-lg border border-border/60 bg-card px-2.5 text-base sm:text-xs font-semibold text-foreground"
                >
                  <option value="auto">Automática</option>
                  <option value="upper_lower">Torso / Pierna</option>
                  <option value="ppl">Push / Pull / Legs</option>
                  <option value="ppl_upper">PPL + Torso/Pierna</option>
                  <option value="full_body">Full Body</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Dumbbell className="w-3 h-3" />
                  <span>Objetivo</span>
                </label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as TrainingGoal)}
                  className="w-full min-h-[42px] rounded-lg border border-border/60 bg-card px-2.5 text-base sm:text-xs font-semibold text-foreground"
                >
                  <option value="hypertrophy">Hipertrofia</option>
                  <option value="strength">Fuerza</option>
                  <option value="powerbuilding">Powerbuilding</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Duración</span>
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) as 45 | 60 | 75 | 90)}
                  className="w-full min-h-[42px] rounded-lg border border-border/60 bg-card px-2.5 text-base sm:text-xs font-semibold text-foreground"
                >
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={75}>75 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Nivel</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as ExperienceLevel)}
                  className="w-full min-h-[42px] rounded-lg border border-border/60 bg-card px-2.5 text-base sm:text-xs font-semibold text-foreground"
                >
                  <option value="beginner">Principiante</option>
                  <option value="intermediate">Intermedio</option>
                  <option value="advanced">Avanzado</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useGymProfile}
                  onChange={(e) => setUseGymProfile(e.target.checked)}
                  className="rounded border-border text-blue-600"
                />
                <span>
                  Adaptar al equipamiento de <strong>{gymName}</strong>
                </span>
              </label>

              <button
                type="button"
                disabled={selectedDays.length === 0}
                onClick={handleGenerateCustomWeek}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generar Semana ({selectedDays.length} días)</span>
              </button>
            </div>
          </div>

          {/* Resumen de la semana + aviso de mover */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="text-xs text-muted-foreground tabular-nums">
              Plan actual: <strong className="text-foreground">{weeklyStats.totalSessions} sesiones</strong>{' '}
              &bull; <strong className="text-foreground">{weeklyStats.totalSets} series</strong>{' '}
              &bull; {weeklyStats.totalExercises} ejercicios
            </div>
            {weeklyStats.totalSessions > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Vaciar semana
              </button>
            )}
          </div>

          {moveSourceDay && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
              <span>
                Selecciona el día destino para mover/intercambiar la sesión del{' '}
                <strong>{WEEK_DAYS.find((x) => x.key === moveSourceDay)?.label}</strong>.
              </span>
              <button
                type="button"
                onClick={() => setMoveSourceDay(null)}
                className="font-bold underline"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Lista de los 7 días */}
          <div className="space-y-2">
            {WEEK_DAYS.map((d) => {
              const dayRoutine = plan[d.key];
              const isToday = d.key === todayKey;
              const isMoveOrigin = moveSourceDay === d.key;

              return (
                <div
                  key={d.key}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isMoveOrigin
                      ? 'bg-amber-50/70 border-amber-400'
                      : isToday
                      ? 'bg-blue-50/60 border-blue-300'
                      : 'bg-card border-border/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{d.label}</span>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          Hoy
                        </span>
                      )}
                    </div>
                    {dayRoutine ? (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate tabular-nums">
                        <strong className="text-foreground">{dayRoutine.name}</strong> &bull;{' '}
                        {dayRoutine.blocks.length} ejercicios &bull;{' '}
                        {dayRoutine.blocks.reduce((a, b) => a + b.sets, 0)} series
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Día de descanso / recuperación
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {moveSourceDay && moveSourceDay !== d.key ? (
                      <button
                        type="button"
                        onClick={() => handleMoveOrSwapDay(d.key)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>{dayRoutine ? 'Intercambiar aquí' : 'Mover aquí'}</span>
                      </button>
                    ) : dayRoutine ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onLoadRoutine(dayRoutine);
                            onClose();
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Cargar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMoveSourceDay(d.key)}
                          title="Mover o intercambiar a otro día"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingleDay(d.key)}
                          title="Regenerar solo este día"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => clearDay(d.key)}
                          title="Quitar de este día"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={currentRoutine.blocks.length === 0}
                        onClick={() => assignCurrentToDay(d.key)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted disabled:opacity-40 text-foreground border border-border/60 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Asignar actual</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
