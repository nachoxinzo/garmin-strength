import { EXERCISE_CATALOG } from './exercise-catalog';
import { StrengthRoutine, WorkoutExerciseBlock } from './types';

const MAX_SHARE_PAYLOAD_CHARS = 32000;

/**
 * Codifica una rutina en un formato Base64 seguro para URLs (/live?data=...)
 */
export function encodeRoutineToShareUrl(routine: StrengthRoutine): string {
  try {
    const jsonStr = JSON.stringify(routine);
    const base64 = btoa(
      encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );
    return encodeURIComponent(base64);
  } catch (err) {
    console.error('Error encoding routine:', err);
    return '';
  }
}

/**
 * Codifica una rutina en formato compacto (~75% más corto) usando IDs del catálogo
 * para enlaces de respaldo (?import=...) cuando no haya conexión a Supabase.
 */
export function encodeCompactRoutine(routine: StrengthRoutine): string {
  try {
    const compact = {
      n: (routine.name || 'Rutina').slice(0, 32),
      w: Math.round(routine.warmupSeconds || 0),
      c: Math.round(routine.cooldownSeconds || 0),
      b: (routine.blocks || []).slice(0, 50).map((blk) => {
        const known = EXERCISE_CATALOG.some((e) => e.id === blk.exercise.id);
        return known
          ? [blk.exercise.id, blk.sets, blk.reps, blk.weightKg, blk.restSeconds]
          : [
              blk.exercise.id,
              blk.sets,
              blk.reps,
              blk.weightKg,
              blk.restSeconds,
              blk.exercise.name.slice(0, 60),
            ];
      }),
    };
    const jsonStr = JSON.stringify(compact);
    const base64 = btoa(
      encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return base64;
  } catch (err) {
    console.error('Error encoding compact routine:', err);
    return '';
  }
}

/**
 * Decodifica un enlace compacto (?import=...) reconstruyendo el catálogo Garmin completo.
 */
export function decodeCompactRoutine(encoded: string): StrengthRoutine | null {
  try {
    if (!encoded || encoded.length > MAX_SHARE_PAYLOAD_CHARS) {
      return null;
    }
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const base64 = normalized + '='.repeat(padLen);

    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(atob(base64), (c: string) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.b)) {
      return null;
    }

    const blocks: WorkoutExerciseBlock[] = [];
    for (let i = 0; i < Math.min(50, parsed.b.length); i++) {
      const tuple = parsed.b[i];
      if (!Array.isArray(tuple) || typeof tuple[0] !== 'string') continue;
      const exId = tuple[0].slice(0, 80);
      const catalogMatch = EXERCISE_CATALOG.find((e) => e.id === exId);
      const fallbackName =
        typeof tuple[5] === 'string' && tuple[5].trim() ? tuple[5].trim().slice(0, 120) : exId;

      blocks.push({
        id: `compact-${Date.now()}-${i}`,
        exercise: catalogMatch || {
          id: exId,
          name: fallbackName,
          muscleGroup: 'Pecho',
          category: 'BENCH_PRESS',
          garminName: 'BARBELL_BENCH_PRESS',
          equipment: 'Barra',
          pattern: 'Empuje Horizontal',
          tier: 2,
        },
        sets: Math.min(20, Math.max(1, Math.round(Number(tuple[1]) || 3))),
        reps: Math.min(100, Math.max(1, Math.round(Number(tuple[2]) || 10))),
        weightKg: Math.min(500, Math.max(0, Number(tuple[3]) || 0)),
        restSeconds: Math.min(600, Math.max(0, Math.round(Number(tuple[4]) || 90))),
      });
    }

    if (blocks.length === 0) return null;

    return {
      id: `shared-${Date.now()}`,
      name: String(parsed.n || 'Rutina Compartida').trim().slice(0, 32) || 'Rutina Compartida',
      warmupSeconds: Math.min(3600, Math.max(0, Math.round(Number(parsed.w) || 0))),
      cooldownSeconds: Math.min(3600, Math.max(0, Math.round(Number(parsed.c) || 0))),
      blocks,
    };
  } catch (err) {
    console.error('Error decoding compact routine:', err);
    return null;
  }
}

/**
 * Decodifica y valida estrictamente una rutina a partir del parámetro de URL
 */
export function decodeRoutineFromShareUrl(encoded: string): StrengthRoutine | null {
  try {
    if (!encoded || encoded.length > MAX_SHARE_PAYLOAD_CHARS) {
      return null;
    }

    const rawBase64 = decodeURIComponent(encoded);
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(atob(rawBase64), (c: string) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    const parsed = JSON.parse(jsonStr);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.name !== 'string' ||
      !Array.isArray(parsed.blocks) ||
      parsed.blocks.length > 50
    ) {
      return null;
    }

    const validBlocks: WorkoutExerciseBlock[] = [];
    for (let i = 0; i < parsed.blocks.length; i++) {
      const b = parsed.blocks[i];
      if (
        !b ||
        typeof b !== 'object' ||
        !b.exercise ||
        typeof b.exercise.id !== 'string' ||
        typeof b.exercise.name !== 'string'
      ) {
        continue;
      }
      validBlocks.push({
        id: String(b.id || `shared-${i}`).slice(0, 64),
        exercise: {
          id: b.exercise.id.slice(0, 80),
          name: b.exercise.name.slice(0, 120),
          muscleGroup: b.exercise.muscleGroup,
          category: String(b.exercise.category || 'BENCH_PRESS').slice(0, 64),
          garminName: String(b.exercise.garminName || 'BARBELL_BENCH_PRESS').slice(0, 80),
          equipment: b.exercise.equipment,
          pattern: b.exercise.pattern,
          tier: [1, 2, 3].includes(b.exercise.tier) ? b.exercise.tier : 2,
        },
        sets: Math.min(20, Math.max(1, Math.round(Number(b.sets) || 3))),
        reps: Math.min(100, Math.max(1, Math.round(Number(b.reps) || 10))),
        weightKg: Math.min(500, Math.max(0, Number(b.weightKg) || 0)),
        restSeconds: Math.min(600, Math.max(0, Math.round(Number(b.restSeconds) || 90))),
      });
    }

    return {
      id: String(parsed.id || `shared-${Date.now()}`).slice(0, 64),
      name: parsed.name.trim().slice(0, 32) || 'Rutina Compartida',
      warmupSeconds: Math.min(3600, Math.max(0, Math.round(Number(parsed.warmupSeconds) || 0))),
      cooldownSeconds: Math.min(3600, Math.max(0, Math.round(Number(parsed.cooldownSeconds) || 0))),
      blocks: validBlocks,
    };
  } catch (err) {
    console.error('Error decoding routine:', err);
    return null;
  }
}
