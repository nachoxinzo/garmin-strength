'use client';

import React, { useState } from 'react';
import { RefreshCw, Check, ArrowRight, Zap, Filter, Dumbbell } from 'lucide-react';
import { CatalogExercise, EquipmentType } from '@/lib/exercise-catalog';
import { getSimilarExercises, ExerciseAlternative } from '@/lib/exercise-alternatives';

interface ExerciseSwapModalProps {
  currentExercise: CatalogExercise;
  currentWeightKg: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectAlternative: (alternativeExercise: CatalogExercise, newWeightKg: number) => void;
}

export default function ExerciseSwapModal({
  currentExercise,
  currentWeightKg,
  isOpen,
  onClose,
  onSelectAlternative
}: ExerciseSwapModalProps) {
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | 'Todas'>('Todas');

  if (!isOpen) return null;

  const alternatives = getSimilarExercises(
    currentExercise.id,
    currentWeightKg,
    equipmentFilter === 'Todas' ? undefined : equipmentFilter
  );

  const equipmentOptions: (EquipmentType | 'Todas')[] = [
    'Todas',
    'Barra',
    'Mancuernas',
    'Polea',
    'Máquina',
    'Peso Corporal'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Sustituir Ejercicio</h3>
              <p className="text-xs text-slate-500">¿Máquina ocupada o no disponible en tu gimnasio?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg text-sm"
          >
            ✕
          </button>
        </div>

        {/* Ejercicio Actual */}
        <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Ejercicio a Reemplazar
            </div>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{currentExercise.name}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-medium text-[11px]">
                {currentExercise.equipment}
              </span>
              <span>&bull;</span>
              <span>{currentExercise.pattern}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-slate-400">Carga Actual</div>
            <div className="text-base font-bold text-slate-900 font-mono">
              {currentWeightKg > 0 ? `${currentWeightKg} kg` : 'Sin peso'}
            </div>
          </div>
        </div>

        {/* Filtros de Equipamiento */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
          {equipmentOptions.map(opt => (
            <button
              key={opt}
              onClick={() => setEquipmentFilter(opt)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                equipmentFilter === opt
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* Lista de Alternativas Biomecánicas */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {alternatives.length === 0 ? (
            <div className="text-center py-8">
              <Dumbbell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No hay alternativas con este filtro</p>
              <p className="text-xs text-slate-400 mt-1">Prueba seleccionando &quot;Todas&quot; en el equipamiento.</p>
            </div>
          ) : (
            alternatives.map(alt => (
              <div
                key={alt.exercise.id}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                      {alt.exercise.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                      {alt.matchScore}% afinidad
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                      {alt.exercise.equipment}
                    </span>
                    <span>&bull;</span>
                    <span className="text-slate-600">{alt.reason}</span>
                  </div>

                  {alt.recommendedWeightKg !== undefined && alt.recommendedWeightKg > 0 && (
                    <div className="mt-2 text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Carga sugerida adaptada: <strong className="font-mono font-bold">{alt.recommendedWeightKg} kg</strong></span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onSelectAlternative(alt.exercise, alt.recommendedWeightKg || currentWeightKg)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98] min-h-[38px] shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Elegir este</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Pie */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span>{alternatives.length} alternativas biomecánicas encontradas</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
