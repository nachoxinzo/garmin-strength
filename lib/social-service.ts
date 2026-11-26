import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  friend_code: string;
  avatar_url?: string;
}

export interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  friend: UserProfile;
  isSender: boolean;
}

export interface GymChallenge {
  id: string;
  creator_id: string;
  opponent_id: string;
  title: string;
  exercise_title?: string;
  metric: 'max_weight' | 'estimated_1rm' | 'total_volume' | 'sessions_count';
  target_value?: number;
  start_date: string;
  end_date: string;
  status: 'pending' | 'active' | 'completed' | 'declined';
  winner_id?: string;
  creator?: UserProfile;
  opponent?: UserProfile;
  userProgress?: number;
  opponentProgress?: number;
}

/**
 * Obtener el perfil del usuario autenticado actual
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) return data;

    // Si aún no existe la fila en la tabla profiles (ej: trigger pendiente),
    // generamos el perfil automáticamente a partir de los datos de autenticación
    const meta = user.user_metadata || {};
    const username = meta.username || user.email?.split('@')[0] || 'atleta';
    const displayName = meta.display_name || user.email?.split('@')[0] || 'Atleta';
    const friendCode = user.id.replace(/-/g, '').slice(0, 8);

    const fallbackProfile: UserProfile = {
      id: user.id,
      username,
      display_name: displayName,
      friend_code: friendCode
    };

    // Intentar persistirlo en Supabase
    await supabase.from('profiles').upsert(fallbackProfile);

    return fallbackProfile;
  } catch (err) {
    const meta = user.user_metadata || {};
    return {
      id: user.id,
      username: meta.username || user.email?.split('@')[0] || 'atleta',
      display_name: meta.display_name || user.email?.split('@')[0] || 'Atleta',
      friend_code: user.id.replace(/-/g, '').slice(0, 8)
    };
  }
}

/**
 * Buscar un amigo por nombre de usuario o código de amigo de 8 caracteres
 */
export async function searchProfiles(query: string): Promise<UserProfile[]> {
  if (!supabase || !query.trim()) return [];
  const cleanQuery = query.trim().toLowerCase();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, friend_code, avatar_url')
    .or(`username.ilike.%${cleanQuery}%,friend_code.eq.${cleanQuery}`)
    .limit(10);

  if (error || !data) return [];
  return data;
}

/**
 * Obtener lista de amigos del usuario actual
 */
