import { createClient } from '@supabase/supabase-js';
import { StrengthRoutine, WorkoutExerciseBlock } from './types';

function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // Si pegaron la URL del panel de control de Supabase (ej: https://supabase.com/dashboard/project/xyz...)
  const dashboardMatch = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Si pegaron solo el identificador del proyecto (ej: xyzabcdef)
  if (!url.startsWith('http://') && !url.startsWith('https://') && url.length > 5 && !url.includes('.')) {
    return `https://${url}.supabase.co`;
  }

  // Eliminar barras finales o rutas como /rest/v1 o /auth/v1
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/(rest|auth)\/v1\/?$/, '');
  return url;
}

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = cleanSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface DbRoutine {
  id: string;
  name: string;
  warmup_seconds: number;
  cooldown_seconds: number;
  blocks: WorkoutExerciseBlock[];
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbWorkoutLog {
  id?: string;
  workout_title: string;
  performed_at: string;
  exercise_title: string;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe?: number;
  user_id?: string | null;
}

async function getCurrentAuthUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Obtener todas las rutinas guardadas en Supabase (requiere sesión autenticada estricta)
 */
export async function getRoutinesFromSupabase(): Promise<StrengthRoutine[]> {
  if (!supabase) return [];

  const userId = await getCurrentAuthUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error al consultar rutinas en Supabase:', error.message);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    warmupSeconds: row.warmup_seconds,
    cooldownSeconds: row.cooldown_seconds,
    blocks: row.blocks || []
  }));
}

/**
 * Guardar o actualizar una rutina en Supabase vinculándola al usuario autenticado
 */
export async function saveRoutineToSupabase(routine: StrengthRoutine): Promise<boolean> {
  if (!supabase) return false;

  const userId = await getCurrentAuthUserId();
  if (!userId) return false;

  const payload: DbRoutine = {
    id: routine.id,
    name: routine.name,
    warmup_seconds: routine.warmupSeconds,
    cooldown_seconds: routine.cooldownSeconds,
    blocks: routine.blocks,
    user_id: userId,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('routines')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('Error al guardar rutina en Supabase:', error.message);
    return false;
  }

  return true;
}

/**
 * Eliminar una rutina de Supabase respetando propiedad estricta del usuario
 */
export async function deleteRoutineFromSupabase(routineId: string): Promise<boolean> {
  if (!supabase) return false;

  const userId = await getCurrentAuthUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', routineId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error al eliminar rutina de Supabase:', error.message);
    return false;
  }

  return true;
}

/**
 * Sincronizar un lote de registros de entrenamiento a Supabase sin duplicados
 * (requiere sesión autenticada estricta y asocia user_id)
 */
