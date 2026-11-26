-- ==============================================================================
-- SOCIAL & RUTINAS COMPARTIDAS (HÍBRIDO: /r/CODIGO + BANDEJA ENTRE AMIGOS)
-- Ejecuta este script una vez en el SQL Editor de tu proyecto Supabase
-- ==============================================================================

-- 1. Perfiles públicos de atletas (solo metadatos no sensibles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  friend_code TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_friend_code ON public.profiles(friend_code);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_read_authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Trigger automático al crear usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display TEXT;
  v_code TEXT;
BEGIN
  v_code := substr(replace(NEW.id::text, '-', ''), 1, 8);
  v_username := COALESCE(
    NULLIF(regexp_replace(lower(COALESCE(NEW.raw_user_meta_data->>'username', '')), '[^a-z0-9_]', '', 'g'), ''),
    'atleta_' || substr(v_code, 1, 6)
  );
  v_display := COALESCE(
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'display_name', '')), ''),
    v_username
  );

  INSERT INTO public.profiles (id, username, display_name, friend_code)
  VALUES (NEW.id, v_username, v_display, v_code)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    INSERT INTO public.profiles (id, username, display_name, friend_code)
    VALUES (NEW.id, v_username || '_' || substr(v_code, 1, 4), v_display, v_code)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

-- Rellenar perfiles de cuentas ya existentes en auth.users
INSERT INTO public.profiles (id, username, display_name, friend_code)
SELECT
  u.id,
  COALESCE(
    NULLIF(regexp_replace(lower(COALESCE(u.raw_user_meta_data->>'username', '')), '[^a-z0-9_]', '', 'g'), ''),
    'atleta_' || substr(replace(u.id::text, '-', ''), 1, 6)
  ),
  COALESCE(
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'display_name', '')), ''),
    split_part(COALESCE(u.email, 'Atleta'), '@', 1)
  ),
  substr(replace(u.id::text, '-', ''), 1, 8)
FROM auth.users u
ON CONFLICT DO NOTHING;

-- 2. Amistades entre atletas
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (sender_id, receiver_id),
  CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_sender ON public.friendships(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON public.friendships(receiver_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select_participant" ON public.friendships;
DROP POLICY IF EXISTS "friendships_insert_sender" ON public.friendships;
DROP POLICY IF EXISTS "friendships_update_participant" ON public.friendships;
DROP POLICY IF EXISTS "friendships_delete_participant" ON public.friendships;

CREATE POLICY "friendships_select_participant"
ON public.friendships
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "friendships_insert_sender"
ON public.friendships
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id AND sender_id <> receiver_id);

CREATE POLICY "friendships_update_participant"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "friendships_delete_participant"
ON public.friendships
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 3. Retos entre amigos (compatible con SocialDashboard)
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exercise_title TEXT,
  metric TEXT NOT NULL CHECK (metric IN ('max_weight', 'estimated_1rm', 'total_volume', 'sessions_count')),
  target_value NUMERIC(10, 2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'declined')),
  winner_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_participant_only" ON public.challenges;
CREATE POLICY "challenges_participant_only"
ON public.challenges
FOR ALL
TO authenticated
USING (auth.uid() = creator_id OR auth.uid() = opponent_id)
WITH CHECK (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- 4. Instantáneas de rutinas compartibles por enlace corto (/r/CODIGO)
CREATE TABLE IF NOT EXISTS public.shared_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  routine_name TEXT NOT NULL,
  routine_payload JSONB NOT NULL,
  import_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_routines_code ON public.shared_routines(share_code);
CREATE INDEX IF NOT EXISTS idx_shared_routines_owner ON public.shared_routines(owner_id);

ALTER TABLE public.shared_routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_routines_owner_select" ON public.shared_routines;
DROP POLICY IF EXISTS "shared_routines_owner_insert" ON public.shared_routines;
DROP POLICY IF EXISTS "shared_routines_owner_delete" ON public.shared_routines;

CREATE POLICY "shared_routines_owner_select"
ON public.shared_routines
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "shared_routines_owner_insert"
ON public.shared_routines
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "shared_routines_owner_delete"
ON public.shared_routines
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- RPC segura para leer solo por código exacto sin exponer owner_id ni permitir listar toda la tabla
CREATE OR REPLACE FUNCTION public.get_shared_routine_by_code(p_code TEXT)
RETURNS TABLE (
  share_code TEXT,
  author_name TEXT,
  routine_name TEXT,
  routine_payload JSONB,
  import_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sr.share_code,
    sr.author_name,
    sr.routine_name,
    sr.routine_payload,
    sr.import_count,
    sr.created_at
  FROM public.shared_routines sr
  WHERE upper(sr.share_code) = upper(trim(p_code))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.increment_shared_routine_import(p_code TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shared_routines
  SET import_count = import_count + 1
  WHERE upper(share_code) = upper(trim(p_code));
$$;

REVOKE ALL ON FUNCTION public.get_shared_routine_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine_by_code(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_shared_routine_import(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_shared_routine_import(TEXT) TO anon, authenticated;

-- 5. Envío directo de rutinas entre amigos dentro de la app (bandeja de entrada)
CREATE TABLE IF NOT EXISTS public.routine_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_name TEXT NOT NULL,
  routine_payload JSONB NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'imported', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_routine_shares_recipient ON public.routine_shares(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_routine_shares_sender ON public.routine_shares(sender_id);

ALTER TABLE public.routine_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_shares_select_participant" ON public.routine_shares;
DROP POLICY IF EXISTS "routine_shares_insert_accepted_friend" ON public.routine_shares;
DROP POLICY IF EXISTS "routine_shares_update_recipient" ON public.routine_shares;
DROP POLICY IF EXISTS "routine_shares_delete_participant" ON public.routine_shares;

CREATE POLICY "routine_shares_select_participant"
ON public.routine_shares
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "routine_shares_insert_accepted_friend"
ON public.routine_shares
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> recipient_id
  AND EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.sender_id = auth.uid() AND f.receiver_id = recipient_id)
        OR (f.receiver_id = auth.uid() AND f.sender_id = recipient_id)
      )
  )
);

CREATE POLICY "routine_shares_update_recipient"
ON public.routine_shares
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "routine_shares_delete_participant"
ON public.routine_shares
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
