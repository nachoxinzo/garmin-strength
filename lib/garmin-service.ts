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
import { StrengthRoutine, GarminAccountStatus } from './types';
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
      globalMemoryTokens = this.clientTokens;
      return this.clientTokens;
    }

    if (isValidTokensPayload(globalMemoryTokens)) {
      return globalMemoryTokens;
    }

    // Intentar cargar desde /tmp (Vercel)
    try {
      const tmpStore = new FileTokenStore(getTmpTokensPath());
      const tmpTokens = await tmpStore.load();
      if (isValidTokensPayload(tmpTokens)) {
        globalMemoryTokens = tmpTokens;
        return tmpTokens;
      }
    } catch {
      // ignore
    }

    // Intentar cargar desde ./tokens (Local)
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
