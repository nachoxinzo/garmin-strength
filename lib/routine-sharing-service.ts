import { EXERCISE_CATALOG } from './exercise-catalog';
import { encodeCompactRoutine } from './share-utils';
import { supabase } from './supabase';
import { StrengthRoutine, WorkoutExerciseBlock } from './types';

export type WeightAdaptMode = 'keep' | 'zero' | 'scale85' | 'scale75';

export interface ShortShareLinkResult {
  ok: boolean;
  mode: 'short' | 'compact';
  shareCode: string | null;
  url: string;
  note?: string;
}

export interface SharedRoutineSnapshot {
  share_code: string;
  author_name: string;
  routine_name: string;
  routine: StrengthRoutine;
  import_count: number;
  created_at: string;
}

export interface ReceivedRoutineShare {
  id: string;
  sender_id: string;
  recipient_id: string;
  routine_name: string;
  routine: StrengthRoutine;
  message?: string | null;
  status: 'unread' | 'imported' | 'dismissed';
  created_at: string;
  sender?: {
    id: string;
    username: string;
    display_name: string;
  } | null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateShareCode(length = 8): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Valida y sanea una rutina recibida de Supabase/URL antes de renderizarla o guardarla.
 */
export function sanitizeSharedRoutine(raw: unknown): StrengthRoutine | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || !Array.isArray(obj.blocks)) return null;

  const validBlocks: WorkoutExerciseBlock[] = [];
  for (let i = 0; i < Math.min(50, obj.blocks.length); i++) {
    const b = obj.blocks[i] as Record<string, unknown>;
    if (!b || typeof b !== 'object' || !b.exercise || typeof b.exercise !== 'object') continue;
    const ex = b.exercise as Record<string, unknown>;
    if (typeof ex.id !== 'string' || typeof ex.name !== 'string') continue;

    const catalogMatch = EXERCISE_CATALOG.find((c) => c.id === ex.id);
    validBlocks.push({
      id: String(b.id || `shared-blk-${i}-${Date.now()}`).slice(0, 64),
      exercise: catalogMatch || {
        id: ex.id.slice(0, 80),
        name: ex.name.slice(0, 120),
        muscleGroup: (ex.muscleGroup as any) || 'Pecho',
        category: String(ex.category || 'BENCH_PRESS').slice(0, 64),
        garminName: String(ex.garminName || 'BARBELL_BENCH_PRESS').slice(0, 80),
        equipment: (ex.equipment as any) || 'Barra',
        pattern: (ex.pattern as any) || 'Empuje Horizontal',
        tier: [1, 2, 3].includes(Number(ex.tier)) ? (Number(ex.tier) as 1 | 2 | 3) : 2,
      },
      sets: Math.min(20, Math.max(1, Math.round(Number(b.sets) || 3))),
      reps: Math.min(100, Math.max(1, Math.round(Number(b.reps) || 10))),
      weightKg: Math.min(500, Math.max(0, Number(b.weightKg) || 0)),
      restSeconds: Math.min(600, Math.max(0, Math.round(Number(b.restSeconds) || 90))),
      supersetGroupId:
        typeof b.supersetGroupId === 'string' ? b.supersetGroupId.slice(0, 48) : undefined,
      targetRir: typeof b.targetRir === 'string' ? b.targetRir.slice(0, 24) : undefined,
    });
  }

  if (validBlocks.length === 0) return null;

  return {
    id: String(obj.id || `shared-${Date.now()}`).slice(0, 64),
    name: obj.name.trim().slice(0, 32) || 'Rutina Compartida',
    warmupSeconds: Math.min(3600, Math.max(0, Math.round(Number(obj.warmupSeconds) || 0))),
    cooldownSeconds: Math.min(3600, Math.max(0, Math.round(Number(obj.cooldownSeconds) || 0))),
    blocks: validBlocks,
  };
}

/**
 * Adapta los pesos de una rutina compartida para ajustarla al nivel de tu amigo
 * y genera un ID limpio para evitar colisiones al guardarla en su cuenta.
 */
export function applyWeightModeToRoutine(
  routine: StrengthRoutine,
  mode: WeightAdaptMode
): StrengthRoutine {
  const factor = mode === 'scale85' ? 0.85 : mode === 'scale75' ? 0.75 : 1;

  return {
    ...routine,
    id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    blocks: routine.blocks.map((blk, idx) => {
      let nextWeight = Number(blk.weightKg) || 0;
      if (mode === 'zero') {
        nextWeight = 0;
      } else if (mode !== 'keep' && nextWeight > 0) {
        nextWeight = Math.max(2.5, Math.round((nextWeight * factor) / 2.5) * 2.5);
      }
      return {
        ...blk,
        id: `imp-blk-${Date.now()}-${idx}`,
        weightKg: nextWeight,
      };
    }),
  };
}

/**
 * Crea un enlace corto `/r/CODIGO` en Supabase si está autenticado y la tabla existe;
 * si no, genera automáticamente un enlace compacto `/?import=...` sin fallar nunca.
 */
