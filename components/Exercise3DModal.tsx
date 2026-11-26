'use client';

import React, { useState } from 'react';
import {
  Box,
  CheckCircle2,
  Eye,
  EyeOff,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  X
} from 'lucide-react';
import { CatalogExercise } from '@/lib/exercise-catalog';
import { Exercise3DViewer } from './Exercise3DViewer';

interface Exercise3DModalProps {
  exercise: CatalogExercise | null;
  cues?: string[];
  machineLabel?: string;
  onClose: () => void;
}

export function Exercise3DModal({
  exercise,
  cues,
  machineLabel,
  onClose,
}: Exercise3DModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<0.5 | 1>(1);
  const [highlightMuscles, setHighlightMuscles] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);

  if (!exercise) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border/60 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border/60 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-semibold">
              <Box className="w-3 h-3" />
              <span>Demostración Biomecánica 3D &bull; Arrastra para rotar 360°</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-foreground leading-snug">
              {exercise.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {exercise.muscleGroup} &bull; {machineLabel || exercise.equipment} &bull; Patrón: {exercise.pattern}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor 3D"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lienzo 3D */}
        <div className="p-5 sm:p-6 space-y-4">
          <Exercise3DViewer
            exercise={exercise}
            isPlaying={isPlaying}
            speed={speed}
            highlightMuscles={highlightMuscles}
            resetSignal={resetSignal}
          />

          {/* Barra de Controles Interactivos */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSpeed((s) => (s === 1 ? 0.5 : 1))}
                className="min-h-[40px] px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted border border-border/60 text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <Gauge className="w-3.5 h-3.5 text-blue-600" />
                <span>Velocidad: {speed}x</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHighlightMuscles((h) => !h)}
                className={`min-h-[40px] px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98] ${
                  highlightMuscles
                    ? 'bg-rose-500/15 border-rose-500/35 text-rose-700 dark:text-rose-300'
                    : 'bg-muted/50 border-border/60 text-muted-foreground'
                }`}
              >
                {highlightMuscles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>Mapa Muscular</span>
              </button>

              <button
                type="button"
                onClick={() => setResetSignal((n) => n + 1)}
                title="Restablecer cámara 3D"
                className="min-h-[40px] px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted border border-border/60 text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cámara</span>
              </button>
            </div>
          </div>

          {/* Claves Técnicas si están disponibles */}
          {cues && cues.length > 0 && (
            <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Puntos Clave de Ejecución
              </div>
              <ul className="space-y-1.5">
                {cues.map((cue, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-foreground/90 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
