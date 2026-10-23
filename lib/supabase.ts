import { createClient } from '@supabase/supabase-js';
import { StrengthRoutine, WorkoutExerciseBlock } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
}

/**
 * Obtener todas las rutinas guardadas en Supabase
 */
export async function getRoutinesFromSupabase(): Promise<StrengthRoutine[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('routines')
    .select('*')
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
 * Guardar o actualizar una rutina en Supabase
 */
export async function saveRoutineToSupabase(routine: StrengthRoutine): Promise<boolean> {
  if (!supabase) return false;

  const payload: DbRoutine = {
    id: routine.id,
    name: routine.name,
    warmup_seconds: routine.warmupSeconds,
    cooldown_seconds: routine.cooldownSeconds,
    blocks: routine.blocks,
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
 * Eliminar una rutina de Supabase
 */
export async function deleteRoutineFromSupabase(routineId: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', routineId);

  if (error) {
    console.error('Error al eliminar rutina de Supabase:', error.message);
    return false;
  }

  return true;
}

/**
 * Sincronizar un lote de registros de entrenamiento a Supabase
 */
export async function syncWorkoutLogsToSupabase(logs: DbWorkoutLog[]): Promise<boolean> {
  if (!supabase || logs.length === 0) return false;

  // Insertar en bloques de 100 para evitar timeouts
  const chunkSize = 100;
  for (let i = 0; i < logs.length; i += chunkSize) {
    const chunk = logs.slice(i, i + chunkSize);
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

  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
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

