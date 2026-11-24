'use client';

import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Dumbbell,
  Clock,
  Target,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Wand2,
  Settings2,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import {
  generateScientificRoutine,
  TrainingSplit,
  TrainingGoal,
  ExperienceLevel
} from '@/lib/scientific-workout-generator';
import { EquipmentType } from '@/lib/exercise-catalog';
import {
  DEFAULT_GYM_PROFILE,
  getKnownExerciseWeights,
  loadMyGymProfile,
  MyGymProfile,
  saveMyGymProfile,
  SmartGenerateResult
} from '@/lib/smart-workout-engine';
import { StrengthRoutine } from '@/lib/types';
import { loadGarminWellnessSnapshot } from '@/lib/garmin-wellness-client';

interface WorkoutGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoutineGenerated: (routine: StrengthRoutine) => void;
}

const QUICK_PROMPTS = [
  'Tengo 45 min, quiero enfocar pecho superior y hombro lateral en máquinas/poleas',
  'Sesión de piernas sin fatigar zona lumbar (Hack Squat, Prensa y Curl Sentado)',
  'Espalda en amplitud y bíceps con poleas y mancuernas en 60 min',
  'Full Body rápido de 45 min con los mejores ejercicios S-Tier'
];

export default function WorkoutGeneratorModal({
  isOpen,
  onClose,
  onRoutineGenerated
}: WorkoutGeneratorModalProps) {
  const [mode, setMode] = useState<'smart' | 'scientific'>('smart');

  // Estado compartido de Perfil "Mi Gimnasio"
  const [gymProfile, setGymProfile] = useState<MyGymProfile>(DEFAULT_GYM_PROFILE);
  const [showGymConfig, setShowGymConfig] = useState(false);

  // Estado Asistente Inteligente
  const [smartPrompt, setSmartPrompt] = useState('');
  const [isGeneratingSmart, setIsGeneratingSmart] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartPreview, setSmartPreview] = useState<SmartGenerateResult | null>(null);

  // Estado Científico Clásico
  const [split, setSplit] = useState<TrainingSplit>('ppl');
  const [sessionDay, setSessionDay] = useState<any>('push');
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [level, setLevel] = useState<ExperienceLevel>('intermediate');
  const [duration, setDuration] = useState<45 | 60 | 75 | 90>(60);

  useEffect(() => {
    if (isOpen) {
      setGymProfile(loadMyGymProfile());
      setSmartError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleEquipment = (eq: EquipmentType) => {
    setGymProfile(prev => {
      const exists = prev.availableEquipment.includes(eq);
      const nextEq = exists
        ? prev.availableEquipment.filter(e => e !== eq)
        : [...prev.availableEquipment, eq];
      const updated = {
        ...prev,
        availableEquipment: nextEq.length > 0 ? nextEq : [eq]
      };
      saveMyGymProfile(updated);
      return updated;
    });
  };

  const toggleLowerBack = () => {
    setGymProfile(prev => {
      const updated = { ...prev, avoidLowerBackFatigue: !prev.avoidLowerBackFatigue };
      saveMyGymProfile(updated);
      return updated;
    });
  };

  const handleGenerateSmart = async () => {
    if (!smartPrompt.trim()) {
      setSmartError('Describe qué músculos quieres entrenar, cuánto tiempo tienes o cómo te encuentras hoy.');
      return;
    }

    setIsGeneratingSmart(true);
    setSmartError(null);
    setSmartPreview(null);

    try {
      const knownWeights = getKnownExerciseWeights();
      const wellness = loadGarminWellnessSnapshot();
      const res = await fetch('/api/routines/smart-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: smartPrompt,
          gymProfile,
          durationMinutes: duration,
          goal,
          knownWeights,
          wellness
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error generando la rutina inteligente.');
      }

      setSmartPreview(data as SmartGenerateResult);
    } catch (err: any) {
      setSmartError(err.message || 'No se pudo generar la rutina inteligente.');
    } finally {
      setIsGeneratingSmart(false);
    }
  };

  const handleConfirmSmartRoutine = () => {
    if (!smartPreview) return;
    onRoutineGenerated(smartPreview.routine);
    onClose();
  };

  const handleGenerateScientific = () => {
    const routine = generateScientificRoutine({
      split,
      sessionDay,
      goal,
      level,
      durationMinutes: duration,
      preferredEquipment: gymProfile.availableEquipment
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card rounded-2xl border border-border/60 w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/60 bg-muted/20 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/70 rounded-full text-[11px] font-bold">
              <Sparkles className="w-3 h-3" />
              <span>Creador Inteligente &bull; Garmin Fénix 8</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Diseña tu Rutina Adaptativa
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar creador de rutinas"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Modo + Botón Mi Gimnasio */}
        <div className="px-6 pt-4 pb-3 border-b border-border/60 flex flex-wrap items-center justify-between gap-3 bg-card">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => setMode('smart')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                mode === 'smart'
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Asistente IA</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('scientific')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                mode === 'scientific'
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Por Split Científico</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGymConfig(s => !s)}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
              showGymConfig
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-muted/30 border-border/60 text-foreground hover:bg-muted/60'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Mi Gimnasio ({gymProfile.availableEquipment.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Panel Desplegable: Perfil Mi Gimnasio */}
          {showGymConfig && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Equipamiento disponible en tu gimnasio
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Se guarda automáticamente. Nunca sugeriremos máquinas que desactives.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['Barra', 'Mancuernas', 'Polea', 'Máquina', 'Peso Corporal'] as EquipmentType[]).map(eq => {
                  const active = gymProfile.availableEquipment.includes(eq);
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => toggleEquipment(eq)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        active
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{eq}</span>
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2.5 pt-2 border-t border-border/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gymProfile.avoidLowerBackFatigue}
                  onChange={toggleLowerBack}
                  className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-foreground">
                  Proteger zona lumbar (evitar peso muerto pesado / sentadilla libre axial)
                </span>
              </label>
            </div>
          )}

          {mode === 'smart' ? (
            <div className="space-y-5">
              {/* Objetivo y Duración rápidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">
                    Objetivo Principal
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'hypertrophy', label: 'Hipertrofia' },
                        { id: 'strength', label: 'Fuerza' },
                        { id: 'powerbuilding', label: 'Mixto' }
                      ] as const
                    ).map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGoal(g.id)}
                        className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          goal === g.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">
                    Duración Deseada
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([45, 60, 75, 90] as const).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={`min-h-[38px] rounded-lg text-xs font-semibold border tabular-nums transition-all ${
                          duration === d
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prompt en Lenguaje Natural */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-foreground">
                  ¿Qué quieres entrenar hoy o cómo te sientes?
                </label>
                <textarea
                  rows={3}
                  value={smartPrompt}
                  onChange={e => setSmartPrompt(e.target.value)}
                  placeholder="Ej: Tengo 45 min, quiero priorizar pectoral superior y deltoides lateral sin cargar la espalda baja..."
                  className="w-full p-3.5 text-base sm:text-sm bg-background border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_PROMPTS.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSmartPrompt(qp)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors text-left"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>

              {smartError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{smartError}</span>
                </div>
              )}

              {/* Vista previa de la rutina generada */}
              {smartPreview && (
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-indigo-900">
                      Rutina Propuesta: {smartPreview.routine.name}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                      {smartPreview.source === 'gemini' ? 'Gemini AI' : 'Motor Adaptativo'}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-950/80 leading-relaxed">
                    {smartPreview.coachRationale}
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {smartPreview.routine.blocks.map((b, i) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between text-xs bg-white/90 px-3 py-2 rounded-lg border border-indigo-100 tabular-nums"
                      >
                        <span className="font-semibold text-foreground truncate pr-2">
                          {i + 1}. {b.exercise.name}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {b.sets}&times;{b.reps} &bull; {b.weightKg} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* MODO CIENTÍFICO CLÁSICO */
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  1. Estructura / Split Semanal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'ppl', name: 'Push / Pull / Legs', desc: 'Ideal 3 o 6 días/sem' },
                    { id: 'upper_lower', name: 'Torso / Pierna', desc: 'Ideal 4 días/sem' },
                    { id: 'full_body', name: 'Full Body', desc: 'Ideal 2 o 3 días/sem' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const newSplit = s.id as TrainingSplit;
                        setSplit(newSplit);
                        if (newSplit === 'ppl') setSessionDay('push');
                        else if (newSplit === 'upper_lower') setSessionDay('upper');
                        else setSessionDay('full_body_a');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        split === s.id
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-sm'
                          : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <div className="font-bold text-xs text-foreground">{s.name}</div>
                      <div className="text-[11px] opacity-75 mt-0.5">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  2. Día / Sesión a Generar
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {getDayOptions().map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setSessionDay(day.id)}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold text-left flex items-center justify-between transition-all ${
                        sessionDay === day.id
                          ? 'bg-blue-50 border-blue-400 text-blue-950'
                          : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <span>{day.label}</span>
                      {sessionDay === day.id && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Target className="w-3.5 h-3.5 text-rose-500" />
                    3. Objetivo Principal
                  </label>
                  <select
                    value={goal}
                    onChange={e => setGoal(e.target.value as TrainingGoal)}
                    className="w-full min-h-[42px] px-3 py-2 bg-background border border-border/80 rounded-xl text-sm font-medium text-foreground"
                  >
                    <option value="hypertrophy">Hipertrofia (8-12 reps)</option>
                    <option value="strength">Fuerza Máxima (5 reps)</option>
                    <option value="powerbuilding">Powerbuilding (Mixto)</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    4. Duración Estimada
                  </label>
                  <select
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value) as any)}
                    className="w-full min-h-[42px] px-3 py-2 bg-background border border-border/80 rounded-xl text-sm font-medium text-foreground"
                  >
                    <option value={45}>45 minutos (4 ejercicios)</option>
                    <option value={60}>60 minutos (5 ejercicios)</option>
                    <option value={75}>75 minutos (6 ejercicios)</option>
                    <option value={90}>90 minutos (7 ejercicios)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                  5. Nivel de Experiencia
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'beginner', label: 'Principiante' },
                    { id: 'intermediate', label: 'Intermedio' },
                    { id: 'advanced', label: 'Avanzado' }
                  ].map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setLevel(lvl.id as ExperienceLevel)}
                      className={`min-h-[40px] py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        level === lvl.id
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                          : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border/60 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Todos los ejercicios generados pertenecen al catálogo validado de Garmin Fénix 8 y respetan tu perfil de Mi Gimnasio.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>

          {mode === 'smart' ? (
            <>
              <button
                type="button"
                onClick={handleGenerateSmart}
                disabled={isGeneratingSmart}
                className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                {isGeneratingSmart ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Diseñando...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>{smartPreview ? 'Regenerar Propuesta' : 'Generar Rutina IA'}</span>
                  </>
                )}
              </button>

              {smartPreview && (
                <button
                  type="button"
                  onClick={handleConfirmSmartRoutine}
                  className="min-h-[42px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                >
                  <Dumbbell className="w-4 h-4" />
                  <span>Cargar en Editor</span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleGenerateScientific}
              className="min-h-[42px] px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
            >
              <Dumbbell className="w-4 h-4" />
              <span>Generar Rutina Científica</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
