-- ==============================================================================
-- SCHEMA SUPABASE: GARMIN STRENGTH STUDIO
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase (supabase.com)
-- ==============================================================================

-- 1. Tabla de Rutinas Personalizadas
CREATE TABLE IF NOT EXISTS public.routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    warmup_seconds INTEGER DEFAULT 0,
    cooldown_seconds INTEGER DEFAULT 0,
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Historial de Entrenamientos y Cargas (Progreso & Métricas)
CREATE TABLE IF NOT EXISTS public.workout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise ON public.workout_logs (exercise_title);
CREATE INDEX IF NOT EXISTS idx_workout_logs_performed ON public.workout_logs (performed_at);

-- 3. Habilitar Row Level Security (RLS) y Políticas de Acceso para la App
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Permitir lectura y escritura con la clave anónima pública de tu app
CREATE POLICY "Permitir todo en rutinas" 
ON public.routines 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Permitir todo en registros de entrenamiento" 
ON public.workout_logs 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);