export async function syncWorkoutLogsToSupabase(logs: DbWorkoutLog[]): Promise<boolean> {
  if (!supabase || logs.length === 0) return false;

  const userId = await getCurrentAuthUserId();
  if (!userId) return false;

  const existingKeys = new Set<string>();
  try {
    const { data: existing } = await supabase
      .from('workout_logs')
      .select('performed_at, exercise_title, set_index')
      .eq('user_id', userId);
    if (Array.isArray(existing)) {
      for (const row of existing) {
        const key = `${String(row.performed_at || '').slice(0, 10)}|${String(
          row.exercise_title || ''
        )
          .trim()
          .toLowerCase()}|${Number(row.set_index) || 0}`;
        existingKeys.add(key);
      }
    }
  } catch {
    // continuar con deduplicación local del lote si falla la lectura previa
  }

  const uniqueLogs: DbWorkoutLog[] = [];
  for (const log of logs) {
    const key = `${String(log.performed_at || '').slice(0, 10)}|${String(
      log.exercise_title || ''
    )
      .trim()
      .toLowerCase()}|${Number(log.set_index) || 0}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    uniqueLogs.push({ ...log, user_id: userId });
  }

  if (uniqueLogs.length === 0) return true;

  // Insertar en bloques de 100 para evitar timeouts
  const chunkSize = 100;
  for (let i = 0; i < uniqueLogs.length; i += chunkSize) {
    const chunk = uniqueLogs.slice(i, i + chunkSize);
    const { error } = await supabase.from('workout_logs').insert(chunk);
    if (error) {
      console.error('Error al insertar historial en Supabase:', error.message);
      return false;
    }
  }

  return true;
}

/**
 * Obtener historial de entrenamientos de Supabase formateado como CSV para el analizador
 */
export async function getWorkoutLogsCsvFromSupabase(): Promise<string | null> {
  if (!supabase) return null;

  const userId = await getCurrentAuthUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', userId)
    .order('performed_at', { ascending: true });

  if (error || !data || data.length === 0) {
    return null;
  }

  // Convertir a formato compatible con el analizador
  const header = 'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe\n';
  const rows = data
    .map(row => {
      const title = `"${(row.workout_title || 'Entrenamiento').replace(/"/g, '""')}"`;
      const date = `"${row.performed_at}"`;
      const exercise = `"${(row.exercise_title || '').replace(/"/g, '""')}"`;
      return `${title},${date},${date},"",${exercise},,"",${row.set_index},"normal",${row.weight_kg || 0},${row.reps || 0},,,,${row.rpe || ''}`;
    })
    .join('\n');

  return header + rows;
}

/**
 * Reemplaza o elimina todas las series de una sesión de fuerza concreta en un día dado
 * tanto en caché local (`hevy_raw_csv_cache`) como en Supabase (`workout_logs`).
 */
export async function replaceStrengthSessionLogs(params: {
  date: string;
  originalWorkoutTitle: string;
  newWorkoutTitle: string;
  logs: Omit<DbWorkoutLog, 'user_id'>[];
}): Promise<{ ok: boolean; syncedCloud: boolean }> {
  const { date, originalWorkoutTitle, newWorkoutTitle, logs } = params;
  const targetTitleLower = originalWorkoutTitle.trim().toLowerCase();
  const safeNewTitle = newWorkoutTitle.trim() || 'Entrenamiento';

  // 1. Actualizar caché CSV local en navegador
  if (typeof window !== 'undefined') {
    try {
      const header =
        'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';
      const rawCsv = localStorage.getItem('hevy_raw_csv_cache') || '';
      const lines = rawCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const keptLines: string[] = [header];

      if (lines.length >= 2) {
        const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
        const titleIdx = headers.indexOf('title');
        const startTimeIdx = headers.indexOf('start_time');
        const notesIdx = headers.indexOf('exercise_notes');

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const rowDate = startTimeIdx !== -1 ? String(cols[startTimeIdx] || '').trim().slice(0, 10) : '';
          const rowTitle = titleIdx !== -1 ? String(cols[titleIdx] || '').trim().toLowerCase() : '';
          const rowNotes = notesIdx !== -1 ? String(cols[notesIdx] || '').trim().toLowerCase() : '';
          const isGenericGarmin = ['fuerza', 'fuerza garmin', 'strength'].includes(rowTitle);

          if (rowDate === date && (rowTitle === targetTitleLower || rowNotes === 'garmin_import' || isGenericGarmin)) {
            continue;
          }
          keptLines.push(lines[i]);
        }
      }

      const performedIso = `${date}T12:00:00.000Z`;
      const formattedNew = logs
        .filter((r) => (r.reps || 0) > 0)
        .map((r) => {
          const t = `"${safeNewTitle.replace(/"/g, '""')}"`;
          const d = `"${r.performed_at || performedIso}"`;
          const ex = `"${(r.exercise_title || '').replace(/"/g, '""')}"`;
          return `${t},${d},${d},"",${ex},,"",${r.set_index},"normal",${r.weight_kg || 0},${r.reps || 0},,,,${r.rpe || ''}`;
        });

      localStorage.setItem('hevy_raw_csv_cache', [...keptLines, ...formattedNew].join('\n'));
    } catch {
      // ignore storage errors
    }
  }

  // 2. Actualizar en Supabase si hay sesión autenticada
  let syncedCloud = false;
  if (supabase) {
    const userId = await getCurrentAuthUserId();
    if (userId) {
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;

      const { error: delError } = await supabase
        .from('workout_logs')
        .delete()
        .eq('user_id', userId)
        .eq('workout_title', originalWorkoutTitle)
        .gte('performed_at', dayStart)
        .lte('performed_at', dayEnd);

      if (delError) {
        console.error('Error al borrar sesión previa en Supabase:', delError.message);
        return { ok: false, syncedCloud: false };
      }

      const validLogs = logs
        .filter((r) => (r.reps || 0) > 0 && r.exercise_title.trim().length > 0)
        .map((r) => ({
          workout_title: safeNewTitle,
          performed_at: r.performed_at || `${date}T12:00:00.000Z`,
          exercise_title: r.exercise_title.trim(),
          set_index: r.set_index,
          weight_kg: r.weight_kg || 0,
          reps: r.reps || 0,
          ...(r.rpe ? { rpe: r.rpe } : {}),
          user_id: userId,
        }));

      if (validLogs.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < validLogs.length; i += chunkSize) {
          const chunk = validLogs.slice(i, i + chunkSize);
          const { error: insError } = await supabase.from('workout_logs').insert(chunk);
          if (insError) {
            console.error('Error al guardar sesión editada en Supabase:', insError.message);
            return { ok: false, syncedCloud: false };
          }
        }
      }
      syncedCloud = true;
    }
  }

  return { ok: true, syncedCloud };
}

