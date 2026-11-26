'use client';

import React, { useMemo, useState } from 'react';
import { RefreshCw, Check, Zap, Filter, Dumbbell, Search, X } from 'lucide-react';
import { CatalogExercise, EquipmentType, EXERCISE_CATALOG } from '@/lib/exercise-catalog';
import { getSimilarExercises } from '@/lib/exercise-alternatives';

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
  onSelectAlternative,
}: ExerciseSwapModalProps) {
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | 'Todas'>('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  const alternatives = useMemo(
    () =>
      getSimilarExercises(
        currentExercise.id,
        currentWeightKg,
        equipmentFilter === 'Todas' ? undefined : equipmentFilter
      ),
    [currentExercise.id, currentWeightKg, equipmentFilter]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const displayedAlternatives = useMemo(() => {
    if (!normalizedQuery) return alternatives;

    const matchingSuggested = alternatives.filter(
      (alt) =>
        alt.exercise.name.toLowerCase().includes(normalizedQuery) ||
        alt.exercise.muscleGroup.toLowerCase().includes(normalizedQuery) ||
        alt.exercise.pattern.toLowerCase().includes(normalizedQuery)
    );

    const suggestedIds = new Set(matchingSuggested.map((a) => a.exercise.id));
    const catalogExtras = EXERCISE_CATALOG.filter((ex) => {
      if (ex.id === currentExercise.id || suggestedIds.has(ex.id)) return false;
      if (equipmentFilter !== 'Todas' && ex.equipment !== equipmentFilter) return false;
      return (
        ex.name.toLowerCase().includes(normalizedQuery) ||
        ex.muscleGroup.toLowerCase().includes(normalizedQuery) ||
        ex.pattern.toLowerCase().includes(normalizedQuery)
      );
    })
      .slice(0, 12)
      .map((ex) => ({
        exercise: ex,
        matchScore: ex.muscleGroup === currentExercise.muscleGroup ? 70 : 50,
        reason: `Búsqueda en catálogo · ${ex.muscleGroup} (${ex.pattern})`,
        recommendedWeightKg:
          ex.equipment === currentExercise.equipment ? currentWeightKg : undefined,
      }));

    return [...matchingSuggested, ...catalogExtras];
  }, [alternatives, normalizedQuery, currentExercise, equipmentFilter, currentWeightKg]);

  if (!isOpen) return null;

  const equipmentOptions: (EquipmentType | 'Todas')[] = [
    'Todas',
    'Barra',
    'Mancuernas',
    'Polea',
    'Máquina',
    'Peso Corporal',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card text-foreground rounded-2xl border border-border/80 shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/25 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Sustituir Ejercicio</h3>
              <p className="text-xs text-muted-foreground">
                ¿Máquina ocupada o no disponible en tu gimnasio?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ejercicio Actual */}
        <div className="bg-muted/35 p-4 border-b border-border/60 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ejercicio a Reemplazar
            </div>
            <div className="font-bold text-foreground text-sm mt-0.5">{currentExercise.name}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted text-foreground font-medium text-[11px] border border-border/60">
                {currentExercise.equipment}
              </span>
              <span>&bull;</span>
              <span>{currentExercise.pattern}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-muted-foreground">Carga Actual</div>
            <div className="text-base font-bold text-foreground font-mono tabular-nums">
              {currentWeightKg > 0 ? `${currentWeightKg} kg` : 'Sin peso'}
            </div>
          </div>
        </div>

        {/* Filtros de Equipamiento + Buscador rápido */}
        <div className="px-4 py-2.5 bg-card border-b border-border/60 space-y-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar sustituto o cualquier ejercicio del catálogo..."
              className="w-full min-h-[38px] pl-8 pr-8 py-1.5 text-base sm:text-xs bg-muted/40 focus:bg-background border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-blue-500/25"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0 mr-1" />
            {equipmentOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setEquipmentFilter(opt)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                  equipmentFilter === opt
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-muted hover:bg-accent text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Alternativas Biomecánicas */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {displayedAlternatives.length === 0 ? (
            <div className="text-center py-8">
              <Dumbbell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No hay alternativas con este filtro</p>
              <p className="text-xs text-muted-foreground mt-1">
                Prueba seleccionando &quot;Todas&quot; en el equipamiento o cambia el texto buscado.
              </p>
            </div>
          ) : (
            displayedAlternatives.map((alt) => (
              <div
                key={alt.exercise.id}
                className="p-3.5 rounded-xl border border-border/80 hover:border-blue-500/60 hover:bg-blue-500/5 bg-muted/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {alt.exercise.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                      {alt.matchScore}% afinidad
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded bg-muted text-foreground font-medium text-[11px] border border-border/60">
                      {alt.exercise.equipment}
                    </span>
                    <span>&bull;</span>
                    <span className="text-muted-foreground">{alt.reason}</span>
                  </div>

                  {alt.recommendedWeightKg !== undefined && alt.recommendedWeightKg > 0 && (
                    <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Carga sugerida adaptada:{' '}
                        <strong className="font-mono font-bold tabular-nums">
                          {alt.recommendedWeightKg} kg
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onSelectAlternative(alt.exercise, alt.recommendedWeightKg || currentWeightKg)
                  }
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
        <div className="p-3.5 bg-muted/35 border-t border-border/60 flex justify-between items-center text-xs text-muted-foreground">
          <span>{displayedAlternatives.length} alternativas encontradas</span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-card border border-border/80 hover:bg-accent font-semibold text-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
