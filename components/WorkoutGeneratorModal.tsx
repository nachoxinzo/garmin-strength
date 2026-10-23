'use client';

import React, { useState } from 'react';
import { Sparkles, Dumbbell, Clock, Target, Layers, CheckCircle2, ShieldCheck } from 'lucide-react';
import {
  generateScientificRoutine,
  TrainingSplit,
  TrainingGoal,
  ExperienceLevel
} from '@/lib/scientific-workout-generator';
import { EquipmentType } from '@/lib/exercise-catalog';
import { StrengthRoutine } from '@/lib/types';

interface WorkoutGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutineGenerated: (routine: StrengthRoutine) => void;
}

export default function WorkoutGeneratorModal({
  isOpen,
  onClose,
  onRoutineGenerated
}: WorkoutGeneratorModalProps) {
  const [split, setSplit] = useState<TrainingSplit>('ppl');
  const [sessionDay, setSessionDay] = useState<any>('push');
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [level, setLevel] = useState<ExperienceLevel>('intermediate');
  const [duration, setDuration] = useState<45 | 60 | 75 | 90>(60);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType[]>([
    'Barra',
    'Mancuernas',
    'Polea',
    'Máquina'
  ]);

  if (!isOpen) return null;

  const toggleEquipment = (eq: EquipmentType) => {
    setSelectedEquipment(prev =>
      prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
    );
  };

  const handleGenerate = () => {
    const routine = generateScientificRoutine({
      split,
      sessionDay,
      goal,
      level,
      durationMinutes: duration,
      preferredEquipment: selectedEquipment
    });

    onRoutineGenerated(routine);
    onClose();
  };

  const getDayOptions = () => {
    if (split === 'ppl') {
      return [
        { id: 'push', label: 'Empuje (Pecho, Hombro, Tríceps)' },
        { id: 'pull', label: 'Tirón (Espalda, Deltoides Post, Bíceps)' },
        { id: 'legs', label: 'Pierna (Cuádriceps, Isquios, Gemelos)' }
      ];
    }
    if (split === 'upper_lower') {
      return [
        { id: 'upper', label: 'Torso (Pecho, Espalda, Hombros, Brazos)' },
        { id: 'lower', label: 'Pierna & Core' }
      ];
    }
    return [
      { id: 'full_body_a', label: 'Cuerpo Completo (Sesión A)' },
      { id: 'full_body_b', label: 'Cuerpo Completo (Sesión B)' }
    ];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Generador de Rutinas Basado en Evidencia</h3>
              <p className="text-xs text-slate-500">Programación óptima según estudios de hipertrofia y fuerza</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg text-sm"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          {/* Cita científica */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Criterios de Biomecánica Aplicados:</span> Prioridad a compuestos multiarticulares pesados al inicio con descansos completos (90 a 150 segundos), seguidos de trabajo accesorio y aislamiento en estiramiento (60 a 75 segundos).
            </div>
          </div>

          {/* 1. Tipo de División (Split) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              División de Entrenamiento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ppl', label: 'Push / Pull / Legs', sub: '3 a 6 días/sem' },
                { id: 'upper_lower', label: 'Torso / Pierna', sub: '4 días/sem' },
                { id: 'full_body', label: 'Full Body', sub: '2 a 3 días/sem' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSplit(opt.id as any);
                    setSessionDay(opt.id === 'ppl' ? 'push' : opt.id === 'upper_lower' ? 'upper' : 'full_body_a');
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    split === opt.id
                      ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-semibold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Día de la Sesión */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Día o Grupo Muscular de Hoy
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {getDayOptions().map(day => (
                <button
                  key={day.id}
                  onClick={() => setSessionDay(day.id)}
                  className={`px-3.5 py-2.5 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-all ${
                    sessionDay === day.id
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{day.label}</span>
                  {sessionDay === day.id && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Objetivo y Rango de Repeticiones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Objetivo de Carga
              </label>
              <select
                value={goal}
                onChange={e => setGoal(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="hypertrophy">Hipertrofia (8-12 reps)</option>
                <option value="strength">Fuerza Máxima (3-6 reps)</option>
                <option value="powerbuilding">Powerbuilding Híbrido</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Tiempo Disponible
              </label>
              <select
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value) as any)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value={45}>45 minutos (~4 ejercicios)</option>
                <option value={60}>60 minutos (~5 ejercicios)</option>
                <option value={75}>75 minutos (~6 ejercicios)</option>
                <option value={90}>90 minutos (~7 ejercicios)</option>
              </select>
            </div>
          </div>

          {/* 4. Equipamiento Disponible en tu Gimnasio */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Equipamiento Disponible
            </label>
            <div className="flex flex-wrap gap-2">
              {(['Barra', 'Mancuernas', 'Polea', 'Máquina', 'Peso Corporal'] as EquipmentType[]).map(eq => (
                <button
                  key={eq}
                  onClick={() => toggleEquipment(eq)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    selectedEquipment.includes(eq)
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
          >
            Cancelar
          </button>

          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generar y Cargar Rutina</span>
          </button>
        </div>
      </div>
    </div>
  );
}
