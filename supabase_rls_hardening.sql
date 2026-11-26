-- ==============================================================================
-- ENDURECIMIENTO RLS MULTIUSUARIO: IRONSYNC (SUPABASE)
-- Aísla estrictamente rutinas e historiales por usuario autenticado (sin acceso anon).
-- ==============================================================================

ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_routines_user ON public.routines(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user ON public.workout_logs(user_id);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo en rutinas" ON public.routines;
DROP POLICY IF EXISTS "Permitir todo en registros de entrenamiento" ON public.workout_logs;
DROP POLICY IF EXISTS "Acceso a rutinas propias o locales" ON public.routines;
DROP POLICY IF EXISTS "Acceso a logs propios o locales" ON public.workout_logs;
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

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
