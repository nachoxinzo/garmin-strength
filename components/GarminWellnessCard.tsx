'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  BatteryCharging,
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

export function GarminWellnessCard() {
  const [snapshot, setSnapshot] = useState<GarminWellnessSnapshot | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(loadGarminWellnessSnapshot());
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const rawTokens = localStorage.getItem('garmin_oauth_tokens');
      const garminTokens = rawTokens ? JSON.parse(rawTokens) : null;

      const res = await fetch('/api/garmin/wellness-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garminTokens }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo sincronizar con Garmin Connect.');
      }

      if (data.tokens) {
        localStorage.setItem('garmin_oauth_tokens', JSON.stringify(data.tokens));
      }
      saveGarminWellnessSnapshot(data.snapshot);
      setSnapshot(data.snapshot);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Conecta primero tu cuenta de Garmin en la barra superior.');
    } finally {
      setIsSyncing(false);
    }
  };

  const readinessColor = !snapshot
    ? 'text-slate-600 bg-slate-100 border-slate-200'
    : snapshot.readinessIndex >= 75
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : snapshot.readinessIndex >= 45
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-rose-700 bg-rose-50 border-rose-200';

  const sportEntries = snapshot
    ? (Object.entries(snapshot.weeklySportMinutes) as [SportCategory, number][]).filter(
        ([, mins]) => mins > 0
      )
    : [];

  return (
    <div className="bg-card rounded-xl border border-border/60 p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Watch className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Estado del Atleta y Multideporte (Garmin)
            </h3>
            <p className="text-xs text-muted-foreground">
              {snapshot
                ? `Última sincronización: ${new Date(snapshot.syncedAt).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Sincroniza sueño, HRV, Body Battery y todo tu deporte para que el entrenador adapte tus cargas.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Garmin'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {snapshot && (
        <div className="space-y-4">
          {/* KPIs de Recuperación */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`rounded-xl border p-3 ${readinessColor}`}>
              <div className="text-[11px] font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Readiness Hoy</span>
              </div>
              <div className="text-xl font-bold tabular-nums mt-1">
                {snapshot.readinessIndex}/100
              </div>
              <div className="text-[11px] opacity-85">
                {snapshot.readinessIndex >= 75
                  ? 'Listo para progresar'
                  : snapshot.readinessIndex >= 45
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
                {snapshot.sleep ? `${snapshot.sleep.durationHours}h` : 'N/D'}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {snapshot.sleep?.sleepScore
                  ? `Score ${snapshot.sleep.sleepScore} · Prof. ${snapshot.sleep.deepHours}h`
                  : 'Sin detalle de fases'}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                <span>HRV / FC Reposo</span>
              </div>
              <div className="text-xl font-bold text-foreground tabular-nums mt-1">
                {snapshot.recovery.hrvLastNight ? `${snapshot.recovery.hrvLastNight} ms` : 'N/D'}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {snapshot.recovery.restingHr ? `FCR ${snapshot.recovery.restingHr} bpm` : 'Sin FCR'}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
                <span>Body Battery</span>
              </div>
              <div className="text-xl font-bold text-foreground tabular-nums mt-1">
                {snapshot.recovery.bodyBatteryCurrent ?? 'N/D'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Fatiga piernas: {snapshot.lowerBodyFatigue}
              </div>
            </div>
          </div>

          {/* Minutos Semanales Multideporte */}
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
                    <span className="font-bold text-blue-600">{Math.round(mins)} min</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones del Entrenador */}
          {snapshot.coachInsights.length > 0 && (
            <div className="rounded-lg bg-blue-50/70 border border-blue-200/80 p-3 space-y-1">
              {snapshot.coachInsights.map((tip, i) => (
                <p key={i} className="text-xs text-blue-900 leading-relaxed">
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
