import { StrengthRoutine, WorkoutExerciseBlock } from './types';

const MAX_SHARE_PAYLOAD_CHARS = 32000;

/**
 * Codifica una rutina en un formato Base64 seguro para URLs
 */
export function encodeRoutineToShareUrl(routine: StrengthRoutine): string {
  try {
    const jsonStr = JSON.stringify(routine);
    const base64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    return encodeURIComponent(base64);
  } catch (err) {
    console.error('Error encoding routine:', err);
    return '';
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