export async function deleteStrengthSessionLogs(params: {
  date: string;
  workoutTitle: string;
}): Promise<{ ok: boolean; syncedCloud: boolean }> {
  return replaceStrengthSessionLogs({
    date: params.date,
    originalWorkoutTitle: params.workoutTitle,
    newWorkoutTitle: params.workoutTitle,
    logs: [],
  });
}

/**
 * Convierte un contenido CSV en registros para insertar en la tabla workout_logs de Supabase
 */
export function parseCsvToDbLogs(csvContent: string): DbWorkoutLog[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const titleIdx = headers.indexOf('title');
  const startTimeIdx = headers.indexOf('start_time');
  const exerciseTitleIdx = headers.indexOf('exercise_title');
  const setIndexIdx = headers.indexOf('set_index');
  const weightIdx = headers.indexOf('weight_kg');
  const repsIdx = headers.indexOf('reps');
  const rpeIdx = headers.indexOf('rpe');

  if (exerciseTitleIdx === -1) return [];

  const logs: DbWorkoutLog[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const exerciseTitle = cols[exerciseTitleIdx]?.trim();
    if (!exerciseTitle) continue;

    const workoutTitle = titleIdx !== -1 ? cols[titleIdx]?.trim() || 'Entrenamiento' : 'Entrenamiento';
    const rawDate = startTimeIdx !== -1 ? cols[startTimeIdx]?.trim() : '';
    const performedAt = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
    const setIndex = setIndexIdx !== -1 ? parseInt(cols[setIndexIdx], 10) || 0 : 0;
    const weight = weightIdx !== -1 ? parseFloat(cols[weightIdx]) || 0 : 0;
    const reps = repsIdx !== -1 ? parseInt(cols[repsIdx], 10) || 0 : 0;
    const rpe = rpeIdx !== -1 ? parseFloat(cols[rpeIdx]) || undefined : undefined;

    logs.push({
      workout_title: workoutTitle,
      performed_at: performedAt,
      exercise_title: exerciseTitle,
      set_index: setIndex,
      weight_kg: weight,
      reps: reps,
      rpe: rpe
    });
  }

  return logs;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue);
  return values;
}

