-- ==============================================================================
-- SCHEMA SOCIAL, AUTENTICACIÓN Y RETOS: GARMIN STRENGTH STUDIO
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase (supabase.com)
-- ==============================================================================

-- 1. Perfiles de Usuario (vinculados a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    friend_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text) from 1 for 8),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger para crear perfil automáticamente al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, friend_code)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substring(new.id::text from 1 for 4)),
        COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
        substring(md5(random()::text || new.id::text) from 1 for 8)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Amistades entre Usuarios
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_sender ON public.friendships(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON public.friendships(receiver_id);

-- 3. Retos de Gimnasio ("Picarse")
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    exercise_title TEXT, -- Ej: "Bench Press (Barbell)", opcional si es de volumen global
    metric TEXT NOT NULL CHECK (metric IN ('max_weight', 'estimated_1rm', 'total_volume', 'sessions_count')),
    target_value NUMERIC(10, 2), -- Meta a alcanzar si aplica
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'declined')),
    winner_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenges_participants ON public.challenges(creator_id, opponent_id);

-- 4. Actualizar Rutinas y Registros para vincularlos a usuarios
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_routines_user ON public.routines(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user ON public.workout_logs(user_id);

-- 5. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Políticas de Perfiles (Lectura para todos los usuarios autenticados, edición solo de tu propio perfil)
DROP POLICY IF EXISTS "Perfiles visibles por usuarios autenticados" ON public.profiles;
CREATE POLICY "Perfiles visibles por usuarios autenticados"
ON public.profiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Actualizar propio perfil" ON public.profiles;
CREATE POLICY "Actualizar propio perfil"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Políticas de Amistades
DROP POLICY IF EXISTS "Ver amistades propias" ON public.friendships;
CREATE POLICY "Ver amistades propias"
ON public.friendships FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Crear solicitud de amistad" ON public.friendships;
CREATE POLICY "Crear solicitud de amistad"
ON public.friendships FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Gestionar solicitud de amistad" ON public.friendships;
CREATE POLICY "Gestionar solicitud de amistad"
ON public.friendships FOR UPDATE TO authenticated
USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Políticas de Retos
DROP POLICY IF EXISTS "Ver retos propios" ON public.challenges;
CREATE POLICY "Ver retos propios"
ON public.challenges FOR SELECT TO authenticated
USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

DROP POLICY IF EXISTS "Crear reto" ON public.challenges;
CREATE POLICY "Crear reto"
ON public.challenges FOR INSERT TO authenticated
WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Actualizar reto participante" ON public.challenges;
CREATE POLICY "Actualizar reto participante"
ON public.challenges FOR UPDATE TO authenticated
USING (auth.uid() = creator_id OR auth.uid() = opponent_id);
