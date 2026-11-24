'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Dumbbell,
  Filter,
  Layers,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Target,
  Timer,
  X
} from 'lucide-react';
import { EquipmentType, MuscleGroup } from '@/lib/exercise-catalog';
import {
  EnrichedExpertExercise,
  EXPERT_EQUIPMENT_FILTERS,
  EXPERT_MUSCLE_GROUPS,
  getExpertGymExercises
} from '@/lib/expert-gym-guide';
import { Exercise3DModal } from './Exercise3DModal';

interface GymExerciseGuideProps {
  onAddToRoutine: (item: EnrichedExpertExercise) => void;
  currentRoutineExerciseIds: string[];
}

export function GymExerciseGuide({
  onAddToRoutine,
  currentRoutineExerciseIds
}: GymExerciseGuideProps) {
  const allExercises = useMemo(() => getExpertGymExercises(), []);

  const [selectedMuscle, setSelectedMuscle] = useState<'Todos' | MuscleGroup>('Todos');
  const [selectedEquipment, setSelectedEquipment] = useState<'Todas' | EquipmentType>('Todas');
  const [selectedTier, setSelectedTier] = useState<'Todos' | 'S' | 'A'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTips, setExpandedTips] = useState<Record<string, boolean>>({});
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [active3DItem, setActive3DItem] = useState<EnrichedExpertExercise | null>(null);

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allExercises.filter((item) => {
      const matchesMuscle =
        selectedMuscle === 'Todos' || item.catalogExercise.muscleGroup === selectedMuscle;
      const matchesEquipment =
        selectedEquipment === 'Todas' || item.catalogExercise.equipment === selectedEquipment;
      const matchesTier = selectedTier === 'Todos' || item.tier === selectedTier;
      const matchesSearch =
        !q ||
        item.catalogExercise.name.toLowerCase().includes(q) ||
        item.machineLabel.toLowerCase().includes(q) ||
        item.primaryFocus.toLowerCase().includes(q) ||
        item.biomechanicalReason.toLowerCase().includes(q);

      return matchesMuscle && matchesEquipment && matchesTier && matchesSearch;
    });
  }, [allExercises, selectedMuscle, selectedEquipment, selectedTier, searchQuery]);

  const toggleTips = (id: string) => {
    setExpandedTips((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAdd = (item: EnrichedExpertExercise) => {
    onAddToRoutine(item);
    setJustAddedId(item.exerciseId);
    setTimeout(() => {
      setJustAddedId((curr) => (curr === item.exerciseId ? null : curr));
    }, 1800);
  };

  const resetFilters = () => {
    setSelectedMuscle('Todos');
    setSelectedEquipment('Todas');
    setSelectedTier('Todos');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedMuscle !== 'Todos' ||
    selectedEquipment !== 'Todas' ||
    selectedTier !== 'Todos' ||
    searchQuery.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Banner Introductorio del Experto */}
      <section className="bg-card border border-border/60 rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-xs font-semibold">
              <Award className="w-3.5 h-3.5" />
              <span>Selección Científica &amp; Biomecánica de Gimnasio</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Los Mejores Ejercicios por Grupo Muscular y Máquina
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Curaduría experta clasificada por estabilidad, perfil de resistencia y potencial hipertrófico.
              Filtra según las máquinas disponibles en tu gimnasio y añádelos a tu rutina con series, repeticiones y descansos óptimos listos para Garmin Fénix 8.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {allExercises.filter((e) => e.tier === 'S').length}
              </div>
              <div className="text-xs font-medium text-muted-foreground mt-0.5">
                Ejercicios S-Tier
              </div>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 tabular-nums">
                {allExercises.length}
              </div>
              <div className="text-xs font-medium text-muted-foreground mt-0.5">
                Compatibles Garmin
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Panel de Búsqueda y Filtros */}
      <section className="bg-card border border-border/60 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
        {/* Buscador y Tier */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ejercicio, máquina (ej. Hack Squat, Polea, Peck Deck) o músculo..."
              className="w-full min-h-[44px] pl-10 pr-10 py-2.5 text-base sm:text-sm bg-background border border-border/80 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all duration-150"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/60 shrink-0">
            {(['Todos', 'S', 'A'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setSelectedTier(tier)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                  selectedTier === tier
                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tier === 'Todos' ? 'Todos los Tiers' : `Tier ${tier}`}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por Grupo Muscular */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="w-3.5 h-3.5 text-blue-600" />
            <span>Grupo Muscular</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {EXPERT_MUSCLE_GROUPS.map((muscle) => {
              const isActive = selectedMuscle === muscle;
              return (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => setSelectedMuscle(muscle)}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-muted/40 text-muted-foreground border border-border/60 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {muscle}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtro por Máquina / Equipamiento */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              <span>Máquina o Equipamiento</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <Filter className="w-3 h-3" />
                <span>Restablecer filtros</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {EXPERT_EQUIPMENT_FILTERS.map((equip) => {
              const isActive = selectedEquipment === equip;
              return (
                <button
                  key={equip}
                  type="button"
                  onClick={() => setSelectedEquipment(equip)}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-muted/40 text-muted-foreground border border-border/60 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {equip}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contador de Resultados */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          Mostrando{' '}
          <span className="font-semibold text-foreground tabular-nums">
            {filteredExercises.length}
          </span>{' '}
          {filteredExercises.length === 1 ? 'ejercicio recomendado' : 'ejercicios recomendados'}
        </p>
      </div>

      {/* Listado / Grid de Tarjetas Expertas */}
      {filteredExercises.length === 0 ? (
        <div className="bg-card border border-border/60 rounded-xl p-10 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center mx-auto text-muted-foreground">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-foreground">
              No hay ejercicios con esa combinación de filtros
            </h3>
            <p className="text-sm text-muted-foreground">
              Prueba cambiando el tipo de máquina o limpiando la búsqueda para explorar todas las recomendaciones.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-[42px] px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all duration-200 active:scale-[0.98]"
          >
            Ver todos los ejercicios Top
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredExercises.map((item) => {
            const isExpanded = !!expandedTips[item.exerciseId];
            const isInRoutine = currentRoutineExerciseIds.includes(item.exerciseId);
            const wasJustAdded = justAddedId === item.exerciseId;

            return (
              <article
                key={item.exerciseId}
                className="bg-card border border-border/60 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  {/* Cabecera Badges: Tier + Grupo Muscular + Equipamiento */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${
                          item.tier === 'S'
                            ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                            : 'bg-blue-50 text-blue-800 border-blue-200/80'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{item.tier === 'S' ? 'S-TIER · TOP' : 'A-TIER'}</span>
                      </span>

                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-muted/60 text-foreground border border-border/60">
                        {item.catalogExercise.muscleGroup}
                      </span>

                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted/30 text-muted-foreground border border-border/60">
                        {item.catalogExercise.equipment}
                      </span>
                    </div>

                    {isInRoutine && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>En rutina</span>
                      </span>
                    )}
                  </div>

                  {/* Título y Estación / Máquina */}
                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                      {item.catalogExercise.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
                        <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{item.machineLabel}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{item.primaryFocus}</span>
                      </span>
                    </div>
                  </div>

                  {/* Clave Biomecánica */}
                  <div className="bg-muted/30 border border-border/60 rounded-lg p-3.5 space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Por qué es de los mejores
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                      {item.biomechanicalReason}
                    </p>
                  </div>

                  {/* Claves de Ejecución (Desplegable) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleTips(item.exerciseId)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                    >
                      <span>Claves de técnica y ejecución ({item.executionCues.length})</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <ul className="mt-2 space-y-2 border-t border-border/60 pt-3">
                        {item.executionCues.map((cue, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{cue}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Pie: Prescripción Óptima + Botón Añadir */}
                <div className="pt-4 border-t border-border/60 flex flex-col gap-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground whitespace-nowrap">
                      <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{item.recommendedSets} series</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground whitespace-nowrap">
                      <Repeat className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{item.recommendedReps} reps</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Timer className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{item.recommendedRestSeconds}s descanso</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActive3DItem(item)}
                      className="min-h-[42px] px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] shrink-0"
                    >
                      <Box className="w-4 h-4 text-blue-400" />
                      <span>Ver 3D</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAdd(item)}
                      className={`flex-1 min-h-[42px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] ${
                        wasJustAdded
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                      }`}
                    >
                      {wasJustAdded ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Añadido a Rutina</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Añadir a mi Rutina</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Visor 3D Biomecánico Interactivo */}
      <Exercise3DModal
        exercise={active3DItem?.catalogExercise || null}
        cues={active3DItem?.executionCues}
        machineLabel={active3DItem?.machineLabel}
        onClose={() => setActive3DItem(null)}
      />
    </div>
  );
}
