'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Play, Sparkles, Trash2, X } from 'lucide-react';
import { StrengthRoutine } from '@/lib/types';
import {
  buildPresetWeeklyPlan,
  getTodayWeekKey,
  loadWeeklyPlan,
  saveWeeklyPlan,
  WEEK_DAYS,
  WeekDayKey,
  WeeklyPlanMap
} from '@/lib/weekly-planner';

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
  const todayKey = getTodayWeekKey();

  useEffect(() => {
    if (isOpen) {
      setPlan(loadWeeklyPlan());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const applyPreset = (preset: 'ppl_3' | 'upper_lower_4' | 'full_body_3') => {
    const generated = buildPresetWeeklyPlan(preset);
    setPlan(generated);
    saveWeeklyPlan(generated);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card rounded-2xl border border-border/60 w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 sm:p-6 border-b border-border/60 flex items-start justify-between gap-4 bg-muted/20">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-[11px] font-bold">
              <Calendar className="w-3 h-3" />
              <span>Planificador Semanal (Mesociclo)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Organiza tu Semana de Entrenamiento
            </h2>
            <p className="text-xs text-muted-foreground">
              Genera una semana completa con 1 clic o asigna tu rutina actual a cualquier día.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar planificador semanal"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Presets 1-clic */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Generar Semana Completa Automática</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('ppl_3')}
                className="p-3 rounded-xl bg-muted/40 hover:bg-blue-50 border border-border/60 hover:border-blue-300 text-left transition-all"
              >
                <div className="text-xs font-bold text-foreground">Push / Pull / Legs</div>
                <div className="text-[11px] text-muted-foreground">Lun · Mié · Vie</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('upper_lower_4')}
                className="p-3 rounded-xl bg-muted/40 hover:bg-blue-50 border border-border/60 hover:border-blue-300 text-left transition-all"
              >
                <div className="text-xs font-bold text-foreground">Torso / Pierna</div>
                <div className="text-[11px] text-muted-foreground">Lun · Mar · Jue · Vie</div>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('full_body_3')}
                className="p-3 rounded-xl bg-muted/40 hover:bg-blue-50 border border-border/60 hover:border-blue-300 text-left transition-all"
              >
                <div className="text-xs font-bold text-foreground">Full Body</div>
                <div className="text-[11px] text-muted-foreground">Lun · Mié · Vie</div>
              </button>
            </div>
          </div>

          {/* Lista de los 7 días */}
          <div className="space-y-2">
            {WEEK_DAYS.map((d) => {
              const dayRoutine = plan[d.key];
              const isToday = d.key === todayKey;

              return (
                <div
                  key={d.key}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isToday
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
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        <strong className="text-foreground">{dayRoutine.name}</strong> &bull; {dayRoutine.blocks.length} ejercicios
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-0.5">Día de descanso / sin asignar</div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {dayRoutine ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onLoadRoutine(dayRoutine);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Cargar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => clearDay(d.key)}
                          title="Quitar de este día"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={currentRoutine.blocks.length === 0}
                        onClick={() => assignCurrentToDay(d.key)}
                        className="px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted disabled:opacity-40 text-foreground border border-border/60 text-xs font-semibold inline-flex items-center gap-1"
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
