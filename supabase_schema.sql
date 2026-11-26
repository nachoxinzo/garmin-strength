-- ==============================================================================
-- SCHEMA SUPABASE (ENDURECIDO): GARMIN STRENGTH STUDIO
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase (supabase.com)
-- ==============================================================================

-- 1. Tabla de Rutinas Personalizadas
CREATE TABLE IF NOT EXISTS public.routines (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    warmup_seconds INTEGER DEFAULT 0,
    cooldown_seconds INTEGER DEFAULT 0,
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Historial de Entrenamientos y Cargas (Ejercicios & Datos / Resumen)
CREATE TABLE IF NOT EXISTS public.workout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_title TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    exercise_title TEXT NOT NULL,
    set_index INTEGER NOT NULL DEFAULT 0,
    weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    rpe NUMERIC(3, 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para búsquedas y gráficas rápidas
CREATE INDEX IF NOT EXISTS idx_routines_user ON public.routines (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user ON public.workout_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise ON public.workout_logs (exercise_title);
CREATE INDEX IF NOT EXISTS idx_workout_logs_performed ON public.workout_logs (performed_at);

-- 3. Habilitar Row Level Security (RLS) estricto por usuario autenticado
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo en rutinas" ON public.routines;
DROP POLICY IF EXISTS "Permitir todo en registros de entrenamiento" ON public.workout_logs;
DROP POLICY IF EXISTS "routines_owner_only" ON public.routines;
DROP POLICY IF EXISTS "workout_logs_owner_only" ON public.workout_logs;

CREATE POLICY "routines_owner_only"
ON public.routines
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_logs_owner_only"
ON public.workout_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
