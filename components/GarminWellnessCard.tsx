'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  BatteryCharging,
  CheckCircle2,
  Download,
  HeartPulse,
  Moon,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Watch,
} from 'lucide-react';
import { GarminWellnessSnapshot, SportCategory } from '@/lib/types';
import {
  loadGarminWellnessSnapshot,
  saveGarminWellnessSnapshot,
} from '@/lib/garmin-wellness-client';
import { DbWorkoutLog } from '@/lib/supabase';
import { mergeGarminStrengthLogsWithPriority } from '@/lib/strength-sync-merger';

interface GarminWellnessCardProps {
  onSynced?: (snapshot: GarminWellnessSnapshot) => void;
  onImportStrengthLogs?: (logs: DbWorkoutLog[]) => Promise<{ added: number; total: number } | void>;
  hideWeeklySportStrip?: boolean;
  forceEmpty?: boolean;
  fallbackSnapshot?: GarminWellnessSnapshot | null;
}

export function GarminWellnessCard({
  onSynced,
  onImportStrengthLogs,
  hideWeeklySportStrip = false,
  forceEmpty = false,
  fallbackSnapshot = null,
}: GarminWellnessCardProps = {}) {
  const [snapshot, setSnapshot] = useState<GarminWellnessSnapshot | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportingStrength, setIsImportingStrength] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(loadGarminWellnessSnapshot());
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setImportNotice(null);
    try {
      const res = await fetch('/api/garmin/wellness-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo sincronizar con Garmin Connect.');
      }

      saveGarminWellnessSnapshot(data.snapshot);
      setSnapshot(data.snapshot);

      // Auto-importar series de fuerza de Garmin respetando los días ya registrados en la App
      try {
        const strengthRes = await fetch('/api/garmin/strength-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const strengthData = await strengthRes.json();
        if (strengthRes.ok && strengthData.success) {
          const logs = Array.isArray(strengthData.logs)
            ? (strengthData.logs as DbWorkoutLog[])
            : [];
          if (logs.length > 0) {
            const mergeRes = await mergeGarminStrengthLogsWithPriority(logs);
            if (mergeRes.added > 0 && mergeRes.skippedAppDates.length > 0) {
              setImportNotice(
                `Importadas ${mergeRes.added} series de fuerza desde Garmin (${mergeRes.skippedAppDates.length} día(s) registrados en la App respetados sin duplicar).`
              );
            } else if (mergeRes.added > 0) {
              setImportNotice(
                `Importadas ${mergeRes.added} series de fuerza de Garmin (${strengthData.activitiesCount || 0} sesiones).`
              );
            } else if (mergeRes.skippedAppDates.length > 0) {
              setImportNotice(
                `Pesos de la App respetados en ${mergeRes.skippedAppDates.length} día(s) coincidentes sin duplicar datos.`
              );
            }
          }
        }
      } catch {
        // La importación automática de fuerza es no bloqueante si falla o alcanza límite
      }

      onSynced?.(data.snapshot);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Conecta primero tu cuenta de Garmin en la barra superior.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportStrength = async () => {
    setIsImportingStrength(true);
    setErrorMsg(null);
    setImportNotice(null);
    try {
      const res = await fetch('/api/garmin/strength-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudieron importar las sesiones de fuerza de Garmin.');
      }

      const logs = Array.isArray(data.logs) ? (data.logs as DbWorkoutLog[]) : [];
      if (logs.length === 0) {
        setImportNotice(
          `Revisadas ${data.activitiesCount || 0} sesiones de fuerza en Garmin (sin series nuevas con repeticiones registradas).`
        );
        return;
      }

      const result = await onImportStrengthLogs?.(logs);
      if (result && typeof result.added === 'number') {
        setImportNotice(
          result.added > 0
            ? `Importadas ${result.added} series nuevas de ${data.activitiesCount} sesiones de fuerza de Garmin (sin duplicados).`
            : `Todas las ${logs.length} series de tus ${data.activitiesCount} sesiones ya estaban guardadas (0 duplicados).`
        );
      } else {
        setImportNotice(
          `Procesadas ${logs.length} series de ${data.activitiesCount} sesiones de fuerza de Garmin.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Conecta primero tu cuenta de Garmin para importar sesiones.');
    } finally {
      setIsImportingStrength(false);
    }
  };

  const displaySnapshot = forceEmpty ? null : snapshot || fallbackSnapshot;
  const isLiveSnapshot = Boolean(!forceEmpty && snapshot);

  const readinessColor = !displaySnapshot
    ? 'text-muted-foreground bg-muted/40 border-border/60'
    : displaySnapshot.readinessIndex >= 75
    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
    : displaySnapshot.readinessIndex >= 45
    ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
    : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60';

  const sportEntries =
    !hideWeeklySportStrip && displaySnapshot
      ? (Object.entries(displaySnapshot.weeklySportMinutes) as [SportCategory, number][]).filter(
          ([, mins]) => mins > 0
        )
      : [];

  return (
    <div className="bg-card rounded-2xl border border-border/80 p-4 sm:p-5 saas-card space-y-4 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Watch className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Recuperación y Estado de Hoy (Garmin)
              </h3>
              {displaySnapshot && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isLiveSnapshot
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                      : 'bg-muted text-muted-foreground border-border/70'
                  }`}
                >
                  {isLiveSnapshot ? 'Garmin en vivo' : 'Demo · Sin sincronizar'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {displaySnapshot
                ? `Actualizado: ${new Date(displaySnapshot.syncedAt).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}${
                    displaySnapshot.recentActivities.length > 0
                      ? ` · ${displaySnapshot.recentActivities.length} actividades (84d)`
                      : ''
                  }`
                : 'Sincroniza sueño, HRV, Body Battery y tu disponibilidad diaria de Garmin.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Garmin'}</span>
          </button>

          {onImportStrengthLogs && (
            <button
              type="button"
              onClick={handleImportStrength}
              disabled={isImportingStrength}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <Download className={`w-3.5 h-3.5 ${isImportingStrength ? 'animate-pulse' : ''}`} />
              <span>{isImportingStrength ? 'Importando...' : 'Importar Fuerza a BD'}</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {importNotice && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{importNotice}</span>
        </div>
      )}

      {displaySnapshot && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`rounded-xl border p-3 ${readinessColor}`}>
              <div className="text-[11px] font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Readiness Hoy</span>
              </div>
              <div className="text-xl font-bold tabular-nums mt-1">
                {displaySnapshot.readinessIndex}/100
              </div>
              <div className="text-[11px] opacity-85">
                {displaySnapshot.readinessIndex >= 75
                  ? 'Listo para progresar'
                  : displaySnapshot.readinessIndex >= 45
                  ? 'Carga moderada'
                  : 'Prioriza recuperación'}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Sueño Anoche</span>
              </div>
              <div className="text-xl font-bold text-foreground tabular-nums mt-1">
                {displaySnapshot.sleep ? `${displaySnapshot.sleep.durationHours}h` : 'N/D'}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {displaySnapshot.sleep?.sleepScore
                  ? `Score ${displaySnapshot.sleep.sleepScore} · Prof. ${displaySnapshot.sleep.deepHours}h`
                  : 'Sin detalle de fases'}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                <span>HRV / FC Reposo</span>
              </div>
              <div className="text-xl font-bold text-foreground tabular-nums mt-1">
                {displaySnapshot.recovery.hrvLastNight
                  ? `${displaySnapshot.recovery.hrvLastNight} ms`
                  : 'N/D'}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {displaySnapshot.recovery.restingHr
                  ? `FCR ${displaySnapshot.recovery.restingHr} bpm`
                  : 'Sin FCR'}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
                <span>Body Battery</span>
              </div>
              <div className="text-xl font-bold text-foreground tabular-nums mt-1">
                {displaySnapshot.recovery.bodyBatteryCurrent ?? 'N/D'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Fatiga piernas: {displaySnapshot.lowerBodyFatigue}
              </div>
            </div>
          </div>

          {sportEntries.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                <span>Carga Multideporte (Últimos 7 días)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sportEntries.map(([sport, mins]) => (
                  <span
                    key={sport}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-xs font-medium text-foreground tabular-nums"
                  >
                    <span>{sport}:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(mins)} min
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {displaySnapshot.coachInsights.length > 0 && (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 space-y-1">
              {displaySnapshot.coachInsights.map((tip, i) => (
                <p key={i} className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
                  &bull; {tip}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