export async function createShortShareLink(
  routine: StrengthRoutine,
  authorName?: string
): Promise<ShortShareLinkResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const compactFallbackUrl = `${origin}/?import=${encodeCompactRoutine(routine)}`;

  if (!supabase) {
    return {
      ok: true,
      mode: 'compact',
      shareCode: null,
      url: compactFallbackUrl,
      note: 'Enlace directo compacto (modo local sin nube).',
    };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return {
        ok: true,
        mode: 'compact',
        shareCode: null,
        url: compactFallbackUrl,
        note: 'Inicia sesión para generar códigos cortos /r/CODIGO; usando enlace directo compacto.',
      };
    }

    const shareCode = generateShareCode(8);
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const resolvedAuthor =
      authorName?.trim() ||
      (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
      (typeof meta.username === 'string' && meta.username.trim()) ||
      user.email?.split('@')[0] ||
      'Atleta';

    const { error } = await supabase.from('shared_routines').insert({
      share_code: shareCode,
      owner_id: user.id,
      author_name: resolvedAuthor.slice(0, 60),
      routine_name: (routine.name || 'Rutina').slice(0, 48),
      routine_payload: routine,
    });

    if (error) {
      return {
        ok: true,
        mode: 'compact',
        shareCode: null,
        url: compactFallbackUrl,
        note: 'Tabla shared_routines pendiente en Supabase; usando enlace directo compacto.',
      };
    }

    return {
      ok: true,
      mode: 'short',
      shareCode,
      url: `${origin}/r/${shareCode}`,
    };
  } catch {
    return {
      ok: true,
      mode: 'compact',
      shareCode: null,
      url: compactFallbackUrl,
    };
  }
}

export async function fetchSharedRoutineByCode(
  code: string
): Promise<{ snapshot: SharedRoutineSnapshot | null; error?: string }> {
  if (!supabase) {
    return { snapshot: null, error: 'Supabase no está configurado en este entorno.' };
  }
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCode || cleanCode.length < 4) {
    return { snapshot: null, error: 'El código de rutina no es válido.' };
  }

  const { data, error } = await supabase.rpc('get_shared_routine_by_code', {
    p_code: cleanCode,
  });

  if (error) {
    return { snapshot: null, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { snapshot: null, error: 'No se encontró ninguna rutina con ese código.' };
  }

  const sanitized = sanitizeSharedRoutine(row.routine_payload);
  if (!sanitized) {
    return { snapshot: null, error: 'La rutina compartida está vacía o dañada.' };
  }

  return {
    snapshot: {
      share_code: String(row.share_code || cleanCode),
      author_name: String(row.author_name || 'Atleta'),
      routine_name: String(row.routine_name || sanitized.name),
      routine: sanitized,
      import_count: Number(row.import_count) || 0,
      created_at: String(row.created_at || ''),
    },
  };
}

export async function incrementSharedRoutineImport(code: string): Promise<void> {
  if (!supabase) return;
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCode) return;
  try {
    await supabase.rpc('increment_shared_routine_import', { p_code: cleanCode });
  } catch {
    // ignore telemetry increment failure
  }
}

export async function sendRoutineToFriend(params: {
  recipientId: string;
  routine: StrengthRoutine;
  message?: string;
}): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: 'Supabase no conectado' };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return { success: false, message: 'Debes iniciar sesión para enviar a amigos.' };
  if (user.id === params.recipientId) {
    return { success: false, message: 'No puedes enviarte una rutina a ti mismo.' };
  }

  const sanitized = sanitizeSharedRoutine(params.routine);
  if (!sanitized) {
    return { success: false, message: 'La rutina está vacía o no es válida.' };
  }

  const { error } = await supabase.from('routine_shares').insert({
    sender_id: user.id,
    recipient_id: params.recipientId,
    routine_name: sanitized.name,
    routine_payload: sanitized,
    message: params.message?.trim().slice(0, 180) || null,
    status: 'unread',
  });

  if (error) {
    return { success: false, message: error.message || 'No se pudo enviar la rutina.' };
  }

  return { success: true, message: `¡Rutina "${sanitized.name}" enviada a tu amigo!` };
}

export async function getReceivedRoutines(): Promise<ReceivedRoutineShare[]> {
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('routine_shares')
    .select(
      `
      id,
      sender_id,
      recipient_id,
      routine_name,
      routine_payload,
      message,
      status,
      created_at,
      sender:profiles!routine_shares_sender_id_fkey(id, username, display_name)
    `
    )
    .eq('recipient_id', user.id)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error || !data) return [];

  const list: ReceivedRoutineShare[] = [];
  for (const row of data as any[]) {
    const sanitized = sanitizeSharedRoutine(row.routine_payload);
    if (!sanitized) continue;
    list.push({
      id: row.id,
      sender_id: row.sender_id,
      recipient_id: row.recipient_id,
      routine_name: row.routine_name || sanitized.name,
      routine: sanitized,
      message: row.message || null,
      status: row.status,
      created_at: row.created_at,
      sender: Array.isArray(row.sender) ? row.sender[0] : row.sender || null,
    });
  }
  return list;
}

export async function getUnreadReceivedCount(): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return 0;

    const { count, error } = await supabase
      .from('routine_shares')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('status', 'unread');

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function updateReceivedRoutineStatus(
  shareId: string,
  status: 'imported' | 'dismissed'
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('routine_shares')
    .update({ status })
    .eq('id', shareId);
  return !error;
}
