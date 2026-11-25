import { ExerciseProgressRecord, loadProgressionHistory } from './progressive-overload-engine';
import { DbWorkoutLog, isSupabaseConfigured, parseCsvToDbLogs, syncWorkoutLogsToSupabase } from './supabase';

export const GARMIN_IMPORT_MARKER = 'garmin_import';

const CSV_HEADER =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';

export function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

/**
 * Devuelve las fechas (YYYY-MM-DD) donde ya existen series registradas por la App
 * (Entreno en Vivo o Hevy CSV), excluyendo filas importadas automáticamente desde Garmin.
 */
export function extractAppStrengthDates(
  csvRaw: string,
  liveHistory: Record<string, ExerciseProgressRecord>
): Set<string> {
  const dates = new Set<string>();

  if (csvRaw && csvRaw.trim().length > 0) {
    const lines = csvRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length >= 2) {
      const headers = parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
      const startTimeIdx = headers.indexOf('start_time');
      const notesIdx = headers.indexOf('exercise_notes');
      const repsIdx = headers.indexOf('reps');

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvRow(lines[i]);
        const date = startTimeIdx !== -1 ? String(cols[startTimeIdx] || '').trim().slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

        const reps = repsIdx !== -1 ? parseInt(cols[repsIdx], 10) || 0 : 0;
        if (reps <= 0) continue;

        const notes = notesIdx !== -1 ? String(cols[notesIdx] || '').trim().toLowerCase() : '';
        if (notes === GARMIN_IMPORT_MARKER) continue;

        dates.add(date);
      }
    }
  }

  for (const rec of Object.values(liveHistory)) {
    const date = String(rec.lastDate || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && rec.lastReps > 0 && rec.lastSets > 0) {
      dates.add(date);
    }
  }

  return dates;
}

/**
 * Elimina de `csvRaw` las filas marcadas como `garmin_import` de un día concreto
 * cuando la App registra un entrenamiento en esa fecha (la App manda en pesos y series).
 */
export function stripGarminImportedRowsForDate(csvRaw: string, dateIso: string): string {
  if (!csvRaw || !csvRaw.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return csvRaw;
  }

  const lines = csvRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return csvRaw;

  const headers = parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
  const startTimeIdx = headers.indexOf('start_time');
  const notesIdx = headers.indexOf('exercise_notes');

  if (startTimeIdx === -1 || notesIdx === -1) return csvRaw;

  const keptLines = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    const date = String(cols[startTimeIdx] || '').trim().slice(0, 10);
    const notes = String(cols[notesIdx] || '').trim().toLowerCase();
    if (date === dateIso && notes === GARMIN_IMPORT_MARKER) {
      continue;
    }
    keptLines.push(lines[i]);
  }

  return keptLines.join('\n');
}

/**
 * Fusiona series de fuerza importadas de Garmin respetando la prioridad de la App:
 * si un día ya tiene fuerza registrada en la App (Entreno en Vivo o Hevy),
 * omite las series de Garmin de ese día para evitar duplicar tonelaje o mezclar nombres.
 */
export async function mergeGarminStrengthLogsWithPriority(
  incomingLogs: DbWorkoutLog[]
): Promise<{ added: number; skippedAppDates: string[]; total: number; nextCsv: string }> {
  const currentCsv =
    typeof window !== 'undefined' ? localStorage.getItem('hevy_raw_csv_cache') || '' : '';
  const liveHistory = loadProgressionHistory();

  if (incomingLogs.length === 0) {
    return { added: 0, skippedAppDates: [], total: 0, nextCsv: currentCsv };
  }

  const appDates = extractAppStrengthDates(currentCsv, liveHistory);
  const existingKeys = new Set<string>();
  const existingLogs = currentCsv ? parseCsvToDbLogs(currentCsv) : [];

  for (const row of existingLogs) {
    const k = `${String(row.performed_at || '').slice(0, 10)}|${String(row.exercise_title || '')
      .trim()
      .toLowerCase()}|${Number(row.set_index) || 0}`;
    existingKeys.add(k);
  }

  const newRows: DbWorkoutLog[] = [];
  const skippedAppDatesSet = new Set<string>();

  for (const log of incomingLogs) {
    const date = String(log.performed_at || '').slice(0, 10);
    if (appDates.has(date)) {
      skippedAppDatesSet.add(date);
      continue;
    }

    const k = `${date}|${String(log.exercise_title || '')
      .trim()
      .toLowerCase()}|${Number(log.set_index) || 0}`;
    if (existingKeys.has(k)) continue;
    existingKeys.add(k);
    newRows.push(log);
  }

  let nextCsv = currentCsv;
  if (newRows.length > 0) {
    const formattedNewLines = newRows.map((r) => {
      const t = `"${(r.workout_title || 'Fuerza Garmin').replace(/"/g, '""')}"`;
      const d = `"${r.performed_at}"`;
      const ex = `"${(r.exercise_title || '').replace(/"/g, '""')}"`;
      return `${t},${d},${d},"",${ex},,"${GARMIN_IMPORT_MARKER}",${r.set_index},"normal",${r.weight_kg || 0},${r.reps || 0},,,,`;
    });

    const baseLines =
      currentCsv.trim().length > 0 ? currentCsv.trim().split(/\r?\n/) : [CSV_HEADER];
    nextCsv = [...baseLines, ...formattedNewLines].join('\n');

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hevy_raw_csv_cache', nextCsv);
      } catch {
        // ignore storage errors
      }
    }

    if (isSupabaseConfigured()) {
      await syncWorkoutLogsToSupabase(newRows);
    }
  }

  return {
    added: newRows.length,
    skippedAppDates: Array.from(skippedAppDatesSet),
    total: incomingLogs.length,
    nextCsv,
  };
}
