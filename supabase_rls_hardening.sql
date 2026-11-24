-- ==============================================================================
-- ENDURECIMIENTO RLS MULTIUSUARIO: IRONSYNC (SUPABASE)
-- Ejecuta este script en el SQL Editor de Supabase si deseas aislar estrictamente
-- las rutinas e historiales por usuario autenticado.
-- ==============================================================================

ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Permitir todo en rutinas" ON public.routines;
DROP POLICY IF EXISTS "Permitir todo en registros de entrenamiento" ON public.workout_logs;

CREATE POLICY "Acceso a rutinas propias o locales"
ON public.routines
FOR ALL
TO anon, authenticated
USING (user_id IS NULL OR auth.uid() = user_id)
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Acceso a logs propios o locales"
ON public.workout_logs
FOR ALL
TO anon, authenticated
USING (user_id IS NULL OR auth.uid() = user_id)
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
