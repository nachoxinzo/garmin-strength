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
