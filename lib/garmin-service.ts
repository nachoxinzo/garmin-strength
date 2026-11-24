import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  GarminClient,
  Garmin,
  FileTokenStore,
  workoutFromSpec
} from 'garminconnect-js';
import { EXERCISES } from 'garminconnect-js/exercises';
import {
  StrengthRoutine,
  GarminAccountStatus,
  GarminWellnessSnapshot,
  GarminActivitySummary,
  GarminSleepSummary,
  GarminRecoverySummary,
  SportCategory,
} from './types';
import { EXERCISE_CATALOG } from './exercise-catalog';

export interface GarminTokensPayload {
  oauth1: any;
  oauth2: any;
}

// Almacén en memoria global del proceso para persistir entre invocaciones calientes en Serverless
let globalMemoryTokens: GarminTokensPayload | null = null;
let pendingMfaState: any = null;

function getLocalTokensPath() {
  return path.join(process.cwd(), 'tokens');
}

function getTmpTokensPath() {
  return path.join(os.tmpdir(), 'garmin-strength-tokens');
}

function isValidTokensPayload(t: any): t is GarminTokensPayload {
  return Boolean(
    t &&
      t.oauth1 &&
      typeof t.oauth1.oauth_token === 'string' &&
      typeof t.oauth1.oauth_token_secret === 'string' &&
      t.oauth2 &&
      typeof t.oauth2.access_token === 'string' &&
      typeof t.oauth2.refresh_token === 'string'
  );
}

/**
 * TokenStore híbrido compatible con entorno local y Vercel Serverless:
 * 1. Usa tokens pasados desde el cliente (Supabase user_metadata / localStorage)
 * 2. Usa caché en memoria del contenedor Serverless
 * 3. Usa /tmp/garmin-strength-tokens (escribible en Vercel)
 * 4. Usa ./tokens (entorno local)
 */
class HybridGarminTokenStore {
  private clientTokens: GarminTokensPayload | null;

  constructor(clientTokens?: GarminTokensPayload | null) {
    this.clientTokens = isValidTokensPayload(clientTokens) ? clientTokens : null;
  }

