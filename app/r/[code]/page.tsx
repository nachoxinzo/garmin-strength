'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Dumbbell,
  Layers,
  Play,
  Repeat,
  Save,
  Share2,
  Sparkles,
  User,
  Watch,
} from 'lucide-react';
import {
  applyWeightModeToRoutine,
  fetchSharedRoutineByCode,
  incrementSharedRoutineImport,
  SharedRoutineSnapshot,
  WeightAdaptMode,
} from '@/lib/routine-sharing-service';
import { saveLocalTemplate } from '@/lib/backup-utils';
import { encodeRoutineToShareUrl } from '@/lib/share-utils';
import { isSupabaseConfigured, saveRoutineToSupabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';

const WEIGHT_MODES: { id: WeightAdaptMode; label: string; desc: string }[] = [
  { id: 'keep', label: 'Pesos originales', desc: 'Tal cual los compartió tu amigo' },
  { id: 'zero', label: 'Sin pesos (0 kg)', desc: 'Ideal para poner tus cargas' },
  { id: 'scale85', label: 'Al 85%', desc: 'Ajuste conservador' },
  { id: 'scale75', label: 'Al 75%', desc: 'Carga moderada' },
];

export default function SharedRoutineCodePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const rawCode = String(params?.code || '').trim().toUpperCase();

  const [snapshot, setSnapshot] = useState<SharedRoutineSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [weightMode, setWeightMode] = useState<WeightAdaptMode>('keep');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setErrorText(null);
      const res = await fetchSharedRoutineByCode(rawCode);
      if (!active) return;
      if (res.snapshot) {
        setSnapshot(res.snapshot);
      } else {
        setErrorText(res.error || 'No se encontró la rutina compartida.');
      }
      setIsLoading(false);
    }
    if (rawCode) {
      load();
    } else {
      setErrorText('Código no válido.');
      setIsLoading(false);
    }
    return () => {
      active = false;
    };
  }, [rawCode]);

  const adaptedRoutine = useMemo(() => {
    if (!snapshot) return null;
    return applyWeightModeToRoutine(snapshot.routine, weightMode);
  }, [snapshot, weightMode]);

  const stats = useMemo(() => {
    if (!adaptedRoutine) return { exercises: 0, sets: 0, minutes: 0 };
    const sets = adaptedRoutine.blocks.reduce((a, b) => a + b.sets, 0);
    const secs =
      adaptedRoutine.warmupSeconds +
      adaptedRoutine.cooldownSeconds +
      adaptedRoutine.blocks.reduce((a, b) => a + b.sets * (45 + b.restSeconds), 0);
    return {
      exercises: adaptedRoutine.blocks.length,
      sets,
      minutes: Math.max(5, Math.round(secs / 60)),
    };
  }, [adaptedRoutine]);

  const handleImportAndNavigate = async (goLive: boolean) => {
    if (!adaptedRoutine || !snapshot) return;
    setIsSaving(true);
    try {
      saveLocalTemplate(adaptedRoutine);
      try {
        localStorage.setItem('garmin_strength_current_routine', JSON.stringify(adaptedRoutine));
      } catch {
        // ignore storage quota errors
      }
      if (isSupabaseConfigured()) {
        await saveRoutineToSupabase(adaptedRoutine);
      }
      await incrementSharedRoutineImport(snapshot.share_code);
      router.push(goLive ? '/?tab=live&imported=1' : '/?imported=1');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTryLiveDirect = () => {
    if (!adaptedRoutine) return;
    const encoded = encodeRoutineToShareUrl(adaptedRoutine);
    router.push(`/live?data=${encoded}`);
  };

  return (
    <div className="min-h-screen ambient-canvas text-foreground py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="saas-btn min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card hover:bg-accent border border-border/80 text-xs font-semibold text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a IronSync</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold">
              <Share2 className="w-3.5 h-3.5" />
              <span>{rawCode || '---'}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {isLoading ? (
          <div className="bg-card rounded-2xl border border-border/80 p-6 space-y-4">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ) : errorText || !adaptedRoutine || !snapshot ? (
          <div className="bg-card rounded-2xl border border-border/80 p-8 sm:p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Dumbbell className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">Rutina compartida no disponible</h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {errorText || 'No hemos encontrado ninguna rutina con este código o puede haber sido eliminada.'}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold min-h-[42px]"
            >
              Ir al Diseñador de Rutinas
            </Link>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border/80 p-5 sm:p-7 saas-card space-y-6">
            {/* Cabecera */}
            <div className="space-y-2 border-b border-border/60 pb-5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                <User className="w-3.5 h-3.5" />
                <span>Compartida por {snapshot.author_name}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {adaptedRoutine.name}
              </h1>
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="rounded-xl bg-muted/35 border border-border/60 p-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Ejercicios</span>
                    <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-lg font-bold text-foreground tabular-nums mt-0.5">
                    {stats.exercises}
                  </div>
                </div>
                <div className="rounded-xl bg-muted/35 border border-border/60 p-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Series</span>
                    <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-lg font-bold text-foreground tabular-nums mt-0.5">
                    {stats.sets}
                  </div>
                </div>
                <div className="rounded-xl bg-muted/35 border border-border/60 p-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Duración</span>
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-lg font-bold text-foreground tabular-nums mt-0.5">
                    ~{stats.minutes}m
                  </div>
                </div>
              </div>
            </div>

            {/* Adaptar Cargas antes de importar */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Adaptar cargas a tu nivel antes de guardar</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEIGHT_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setWeightMode(m.id)}
                    className={`min-h-[42px] p-2.5 rounded-xl border text-left transition-all ${
                      weightMode === m.id
                        ? 'bg-blue-500/15 border-blue-500/50 text-blue-800 dark:text-blue-200 shadow-2xs'
                        : 'bg-muted/30 border-border/70 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-xs font-bold">{m.label}</div>
                    <div className="text-[10px] opacity-80 leading-tight mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Vista previa de ejercicios */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Vista previa de la sesión
              </div>
              <div className="divide-y divide-border/60 border border-border/80 rounded-xl overflow-hidden bg-muted/20">
                {adaptedRoutine.blocks.map((b, idx) => (
                  <div
                    key={b.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {idx + 1}. {b.exercise.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {b.exercise.muscleGroup} &bull; {b.exercise.equipment} &bull; Descanso {b.restSeconds}s
                      </div>
                    </div>
                    <div className="font-mono font-bold text-foreground shrink-0 tabular-nums text-right">
                      {b.sets}&times;{b.reps}
                      <span className="text-blue-600 dark:text-blue-400 ml-1.5">
                        {b.weightKg > 0 ? `${b.weightKg} kg` : '0 kg'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botones de importación */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleImportAndNavigate(true)}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                <span>Guardar y Entrenar En Vivo</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleImportAndNavigate(false)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Guardar y Editar</span>
              </button>

              <button
                type="button"
                onClick={handleTryLiveDirect}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-card hover:bg-accent text-foreground border border-border/80 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Watch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Solo Probar</span>
              </button>
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Al guardarla, podrás editar ejercicios, usarla en Entreno en Vivo o enviarla a tu Garmin Fénix 8.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