export async function getFriendships(): Promise<Friendship[]> {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      sender_id,
      receiver_id,
      status,
      sender:profiles!friendships_sender_id_fkey(id, username, display_name, friend_code),
      receiver:profiles!friendships_receiver_id_fkey(id, username, display_name, friend_code)
    `)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  if (error || !data) return [];

  return data.map((row: any) => {
    const isSender = row.sender_id === user.id;
    const friend = isSender ? row.receiver : row.sender;
    return {
      id: row.id,
      sender_id: row.sender_id,
      receiver_id: row.receiver_id,
      status: row.status,
      isSender,
      friend
    };
  });
}

/**
 * Enviar solicitud de amistad
 */
export async function sendFriendRequest(receiverId: string): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: 'Supabase no conectado' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Debes iniciar sesión' };
  if (user.id === receiverId) return { success: false, message: 'No puedes añadirte a ti mismo' };

  const { error } = await supabase.from('friendships').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    status: 'pending'
  });

  if (error) {
    if (error.code === '23505') return { success: false, message: 'Ya existe una solicitud con este usuario' };
    return { success: false, message: error.message };
  }

  return { success: true, message: 'Solicitud de amistad enviada' };
}

/**
 * Aceptar o rechazar solicitud de amistad
 */
export async function respondToFriendRequest(friendshipId: string, accept: boolean): Promise<boolean> {
  if (!supabase) return false;
  const status = accept ? 'accepted' : 'rejected';
  const { error } = await supabase
    .from('friendships')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', friendshipId);

  return !error;
}

/**
 * Obtener retos activos o pendientes
 */
export async function getChallenges(): Promise<GymChallenge[]> {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('challenges')
    .select(`
      *,
      creator:profiles!challenges_creator_id_fkey(id, username, display_name),
      opponent:profiles!challenges_opponent_id_fkey(id, username, display_name)
    `)
    .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data;
}

/**
 * Crear un nuevo reto
 */
export async function createChallenge(payload: {
  opponent_id: string;
  title: string;
  metric: 'max_weight' | 'estimated_1rm' | 'total_volume' | 'sessions_count';
  exercise_title?: string;
  target_value?: number;
  durationDays: number;
}): Promise<boolean> {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + payload.durationDays);

  const { error } = await supabase.from('challenges').insert({
    creator_id: user.id,
    opponent_id: payload.opponent_id,
    title: payload.title,
    exercise_title: payload.exercise_title || null,
    metric: payload.metric,
    target_value: payload.target_value || null,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    status: 'pending'
  });

  return !error;
}

/**
 * Aceptar o rechazar un reto
 */
export async function respondToChallenge(challengeId: string, accept: boolean): Promise<boolean> {
  if (!supabase) return false;
  const status = accept ? 'active' : 'declined';
  const { error } = await supabase
    .from('challenges')
    .update({ status })
    .eq('id', challengeId);

  return !error;
}

/**
 * Comparativa en tiempo real entre un amigo y el usuario en un ejercicio
 */
export async function compareExerciseWithFriend(exerciseTitle: string, friendId: string) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Consultar registros de ambos usuarios para el ejercicio especificado
  const { data, error } = await supabase
    .from('workout_logs')
    .select('user_id, performed_at, weight_kg, reps')
    .eq('exercise_title', exerciseTitle)
    .in('user_id', [user.id, friendId])
    .order('performed_at', { ascending: true });

  if (error || !data || data.length === 0) return null;

  const userLogs = data.filter(d => d.user_id === user.id);
  const friendLogs = data.filter(d => d.user_id === friendId);

  return {
    userLogs,
    friendLogs
  };
}

export interface AthleteAggregateStats {
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  sessionsCount: number;
  avgVolumePerSessionKg: number;
  maxWeightKg: number;
  maxWeightExercise: string;
  bestEstimated1RMKg: number;
  best1RMExercise: string;
  distinctExercises: number;
}

export interface ExerciseComparisonStats {
  totalVolumeKg: number;
  maxWeightKg: number;
  estimated1RMKg: number;
  totalSets: number;
  totalReps: number;
  bestSetLabel: string;
}

export interface ExerciseComparisonRow {
  exerciseKey: string;
  exerciseTitle: string;
  isShared: boolean;
  myStats: ExerciseComparisonStats;
  friendStats: ExerciseComparisonStats;
}

export interface FriendHeadToHeadData {
  me: AthleteAggregateStats;
  friend: AthleteAggregateStats;
  exercises: ExerciseComparisonRow[];
}

function calcEpley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  if (reps <= 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

function emptyExerciseStats(): ExerciseComparisonStats {
  return {
    totalVolumeKg: 0,
    maxWeightKg: 0,
    estimated1RMKg: 0,
    totalSets: 0,
    totalReps: 0,
    bestSetLabel: '—',
  };
}

/**
 * Comparativa integral cara a cara entre el usuario y un amigo aceptado:
 * volumen total, 1RM máximo, peso máximo, sesiones y desglose completo por ejercicio.
 */
export async function getFriendHeadToHeadComparison(
  friendId: string,
  rangeDays: 7 | 30 | 90 | 'all' = 'all'
): Promise<FriendHeadToHeadData | null> {
  if (!supabase || !friendId) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from('workout_logs')
    .select('user_id, performed_at, exercise_title, weight_kg, reps')
    .in('user_id', [user.id, friendId])
    .order('performed_at', { ascending: true });

  if (rangeDays !== 'all') {
    const since = new Date();
    since.setDate(since.getDate() - rangeDays);
    query = query.gte('performed_at', since.toISOString());
  }

  const { data, error } = await query;
  if (error || !data) return null;

  type LogRow = {
    user_id: string;
    performed_at: string;
    exercise_title: string;
    weight_kg: number | string;
    reps: number | string;
  };

  const rows = data as LogRow[];

  const initAggregate = () => ({
    totalVolumeKg: 0,
    totalSets: 0,
    totalReps: 0,
    sessionDays: new Set<string>(),
    exerciseKeys: new Set<string>(),
    maxWeightKg: 0,
    maxWeightExercise: '—',
    bestEstimated1RMKg: 0,
    best1RMExercise: '—',
  });

  const myAgg = initAggregate();
  const friendAgg = initAggregate();

  const exerciseMap = new Map<
    string,
    {
      exerciseTitle: string;
      myStats: ExerciseComparisonStats;
      friendStats: ExerciseComparisonStats;
      myBest1RMForLabel: number;
      friendBest1RMForLabel: number;
    }
  >();

  for (const row of rows) {
    const title = String(row.exercise_title || '').trim();
    if (!title) continue;
    const key = title.toLowerCase();

    const w = Number(row.weight_kg) || 0;
    const r = Number(row.reps) || 0;
    const vol = w * r;
    const est1RM = calcEpley1RM(w, r);
    const day = String(row.performed_at || '').slice(0, 10);

    const isMe = row.user_id === user.id;
    const agg = isMe ? myAgg : friendAgg;

    agg.totalSets += 1;
    agg.totalReps += r;
    agg.totalVolumeKg += vol;
    if (day) agg.sessionDays.add(day);
    agg.exerciseKeys.add(key);

    if (w > agg.maxWeightKg) {
      agg.maxWeightKg = w;
      agg.maxWeightExercise = title;
    }
    if (est1RM > agg.bestEstimated1RMKg) {
      agg.bestEstimated1RMKg = est1RM;
      agg.best1RMExercise = title;
    }

    let entry = exerciseMap.get(key);
    if (!entry) {
      entry = {
        exerciseTitle: title,
        myStats: emptyExerciseStats(),
        friendStats: emptyExerciseStats(),
        myBest1RMForLabel: -1,
        friendBest1RMForLabel: -1,
      };
      exerciseMap.set(key, entry);
    }

    const targetStats = isMe ? entry.myStats : entry.friendStats;
    targetStats.totalSets += 1;
    targetStats.totalReps += r;
    targetStats.totalVolumeKg = Math.round(targetStats.totalVolumeKg + vol);
    if (w > targetStats.maxWeightKg) targetStats.maxWeightKg = w;
    if (est1RM > targetStats.estimated1RMKg) targetStats.estimated1RMKg = est1RM;

    const currentBestScore = est1RM > 0 ? est1RM : w * 100 + r;
    if (isMe && currentBestScore > entry.myBest1RMForLabel) {
      entry.myBest1RMForLabel = currentBestScore;
      targetStats.bestSetLabel = w > 0 ? `${w} kg × ${r}` : `${r} reps`;
    } else if (!isMe && currentBestScore > entry.friendBest1RMForLabel) {
      entry.friendBest1RMForLabel = currentBestScore;
      targetStats.bestSetLabel = w > 0 ? `${w} kg × ${r}` : `${r} reps`;
    }
  }

  const finalizeAggregate = (agg: ReturnType<typeof initAggregate>): AthleteAggregateStats => {
    const sessionsCount = agg.sessionDays.size;
    const totalVolumeKg = Math.round(agg.totalVolumeKg);
    return {
      totalVolumeKg,
      totalSets: agg.totalSets,
      totalReps: agg.totalReps,
      sessionsCount,
      avgVolumePerSessionKg: sessionsCount > 0 ? Math.round(totalVolumeKg / sessionsCount) : 0,
      maxWeightKg: Math.round(agg.maxWeightKg * 10) / 10,
      maxWeightExercise: agg.maxWeightExercise,
      bestEstimated1RMKg: agg.bestEstimated1RMKg,
      best1RMExercise: agg.best1RMExercise,
      distinctExercises: agg.exerciseKeys.size,
    };
  };

  const exercises: ExerciseComparisonRow[] = Array.from(exerciseMap.entries())
    .map(([exerciseKey, entry]) => {
      const isShared = entry.myStats.totalSets > 0 && entry.friendStats.totalSets > 0;
      return {
        exerciseKey,
        exerciseTitle: entry.exerciseTitle,
        isShared,
        myStats: entry.myStats,
        friendStats: entry.friendStats,
      };
    })
    .sort((a, b) => {
      if (a.isShared !== b.isShared) return a.isShared ? -1 : 1;
      const combA = a.myStats.totalVolumeKg + a.friendStats.totalVolumeKg;
      const combB = b.myStats.totalVolumeKg + b.friendStats.totalVolumeKg;
      return combB - combA;
    });

  return {
    me: finalizeAggregate(myAgg),
    friend: finalizeAggregate(friendAgg),
    exercises,
  };
}