  async load(): Promise<GarminTokensPayload | null> {
    if (isValidTokensPayload(this.clientTokens)) {
      return this.clientTokens;
    }

    // En producción (Serverless multi-usuario), exigir tokens explícitos por petición
    // para evitar contaminación cruzada entre usuarios en instancias calientes.
    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    if (isValidTokensPayload(globalMemoryTokens)) {
      return globalMemoryTokens;
    }

    // Intentar cargar desde ./tokens (Solo desarrollo local)
    try {
      const localStore = new FileTokenStore(getLocalTokensPath());
      const localTokens = await localStore.load();
      if (isValidTokensPayload(localTokens)) {
        globalMemoryTokens = localTokens;
        return localTokens;
      }
    } catch {
      // ignore
    }

    // Intentar cargar desde variables de entorno opcionales
    try {
      if (process.env.GARMIN_OAUTH1_JSON && process.env.GARMIN_OAUTH2_JSON) {
        const envTokens = {
          oauth1: JSON.parse(process.env.GARMIN_OAUTH1_JSON),
          oauth2: JSON.parse(process.env.GARMIN_OAUTH2_JSON)
        };
        if (isValidTokensPayload(envTokens)) {
          globalMemoryTokens = envTokens;
          return envTokens;
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  async save(tokens: GarminTokensPayload): Promise<void> {
    this.clientTokens = tokens;
    globalMemoryTokens = tokens;

    // Guardar en /tmp (siempre escribible en Vercel y local)
    try {
      const tmpStore = new FileTokenStore(getTmpTokensPath());
      await tmpStore.save(tokens as any);
    } catch {
      // ignore
    }

    // Guardar en ./tokens si el sistema de archivos lo permite (local)
    try {
      const localDir = getLocalTokensPath();
      if (fs.existsSync(localDir) || process.env.NODE_ENV !== 'production') {
        const localStore = new FileTokenStore(localDir);
        await localStore.save(tokens as any);
      }
    } catch {
      // En Vercel process.cwd() es de solo lectura; ignorar silenciosamente
    }
  }

  async clear(): Promise<void> {
    this.clientTokens = null;
    globalMemoryTokens = null;
    try {
      const tmpStore = new FileTokenStore(getTmpTokensPath());
      await tmpStore.clear();
    } catch {
      // ignore
    }
  }
}

export async function getGarminClient(clientTokens?: GarminTokensPayload | null): Promise<{
  garmin: Garmin;
  client: GarminClient;
} | null> {
  const tokenStore = new HybridGarminTokenStore(clientTokens);
  const client = new GarminClient({ tokenStore: tokenStore as any });
  const hasTokens = await client.loadTokens();
  if (!hasTokens) {
    return null;
  }
  return { garmin: new Garmin(client), client };
}

export async function loginToGarminAccount(email: string, password: string) {
  const tokenStore = new HybridGarminTokenStore();
  const client = new GarminClient({ tokenStore: tokenStore as any });
  const result: any = await client.login(email.trim(), password);

  if (result?.state === 'mfa' || result?.state === 'needs_mfa' || result?.mfaState) {
    pendingMfaState = result.mfaState || result;
    return {
      requiresMfa: true,
      mfaState: pendingMfaState
    };
  }

  const tokens = client.getTokens();
  if (tokens) {
    await tokenStore.save(tokens as any);
  }

  const garmin = new Garmin(client);
  let displayName = email.split('@')[0];
  let username = email;
  try {
    const profile = await garmin.getUserProfile();
    displayName = (profile.fullName as string) || (profile.displayName as string) || displayName;
    username = (profile.userName as string) || displayName;
  } catch {
    // ignore profile error if login succeeded
  }

  return {
    requiresMfa: false,
    authenticated: true,
    tokens,
    displayName,
    username
  };
}

export async function resumeGarminMfaLogin(code: string, mfaStateFromClient?: any) {
  const stateToUse = mfaStateFromClient || pendingMfaState;
  if (!stateToUse) {
    throw new Error('La sesión de verificación MFA ha expirado. Vuelve a introducir tu email y contraseña.');
  }

  const tokenStore = new HybridGarminTokenStore();
  const client = new GarminClient({ tokenStore: tokenStore as any });
  await client.resumeLogin(stateToUse, code.trim());
  pendingMfaState = null;

  const tokens = client.getTokens();
  if (tokens) {
    await tokenStore.save(tokens as any);
  }

  const garmin = new Garmin(client);
  let displayName = 'Garmin Connect';
  let username = 'Usuario Garmin';
  try {
    const profile = await garmin.getUserProfile();
    displayName = (profile.fullName as string) || (profile.displayName as string) || displayName;
    username = (profile.userName as string) || displayName;
  } catch {
    // ignore
  }

  return {
    authenticated: true,
    tokens,
    displayName,
    username
  };
}

export async function getGarminStatus(
  clientTokens?: GarminTokensPayload | null
): Promise<GarminAccountStatus & { tokens?: GarminTokensPayload | null }> {
  try {
    const session = await getGarminClient(clientTokens);
    if (!session) {
      return { authenticated: false };
    }
    const { garmin, client } = session;
    const profile = await garmin.getUserProfile();
    const currentTokens = client.getTokens() as GarminTokensPayload | undefined;

    return {
      authenticated: true,
      username: (profile.userName as string) || (profile.displayName as string) || 'Usuario Garmin',
      displayName: (profile.fullName as string) || (profile.displayName as string) || 'Garmin Connect',
      profileImageUrl: (profile.profileImageUrlLarge as string) || (profile.profileImageUrlMedium as string) || undefined,
      tokens: currentTokens || null
    };
  } catch (error: any) {
    console.error('Error fetching Garmin status:', error);
    return { authenticated: false };
  }
}

/**
 * Garantiza que category y name existan en el diccionario oficial EXERCISES de garminconnect-js
 */
export function resolveValidGarminExercise(
  exerciseId: string,
  category: string,
  garminName: string
): { category: string; name: string } {
  const dict = EXERCISES as Record<string, readonly string[]>;

  // 1. Buscar en el catálogo actualizado por ID
  const catalogMatch = EXERCISE_CATALOG.find((e) => e.id === exerciseId);
  if (catalogMatch && dict[catalogMatch.category]?.includes(catalogMatch.garminName)) {
    return {
      category: catalogMatch.category,
      name: catalogMatch.garminName
    };
  }

  // 2. Comprobar si category y garminName ya son válidos directamente
  if (dict[category]?.includes(garminName)) {
    return { category, name: garminName };
  }

  // 3. Buscar garminName en cualquier categoría de EXERCISES
  for (const [catKey, names] of Object.entries(dict)) {
    if (Array.isArray(names) && names.includes(garminName)) {
      return { category: catKey, name: garminName };
    }
  }

  // 4. Si la categoría existe pero el nombre no, usar el primer ejercicio válido de esa categoría
  if (dict[category] && Array.isArray(dict[category]) && dict[category].length > 0) {
    return { category, name: dict[category][0] };
  }

  // 5. Fallback seguro garantizado
  return { category: 'BENCH_PRESS', name: 'BARBELL_BENCH_PRESS' };
}

export async function syncRoutineToGarmin(
  routine: StrengthRoutine,
  clientTokens?: GarminTokensPayload | null
) {
  const session = await getGarminClient(clientTokens);
  if (!session) {
    throw new Error('No hay sesión activa de Garmin. Por favor conecta tu cuenta primero.');
  }
  const { garmin, client } = session;

  // 1. Convertir la rutina al formato del Workout Spec de Garmin
  const steps: any[] = [];

  // Calentamiento
  if (routine.warmupSeconds > 0) {
    steps.push({
      type: 'warmup',
      time: routine.warmupSeconds
    });
  }

  // Bloques de ejercicios
  routine.blocks.forEach((block) => {
    const validEx = resolveValidGarminExercise(
      block.exercise.id,
      block.exercise.category,
      block.exercise.garminName
    );

    steps.push({
      type: 'repeat',
      times: block.sets,
      steps: [
        {
          type: 'interval',
          reps: block.reps,
          weightKg: block.weightKg,
          exercise: validEx
        },
        {
          type: 'rest',
          restSeconds: block.restSeconds
        }
      ]
    });
  });

  // Enfriamiento
  if (routine.cooldownSeconds > 0) {
    steps.push({
      type: 'cooldown',
      time: routine.cooldownSeconds
    });
  }

  const spec = {
    name: routine.name.slice(0, 16),
    sport: 'strength_training',
    steps
  };

  const workoutPayload = workoutFromSpec(spec, EXERCISES);

  // 2. Subir a Garmin Connect
  const createdWorkout = await garmin.uploadStrengthWorkout(workoutPayload);
  const workoutId = createdWorkout.workoutId;

  // 3. Enviar orden directa al reloj (Fénix 8)
  let pushSuccess = false;
  try {
    await garmin.pushWorkoutToDevice(workoutId);
    pushSuccess = true;
  } catch (err: any) {
    console.warn('Push directo al dispositivo con advertencia:', err?.message || err);
  }

  const updatedTokens = client.getTokens() as GarminTokensPayload | undefined;

  return {
    success: true,
    workoutId,
    pushSuccess,
    workoutName: workoutPayload.workoutName,
    tokens: updatedTokens || null
  };
}

function classifySportCategory(typeKeyRaw: string): SportCategory {
  const key = (typeKeyRaw || '').toLowerCase();
  if (key.includes('strength') || key.includes('weight')) return 'Fuerza';
  if (key.includes('run') || key.includes('trail') || key.includes('track')) return 'Running';
  if (key.includes('cycl') || key.includes('biking') || key.includes('ride') || key.includes('mtb')) return 'Ciclismo';
  if (key.includes('swim')) return 'Natación';
  return 'Cardio / Otros';
}

/**
 * Descarga actividades multideporte (últimos 14 días), sueño de anoche y métricas de recuperación
 * (Training Readiness, HRV, Body Battery, FC reposo y estrés) desde Garmin Connect.
 */
export async function fetchGarminWellnessSnapshot(
  clientTokens?: GarminTokensPayload | null
): Promise<{
  success: boolean;
  snapshot: GarminWellnessSnapshot;
  tokens?: GarminTokensPayload | null;
}> {
  const session = await getGarminClient(clientTokens);
  if (!session) {
    throw new Error('No hay sesión activa de Garmin. Por favor conecta tu cuenta primero.');
  }
  const { garmin, client } = session;

  const todayStr = new Date().toISOString().slice(0, 10);

  const [
    activitiesRes,
    sleepRes,
    readinessRes,
    hrvRes,
    batteryRes,
    rhrRes,
    stressRes,
  ] = await Promise.allSettled([
    garmin.getActivities(0, 25),
    garmin.getSleepData(todayStr),
    garmin.getMorningTrainingReadiness(todayStr),
    garmin.getHrvData(todayStr),
    garmin.getBodyBattery(todayStr, todayStr),
    garmin.getRhrDaily(todayStr, todayStr),
    garmin.getStressData(todayStr),
  ]);

  // 1. Actividades recientes (últimos 14 días)
  const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const weekCutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const twoDaysCutoffMs = Date.now() - 48 * 60 * 60 * 1000;

  const weeklySportMinutes: Record<SportCategory, number> = {
    Fuerza: 0,
    Running: 0,
    Ciclismo: 0,
    Natación: 0,
    'Cardio / Otros': 0,
  };

  let recentLowerLoad = 0;
  let recentUpperLoad = 0;
  const recentActivities: GarminActivitySummary[] = [];

  if (activitiesRes.status === 'fulfilled' && Array.isArray(activitiesRes.value)) {
    for (const act of activitiesRes.value as any[]) {
      const startStr = String(act?.startTimeLocal || act?.startTimeGMT || '');
      const startMs = startStr ? new Date(startStr.replace(' ', 'T')).getTime() : 0;
      if (startMs && startMs < cutoffMs) continue;

      const typeKey = String(act?.activityType?.typeKey || 'other');
      const sportCategory = classifySportCategory(typeKey);
      const durationMinutes = Math.round(((Number(act?.duration) || 0) / 60) * 10) / 10;
      const distanceKm = Math.round(((Number(act?.distance) || 0) / 1000) * 100) / 100;

      const summary: GarminActivitySummary = {
        activityId: Number(act?.activityId || 0),
        name: String(act?.activityName || sportCategory),
        sportCategory,
        typeKey,
        startTimeLocal: startStr,
        durationMinutes,
        distanceKm,
        calories: Math.round(Number(act?.calories) || 0),
        avgHr: act?.averageHR ? Math.round(Number(act.averageHR)) : undefined,
        aerobicEffect: act?.aerobicTrainingEffect ? Number(act.aerobicTrainingEffect) : undefined,
        anaerobicEffect: act?.anaerobicTrainingEffect ? Number(act.anaerobicTrainingEffect) : undefined,
      };
      recentActivities.push(summary);

      if (!startMs || startMs >= weekCutoffMs) {
        weeklySportMinutes[sportCategory] = Math.round(
          (weeklySportMinutes[sportCategory] + durationMinutes) * 10
        ) / 10;
      }

      if (!startMs || startMs >= twoDaysCutoffMs) {
        const te = Number(act?.aerobicTrainingEffect || 2.5);
        if (sportCategory === 'Running' || sportCategory === 'Ciclismo') {
          recentLowerLoad += durationMinutes * (te / 2.5);
        } else if (sportCategory === 'Natación') {
          recentUpperLoad += durationMinutes * (te / 2.5);
        } else if (sportCategory === 'Cardio / Otros') {
          recentLowerLoad += durationMinutes * 0.5;
        }
      }
    }
  }

  // 2. Sueño
  let sleep: GarminSleepSummary | null = null;
  if (sleepRes.status === 'fulfilled' && sleepRes.value) {
    const dto = (sleepRes.value as any).dailySleepDTO || (sleepRes.value as any);
    const totalSec = Number(dto?.sleepTimeSeconds || 0);
    if (totalSec > 0) {
      sleep = {
        date: String(dto?.calendarDate || todayStr),
        durationHours: Math.round((totalSec / 3600) * 10) / 10,
        deepHours: Math.round((Number(dto?.deepSleepSeconds || 0) / 3600) * 10) / 10,
        remHours: Math.round((Number(dto?.remSleepSeconds || 0) / 3600) * 10) / 10,
        lightHours: Math.round((Number(dto?.lightSleepSeconds || 0) / 3600) * 10) / 10,
        sleepScore: dto?.sleepScores?.overall?.value
          ? Number(dto.sleepScores.overall.value)
          : undefined,
      };
    }
  }

  // 3. Recuperación (Training Readiness, HRV, Body Battery, FC reposo, Estrés)
  const recovery: GarminRecoverySummary = {};

  if (readinessRes.status === 'fulfilled' && readinessRes.value) {
    const r = Array.isArray(readinessRes.value) ? readinessRes.value[0] : readinessRes.value;
    if (r && typeof (r as any).score === 'number') {
      recovery.trainingReadinessScore = (r as any).score;
      recovery.trainingReadinessLevel = String((r as any).level || '');
    }
  }

  if (hrvRes.status === 'fulfilled' && hrvRes.value) {
    const hrvSum = (hrvRes.value as any).hrvSummary || hrvRes.value;
    if (hrvSum?.lastNightAvg) recovery.hrvLastNight = Math.round(Number(hrvSum.lastNightAvg));
    if (hrvSum?.weeklyAvg) recovery.hrvWeeklyAvg = Math.round(Number(hrvSum.weeklyAvg));
    if (hrvSum?.status) recovery.hrvStatus = String(hrvSum.status);
  }

  if (batteryRes.status === 'fulfilled' && Array.isArray(batteryRes.value) && batteryRes.value.length > 0) {
    const bb = batteryRes.value[batteryRes.value.length - 1] as any;
    const values = Array.isArray(bb?.bodyBatteryValuesArray) ? bb.bodyBatteryValuesArray : [];
    const lastValid = [...values].reverse().find((v) => Array.isArray(v) && typeof v[1] === 'number');
    if (lastValid) recovery.bodyBatteryCurrent = Number(lastValid[1]);
    if (typeof bb?.charged === 'number') recovery.bodyBatteryCharged = bb.charged;
    if (typeof bb?.drained === 'number') recovery.bodyBatteryDrained = bb.drained;
  }

  if (rhrRes.status === 'fulfilled' && Array.isArray(rhrRes.value) && rhrRes.value.length > 0) {
    const rhrEntry = rhrRes.value[0] as any;
    const val = rhrEntry?.value ?? rhrEntry?.restingHeartRate;
    if (typeof val === 'number') recovery.restingHr = Math.round(val);
  }

  if (stressRes.status === 'fulfilled' && stressRes.value) {
    const avgS = (stressRes.value as any).avgStressLevel;
    if (typeof avgS === 'number' && avgS > 0) recovery.avgStress = Math.round(avgS);
  }

  // 4. Índice unificado de Readiness (0-100) + Fatiga por zona + Insights
  let readinessIndex = 70;
  if (typeof recovery.trainingReadinessScore === 'number') {
    readinessIndex = recovery.trainingReadinessScore;
  } else {
    let score = 68;
    if (sleep) {
      if (sleep.durationHours >= 7.5) score += 14;
      else if (sleep.durationHours >= 6.5) score += 5;
      else if (sleep.durationHours < 6) score -= 18;
    }
    if (typeof recovery.bodyBatteryCurrent === 'number') {
      if (recovery.bodyBatteryCurrent >= 70) score += 10;
      else if (recovery.bodyBatteryCurrent < 35) score -= 15;
    }
    if (recovery.hrvLastNight && recovery.hrvWeeklyAvg) {
      const ratio = recovery.hrvLastNight / recovery.hrvWeeklyAvg;
      if (ratio >= 1.0) score += 6;
      else if (ratio < 0.85) score -= 12;
    }
    readinessIndex = Math.max(15, Math.min(100, Math.round(score)));
  }

  const lowerBodyFatigue: 'low' | 'moderate' | 'high' =
    recentLowerLoad >= 75 ? 'high' : recentLowerLoad >= 35 ? 'moderate' : 'low';
  const upperBodyFatigue: 'low' | 'moderate' | 'high' =
    recentUpperLoad >= 55 ? 'high' : recentUpperLoad >= 25 ? 'moderate' : 'low';

  const coachInsights: string[] = [];
  if (sleep) {
    if (sleep.durationHours < 6) {
      coachInsights.push(`Sueño corto (${sleep.durationHours}h): conviene moderar series pesadas y dejar 2-3 reps en recámara.`);
    } else if (sleep.durationHours >= 7.5) {
      coachInsights.push(`Buen descanso (${sleep.durationHours}h): entorno óptimo para buscar progresión de cargas.`);
    }
  }
  if (lowerBodyFatigue === 'high') {
    coachInsights.push('Alta carga reciente de carrera/ciclismo (48h): prioriza tren superior o reduce volumen de piernas hoy.');
  } else if (lowerBodyFatigue === 'moderate') {
    coachInsights.push('Carga moderada de cardio en piernas: ajusta las series de sentadilla/bisagra según sensaciones.');
  }
  if (upperBodyFatigue !== 'low') {
    coachInsights.push('Carga reciente de natación en tren superior: cuida el volumen de hombro y dorsal.');
  }
  if (coachInsights.length === 0) {
    coachInsights.push('Recuperación equilibrada según tus métricas de Garmin Connect.');
  }

  const updatedTokens = client.getTokens() as GarminTokensPayload | undefined;

  return {
    success: true,
    snapshot: {
      syncedAt: new Date().toISOString(),
      sleep,
      recovery,
      recentActivities: recentActivities.slice(0, 12),
      weeklySportMinutes,
      readinessIndex,
      lowerBodyFatigue,
      upperBodyFatigue,
      coachInsights,
    },
    tokens: updatedTokens || null,
  };
}
